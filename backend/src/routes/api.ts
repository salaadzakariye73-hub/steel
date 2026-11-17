import { Router, type Request, type Response, type NextFunction } from 'express';
import { authenticate, authorize } from '../middleware/auth.ts';
import { validateBody } from '../middleware/validate.ts';
import { login, loginSchema, getMe, registerUser, registerSchema } from '../controllers/authController.ts';
import { getDashboardOverview } from '../controllers/dashboardController.ts';
import {
  listProducts,
  createProduct,
  createProductSchema,
  updateProduct,
  updateProductSchema,
  adjustProductStock,
  adjustStockSchema,
  deleteProduct,
  getProductTransactions,
} from '../controllers/productController.ts';
import {
  listCustomers,
  getCustomerDetails,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  customerSchema,
} from '../controllers/customerController.ts';
import {
  listProjects,
  createProject,
  updateProject,
  deleteProject,
  projectSchema,
} from '../controllers/projectController.ts';
import {
  listRentals,
  getRentalDetails,
  createRental,
  createRentalSchema,
  extendRental,
  extendRentalSchema,
  processRentalReturn,
  processReturnSchema,
} from '../controllers/rentalController.ts';
import {
  listPayments,
  createPayment,
  createPaymentSchema,
  deletePaymentForbidden,
} from '../controllers/paymentController.ts';
import {
  listInvoices,
  getInvoiceDetails,
  deleteInvoiceForbidden,
} from '../controllers/invoiceController.ts';
import {
  listDamages,
  createDamageRecord,
  createDamageSchema,
  toggleDamageResolved,
} from '../controllers/damageController.ts';
import {
  getReportsData,
  listExpenses,
  createExpense,
  createExpenseSchema,
} from '../controllers/reportController.ts';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  listUsers,
  updateUser,
  updateUserSchema,
  listAuditLogs,
} from '../controllers/systemController.ts';

type AsyncFn = (req: Request, res: Response, next: NextFunction) => Promise<void>;
const wrap =
  (fn: AsyncFn) =>
  (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

export const apiRouter = Router();

// Health check
apiRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'Kaah Steel Prop Rental API', timestamp: new Date().toISOString() });
});

// Auth
apiRouter.post('/auth/login', validateBody(loginSchema), wrap(login));
apiRouter.get('/auth/me', authenticate, wrap(getMe));
apiRouter.post('/auth/register', authenticate, authorize('ADMIN'), validateBody(registerSchema), wrap(registerUser));

// Protected routes below
apiRouter.use(authenticate);

// Dashboard
apiRouter.get('/dashboard', wrap(getDashboardOverview));

// Inventory / Products
apiRouter.get('/products', wrap(listProducts));
apiRouter.get('/products/:id/transactions', wrap(getProductTransactions));
apiRouter.post(
  '/products',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(createProductSchema),
  wrap(createProduct)
);
apiRouter.put(
  '/products/:id',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(updateProductSchema),
  wrap(updateProduct)
);
apiRouter.post(
  '/products/:id/adjust',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(adjustStockSchema),
  wrap(adjustProductStock)
);
apiRouter.delete('/products/:id', authorize('ADMIN', 'MANAGER'), wrap(deleteProduct));

// Customers
apiRouter.get('/customers', wrap(listCustomers));
apiRouter.get('/customers/:id', wrap(getCustomerDetails));
apiRouter.post(
  '/customers',
  authorize('ADMIN', 'MANAGER'),
  validateBody(customerSchema),
  wrap(createCustomer)
);
apiRouter.put(
  '/customers/:id',
  authorize('ADMIN', 'MANAGER'),
  validateBody(customerSchema.partial()),
  wrap(updateCustomer)
);
apiRouter.delete('/customers/:id', authorize('ADMIN'), wrap(deleteCustomer));

// Projects
apiRouter.get('/projects', wrap(listProjects));
apiRouter.post(
  '/projects',
  authorize('ADMIN', 'MANAGER'),
  validateBody(projectSchema),
  wrap(createProject)
);
apiRouter.put(
  '/projects/:id',
  authorize('ADMIN', 'MANAGER'),
  validateBody(projectSchema.partial()),
  wrap(updateProject)
);
apiRouter.delete('/projects/:id', authorize('ADMIN'), wrap(deleteProject));

// Rentals & Returns
apiRouter.get('/rentals', wrap(listRentals));
apiRouter.get('/rentals/:id', wrap(getRentalDetails));
apiRouter.post(
  '/rentals',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(createRentalSchema),
  wrap(createRental)
);
apiRouter.post(
  '/rentals/:id/extend',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(extendRentalSchema),
  wrap(extendRental)
);
apiRouter.post(
  '/rentals/:id/return',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(processReturnSchema),
  wrap(processRentalReturn)
);

// Invoices
apiRouter.get('/invoices', wrap(listInvoices));
apiRouter.get('/invoices/:id', wrap(getInvoiceDetails));
apiRouter.delete('/invoices/:id', wrap(deleteInvoiceForbidden));

// Payments
apiRouter.get('/payments', wrap(listPayments));
apiRouter.post(
  '/payments',
  authorize('ADMIN', 'MANAGER', 'ACCOUNTANT'),
  validateBody(createPaymentSchema),
  wrap(createPayment)
);
apiRouter.delete('/payments/:id', wrap(deletePaymentForbidden));

// Damage & Loss
apiRouter.get('/damages', wrap(listDamages));
apiRouter.post(
  '/damages',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  validateBody(createDamageSchema),
  wrap(createDamageRecord)
);
apiRouter.patch(
  '/damages/:id/resolve',
  authorize('ADMIN', 'MANAGER', 'STOREKEEPER'),
  wrap(toggleDamageResolved)
);

// Reports & Expenses
apiRouter.get('/reports', wrap(getReportsData));
apiRouter.get('/expenses', wrap(listExpenses));
apiRouter.post(
  '/expenses',
  authorize('ADMIN', 'ACCOUNTANT'),
  validateBody(createExpenseSchema),
  wrap(createExpense)
);

// Notifications
apiRouter.get('/notifications', wrap(listNotifications));
apiRouter.patch('/notifications/read-all', wrap(markAllNotificationsRead));
apiRouter.patch('/notifications/:id/read', wrap(markNotificationRead));

// Users & Audit Logs (Admin only)
apiRouter.get('/users', authorize('ADMIN'), wrap(listUsers));
apiRouter.put('/users/:id', authorize('ADMIN'), validateBody(updateUserSchema), wrap(updateUser));
apiRouter.get('/audit-logs', authorize('ADMIN'), wrap(listAuditLogs));
