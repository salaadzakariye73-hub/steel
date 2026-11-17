import type { Response } from 'express';
import { z } from 'zod';
import { Project } from '../models/Project.ts';
import { Customer } from '../models/Customer.ts';
import { Rental } from '../models/Rental.ts';
import { generateCode } from '../utils/sequences.ts';
import { recordAuditLog, type AuthenticatedRequest } from '../middleware/auth.ts';
import { HttpError } from '../middleware/validate.ts';

export const projectSchema = z.object({
  name: z.string().min(2).max(160),
  customer: z.string().min(1),
  location: z.string().min(2),
  startDate: z.string().min(1),
  expectedCompletionDate: z.string().min(1),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).default('ACTIVE'),
  description: z.string().optional().default(''),
});

export async function listProjects(req: AuthenticatedRequest, res: Response): Promise<void> {
  const customerId = String(req.query.customerId || '').trim();
  const status = String(req.query.status || '').trim();
  const search = String(req.query.search || '').trim();

  const filter: Record<string, unknown> = {};
  if (customerId) filter.customer = customerId;
  if (status && status !== 'ALL') filter.status = status;
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { projectCode: { $regex: search, $options: 'i' } },
      { location: { $regex: search, $options: 'i' } },
    ];
  }

  const projects = await Project.find(filter)
    .populate('customer', 'name companyName customerCode phone')
    .sort({ createdAt: -1 })
    .lean();

  const rentals = await Rental.find({ status: { $ne: 'CANCELLED' } })
    .select('project status expectedTotalCharge')
    .lean();

  const enriched = projects.map((p) => {
    const pid = String(p._id);
    const projRentals = rentals.filter((r) => String(r.project) === pid);
    return {
      ...p,
      rentalCount: projRentals.length,
      activeRentalCount: projRentals.filter((r) =>
        ['ACTIVE', 'PARTIALLY_RETURNED', 'OVERDUE'].includes(r.status)
      ).length,
      totalRentalValue: projRentals.reduce((s, r) => s + (r.expectedTotalCharge || 0), 0),
    };
  });

  res.json({ projects: enriched });
}

export async function createProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as z.infer<typeof projectSchema>;

  const customerExists = await Customer.exists({ _id: data.customer, isActive: true });
  if (!customerExists) {
    throw new HttpError(404, 'Selected customer does not exist.');
  }

  const start = new Date(data.startDate);
  const completion = new Date(data.expectedCompletionDate);
  if (completion < start) {
    throw new HttpError(400, 'Expected completion date must be on or after start date.');
  }

  const projectCode = await generateCode(Project, 'projectCode', 'PRJ', false);

  const project = await Project.create({
    ...data,
    projectCode,
    startDate: start,
    expectedCompletionDate: completion,
  });

  const populated = await project.populate('customer', 'name companyName customerCode phone');

  await recordAuditLog({
    req,
    action: 'PROJECT_CREATED',
    entityType: 'Project',
    entityId: String(project._id),
    summary: `Registered project ${project.name} (${project.projectCode}).`,
  });

  res.status(201).json({ project: populated });
}

export async function updateProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const data = req.body as Partial<z.infer<typeof projectSchema>>;
  const project = await Project.findById(req.params.id);
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  if (data.name) project.name = data.name;
  if (data.customer) project.customer = data.customer as unknown as typeof project.customer;
  if (data.location) project.location = data.location;
  if (data.startDate) project.startDate = new Date(data.startDate);
  if (data.expectedCompletionDate) project.expectedCompletionDate = new Date(data.expectedCompletionDate);
  if (data.status) project.status = data.status;
  if (data.description !== undefined) project.description = data.description;

  await project.save();
  const populated = await project.populate('customer', 'name companyName customerCode phone');

  await recordAuditLog({
    req,
    action: 'PROJECT_UPDATED',
    entityType: 'Project',
    entityId: String(project._id),
    summary: `Updated project ${project.name} (${project.projectCode}) -> ${project.status}.`,
  });

  res.json({ project: populated });
}

export async function deleteProject(req: AuthenticatedRequest, res: Response): Promise<void> {
  const project = await Project.findById(req.params.id);
  if (!project) {
    throw new HttpError(404, 'Project not found');
  }

  const linkedRentals = await Rental.exists({ project: project._id });
  if (linkedRentals) {
    throw new HttpError(400, 'Cannot delete project with linked rental contracts.');
  }

  await project.deleteOne();

  await recordAuditLog({
    req,
    action: 'PROJECT_DELETED',
    entityType: 'Project',
    entityId: String(project._id),
    summary: `Deleted project ${project.name} (${project.projectCode}).`,
  });

  res.json({ success: true });
}
