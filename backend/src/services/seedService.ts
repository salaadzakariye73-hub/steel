import bcrypt from 'bcryptjs';
import { User } from '../models/User.ts';
import { Product } from '../models/Product.ts';
import { InventoryTransaction } from '../models/InventoryTransaction.ts';
import { Customer } from '../models/Customer.ts';
import { Project } from '../models/Project.ts';
import { Rental } from '../models/Rental.ts';
import { RentalItem } from '../models/RentalItem.ts';
import { RentalReturn } from '../models/RentalReturn.ts';
import { Invoice } from '../models/Invoice.ts';
import { Payment } from '../models/Payment.ts';
import { Expense } from '../models/Expense.ts';
import { DamageRecord } from '../models/DamageRecord.ts';
import { AuditLog } from '../models/AuditLog.ts';
import { syncRentalAndInvoice, refreshSystemNotifications } from './billingService.ts';

export async function ensureInitialDatabaseSeed(): Promise<void> {
  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    await refreshSystemNotifications();
    return;
  }

  console.log('[Seed] Initializing Kaah Steel Prop Rental database...');

  const passwordHash = await bcrypt.hash('KaahAdmin2026!', 10);
  const staffHash = await bcrypt.hash('StaffPass2026!', 10);

  const [admin, manager, accountant, storekeeper] = await User.create([
    {
      name: 'Ahmed Hassan Warsame',
      email: 'admin@kaahprops.so',
      passwordHash,
      role: 'ADMIN',
      phone: '+252 61 500 1001',
      isActive: true,
    },
    {
      name: 'Fadumo Abdi Farah',
      email: 'manager@kaahprops.so',
      passwordHash: staffHash,
      role: 'MANAGER',
      phone: '+252 61 500 1002',
      isActive: true,
    },
    {
      name: 'Abdirahman Ali Duale',
      email: 'accountant@kaahprops.so',
      passwordHash: staffHash,
      role: 'ACCOUNTANT',
      phone: '+252 61 500 1003',
      isActive: true,
    },
    {
      name: 'Mohamed Yusuf Egal',
      email: 'storekeeper@kaahprops.so',
      passwordHash: staffHash,
      role: 'STOREKEEPER',
      phone: '+252 61 500 1004',
      isActive: true,
    },
  ]);

  // Products
  const [acrow35, acrow45, heavyShoring, uHeadJack, trenchStrut] = await Product.create([
    {
      name: 'Standard Acrow Steel Prop (2.0m - 3.5m)',
      sku: 'PRP-ACW-350',
      category: 'Steel Props',
      description: 'Adjustable telescopic steel acrow prop with heavy-duty threaded collar and high-tensile pin.',
      totalQuantity: 3200,
      availableQuantity: 1750,
      rentedQuantity: 1400,
      damagedQuantity: 35,
      lostQuantity: 15,
      purchasePrice: 24.5,
      dailyRentalPrice: 0.6,
      minStockThreshold: 300,
      imageUrl: '/src/assets/images/prop_acrow_standard_1794824459173.jpg',
      warehouseLocation: 'Mogadishu Yard A - Bay 1',
      isActive: true,
    },
    {
      name: 'Heavy-Duty Slab Steel Prop (2.8m - 4.5m)',
      sku: 'PRP-HVY-450',
      category: 'Steel Props',
      description: 'High-load telescopic slab shoring prop rated up to 30kN for commercial multi-story slabs.',
      totalQuantity: 1800,
      availableQuantity: 1080,
      rentedQuantity: 700,
      damagedQuantity: 15,
      lostQuantity: 5,
      purchasePrice: 36.0,
      dailyRentalPrice: 0.85,
      minStockThreshold: 200,
      imageUrl: '/src/assets/images/prop_acrow_standard_1794824459173.jpg',
      warehouseLocation: 'Mogadishu Yard A - Bay 2',
      isActive: true,
    },
    {
      name: 'Galvanized Push-Pull Shoring Prop & Tripod',
      sku: 'SHP-GAL-500',
      category: 'Shoring Systems',
      description: 'Galvanized column and wall formwork alignment prop with folding tripod support stand.',
      totalQuantity: 650,
      availableQuantity: 440,
      rentedQuantity: 200,
      damagedQuantity: 10,
      lostQuantity: 0,
      purchasePrice: 68.0,
      dailyRentalPrice: 1.4,
      minStockThreshold: 100,
      imageUrl: '/src/assets/images/prop_heavy_shoring_1794824458934.jpg',
      warehouseLocation: 'Mogadishu Yard B - Rack 4',
      isActive: true,
    },
    {
      name: 'Forged U-Head Jack & Base Plate Set',
      sku: 'ACC-UHJ-060',
      category: 'Accessories',
      description: '600mm solid threaded U-head jack with forged nut and heavy 150x150mm base plate.',
      totalQuantity: 2400,
      availableQuantity: 1780,
      rentedQuantity: 600,
      damagedQuantity: 12,
      lostQuantity: 8,
      purchasePrice: 14.0,
      dailyRentalPrice: 0.25,
      minStockThreshold: 250,
      imageUrl: '/src/assets/images/prop_scaffolding_accessories_1794824459003.jpg',
      warehouseLocation: 'Mogadishu Yard B - Bin 12',
      isActive: true,
    },
    {
      name: 'Adjustable Trench Strut (0.7m - 1.1m)',
      sku: 'STR-TRN-110',
      category: 'Trench Support',
      description: 'Heavy-gauge steel trench strut with claw end plates for excavation shoring.',
      totalQuantity: 480,
      availableQuantity: 45,
      rentedQuantity: 420,
      damagedQuantity: 10,
      lostQuantity: 5,
      purchasePrice: 22.0,
      dailyRentalPrice: 0.55,
      minStockThreshold: 80,
      imageUrl: '/src/assets/images/prop_heavy_shoring_1794824458934.jpg',
      warehouseLocation: 'Hargeisa Annex - Bay 1',
      isActive: true,
    },
  ]);

  await InventoryTransaction.create([
    {
      product: acrow35._id,
      type: 'STOCK_IN',
      quantity: 3200,
      previousAvailable: 0,
      newAvailable: 3200,
      performedBy: admin._id,
      notes: 'Initial opening stock balance',
    },
    {
      product: acrow45._id,
      type: 'STOCK_IN',
      quantity: 1800,
      previousAvailable: 0,
      newAvailable: 1800,
      performedBy: admin._id,
      notes: 'Initial opening stock balance',
    },
    {
      product: heavyShoring._id,
      type: 'STOCK_IN',
      quantity: 650,
      previousAvailable: 0,
      newAvailable: 650,
      performedBy: admin._id,
      notes: 'Initial opening stock balance',
    },
    {
      product: uHeadJack._id,
      type: 'STOCK_IN',
      quantity: 2400,
      previousAvailable: 0,
      newAvailable: 2400,
      performedBy: admin._id,
      notes: 'Initial opening stock balance',
    },
    {
      product: trenchStrut._id,
      type: 'STOCK_IN',
      quantity: 480,
      previousAvailable: 0,
      newAvailable: 480,
      performedBy: admin._id,
      notes: 'Initial opening stock balance',
    },
  ]);

  // Customers
  const [custBanadir, custHorn, custJubba] = await Customer.create([
    {
      customerCode: 'CUS-0001',
      name: 'Hassan Mohamed Nur',
      phone: '+252 61 522 8810',
      email: 'hassan@banadirbuilders.so',
      address: 'KM4 Maka Al-Mukarama Rd, Hodan District, Mogadishu',
      companyName: 'Banadir Civil & Tower Builders Ltd',
      identificationNumber: 'SO-NID-994120',
      notes: 'Tier-1 commercial contractor; multi-tower slab projects.',
    },
    {
      customerCode: 'CUS-0002',
      name: 'Sahra Osman Jama',
      phone: '+252 63 441 7721',
      email: 'procurement@horninfra.so',
      address: 'Airport Road, Wadajir District, Mogadishu',
      companyName: 'Horn Infrastructure & Engineering',
      identificationNumber: 'SO-NID-882311',
      notes: 'Infrastructure & bridge formwork contracts.',
    },
    {
      customerCode: 'CUS-0003',
      name: 'Ibrahim Adan Barre',
      phone: '+252 61 788 3340',
      email: 'ibrahim@jubbacontracting.so',
      address: 'Taleex Junction, Hodan, Mogadishu',
      companyName: 'Jubba Residential Contracting',
      identificationNumber: 'SO-NID-771044',
      notes: 'Residential apartment developments.',
    },
  ]);

  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000);

  // Projects
  const [projSkyline, projMedical, projPort, projVillas] = await Project.create([
    {
      projectCode: 'PRJ-0001',
      name: 'Hodan Commercial Plaza (8-Story)',
      customer: custBanadir._id,
      location: 'KM5, Hodan District, Mogadishu',
      startDate: daysAgo(45),
      expectedCompletionDate: daysFromNow(60),
      status: 'ACTIVE',
      description: 'Reinforced concrete commercial plaza requiring heavy slab shoring.',
    },
    {
      projectCode: 'PRJ-0002',
      name: 'Banadir Diagnostic Wing Extension',
      customer: custBanadir._id,
      location: 'Waberi District, Mogadishu',
      startDate: daysAgo(20),
      expectedCompletionDate: daysFromNow(25),
      status: 'ACTIVE',
      description: 'Three-story hospital wing extension.',
    },
    {
      projectCode: 'PRJ-0003',
      name: 'Port Logistics Warehouse & Culvert',
      customer: custHorn._id,
      location: 'Xamar Weyne Port Zone, Mogadishu',
      startDate: daysAgo(38),
      expectedCompletionDate: daysFromNow(4),
      status: 'ACTIVE',
      description: 'Heavy-duty trench excavation and industrial warehouse roof slab.',
    },
    {
      projectCode: 'PRJ-0004',
      name: 'Darusalam Terrace Villas Phase I',
      customer: custJubba._id,
      location: 'Darusalam Estate, Mogadishu',
      startDate: daysAgo(65),
      expectedCompletionDate: daysAgo(5),
      status: 'COMPLETED',
      description: 'Completed 12-unit residential villa development.',
    },
  ]);

  // Rental 1: Partial Return Example (1000 rented 25 days ago, 400 returned 10 days ago, 600 still out due in 5 days)
  const r1Start = daysAgo(25);
  const r1PartialDate = daysAgo(10);
  const r1Expected = daysFromNow(5);

  const rental1 = await Rental.create({
    rentalNumber: 'RNT-2026-0001',
    customer: custBanadir._id,
    project: projSkyline._id,
    startDate: r1Start,
    expectedReturnDate: r1Expected,
    status: 'PARTIALLY_RETURNED',
    depositAmount: 3000,
    notes: 'Phase 1 slab casting; 400 props released after curing.',
    createdBy: manager._id,
  });

  const r1Item1 = await RentalItem.create({
    rental: rental1._id,
    product: acrow35._id,
    initialQuantity: 1000,
    returnedQuantity: 400,
    damagedQuantity: 0,
    lostQuantity: 0,
    remainingQuantity: 600,
    dailyRate: 0.6,
    lastPeriodStartDate: r1PartialDate,
    accruedCharge: 9000, // 15 days * 1000 * 0.60
  });

  await RentalReturn.create({
    returnNumber: 'RET-2026-0001',
    rental: rental1._id,
    returnDate: r1PartialDate,
    isFinalReturn: false,
    items: [
      {
        rentalItem: r1Item1._id,
        product: acrow35._id,
        productName: acrow35.name,
        returnedGoodQty: 400,
        damagedQty: 0,
        lostQty: 0,
        quantityHeldBeforeReturn: 1000,
        periodStartDate: r1Start,
        periodEndDate: r1PartialDate,
        periodDays: 15,
        dailyRate: 0.6,
        periodCharge: 9000,
        replacementCharge: 0,
      },
    ],
    totalPeriodCharge: 9000,
    totalReplacementCharge: 0,
    notes: 'First partial return from Floors 1-3.',
    processedBy: storekeeper._id,
  });

  const inv1 = await Invoice.create({
    invoiceNumber: 'INV-2026-0001',
    rental: rental1._id,
    customer: custBanadir._id,
    project: projSkyline._id,
    issueDate: r1Start,
    dueDate: r1Expected,
    depositAmount: 3000,
    paidAmount: 10000,
    status: 'PARTIALLY_PAID',
  });

  await Payment.create([
    {
      paymentNumber: 'PAY-2026-0001',
      customer: custBanadir._id,
      rental: rental1._id,
      invoice: inv1._id,
      amount: 6000,
      currency: 'USD',
      exchangeRate: 1,
      usdEquivalent: 6000,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: daysAgo(20),
      referenceNumber: 'SLB-TXN-88412',
      notes: 'Initial mobilization & deposit installment',
      receivedBy: accountant._id,
    },
    {
      paymentNumber: 'PAY-2026-0002',
      customer: custBanadir._id,
      rental: rental1._id,
      invoice: inv1._id,
      amount: 4000,
      currency: 'USD',
      exchangeRate: 1,
      usdEquivalent: 4000,
      paymentMethod: 'MOBILE_MONEY',
      paymentDate: daysAgo(8),
      referenceNumber: 'EVC-9920144',
      notes: 'Second installment via EVC Plus Merchant',
      receivedBy: accountant._id,
    },
  ]);

  await syncRentalAndInvoice(String(rental1._id));

  // Rental 2: Overdue Rental (Heavy props + trench struts, past expected return date by 4 days)
  const r2Start = daysAgo(34);
  const r2Expected = daysAgo(4);

  const rental2 = await Rental.create({
    rentalNumber: 'RNT-2026-0002',
    customer: custHorn._id,
    project: projPort._id,
    startDate: r2Start,
    expectedReturnDate: r2Expected,
    status: 'OVERDUE',
    depositAmount: 2500,
    notes: 'Port culvert shoring; awaiting crane release.',
    createdBy: manager._id,
  });

  await RentalItem.create([
    {
      rental: rental2._id,
      product: acrow45._id,
      initialQuantity: 700,
      returnedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      remainingQuantity: 700,
      dailyRate: 0.85,
      lastPeriodStartDate: r2Start,
      accruedCharge: 0,
    },
    {
      rental: rental2._id,
      product: trenchStrut._id,
      initialQuantity: 420,
      returnedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      remainingQuantity: 420,
      dailyRate: 0.55,
      lastPeriodStartDate: r2Start,
      accruedCharge: 0,
    },
  ]);

  const inv2 = await Invoice.create({
    invoiceNumber: 'INV-2026-0002',
    rental: rental2._id,
    customer: custHorn._id,
    project: projPort._id,
    issueDate: r2Start,
    dueDate: r2Expected,
    depositAmount: 2500,
    paidAmount: 10000,
    status: 'OVERDUE',
  });

  await Payment.create({
    paymentNumber: 'PAY-2026-0003',
    customer: custHorn._id,
    rental: rental2._id,
    invoice: inv2._id,
    amount: 10000,
    currency: 'USD',
    exchangeRate: 1,
    usdEquivalent: 10000,
    paymentMethod: 'BANK_TRANSFER',
    paymentDate: daysAgo(18),
    referenceNumber: 'IBS-441098',
    notes: 'Progress payment from Horn Infrastructure',
    receivedBy: accountant._id,
  });

  await syncRentalAndInvoice(String(rental2._id));

  // Rental 3: Active Rental (Acrow 3.5m + Push-Pull Shoring + U-Head Jacks)
  const r3Start = daysAgo(8);
  const r3Expected = daysFromNow(22);

  const rental3 = await Rental.create({
    rentalNumber: 'RNT-2026-0003',
    customer: custBanadir._id,
    project: projMedical._id,
    startDate: r3Start,
    expectedReturnDate: r3Expected,
    status: 'ACTIVE',
    depositAmount: 2000,
    notes: 'Diagnostic wing ground + first floor formwork.',
    createdBy: manager._id,
  });

  await RentalItem.create([
    {
      rental: rental3._id,
      product: acrow35._id,
      initialQuantity: 800,
      returnedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      remainingQuantity: 800,
      dailyRate: 0.6,
      lastPeriodStartDate: r3Start,
      accruedCharge: 0,
    },
    {
      rental: rental3._id,
      product: heavyShoring._id,
      initialQuantity: 200,
      returnedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      remainingQuantity: 200,
      dailyRate: 1.4,
      lastPeriodStartDate: r3Start,
      accruedCharge: 0,
    },
    {
      rental: rental3._id,
      product: uHeadJack._id,
      initialQuantity: 600,
      returnedQuantity: 0,
      damagedQuantity: 0,
      lostQuantity: 0,
      remainingQuantity: 600,
      dailyRate: 0.25,
      lastPeriodStartDate: r3Start,
      accruedCharge: 0,
    },
  ]);

  const inv3 = await Invoice.create({
    invoiceNumber: 'INV-2026-0003',
    rental: rental3._id,
    customer: custBanadir._id,
    project: projMedical._id,
    issueDate: r3Start,
    dueDate: r3Expected,
    depositAmount: 2000,
    paidAmount: 2000,
    status: 'PARTIALLY_PAID',
  });

  await Payment.create({
    paymentNumber: 'PAY-2026-0004',
    customer: custBanadir._id,
    rental: rental3._id,
    invoice: inv3._id,
    amount: 54000000,
    currency: 'SOS',
    exchangeRate: 27000,
    usdEquivalent: 2000,
    paymentMethod: 'CASH_SOS',
    paymentDate: daysAgo(7),
    referenceNumber: 'CSH-SOS-2026-01',
    notes: 'Cash SOS deposit equivalent to $2,000 USD',
    receivedBy: accountant._id,
  });

  await syncRentalAndInvoice(String(rental3._id));

  // Rental 4: Completed Rental (with full return & paid invoice, including minor damage settled)
  const r4Start = daysAgo(55);
  const r4End = daysAgo(25);

  const rental4 = await Rental.create({
    rentalNumber: 'RNT-2026-0004',
    customer: custJubba._id,
    project: projVillas._id,
    startDate: r4Start,
    expectedReturnDate: r4End,
    actualCloseDate: r4End,
    status: 'COMPLETED',
    depositAmount: 1500,
    notes: 'Completed 30-day residential slab cycle.',
    createdBy: manager._id,
  });

  const r4Item1 = await RentalItem.create({
    rental: rental4._id,
    product: acrow35._id,
    initialQuantity: 500,
    returnedQuantity: 492,
    damagedQuantity: 5,
    lostQuantity: 3,
    remainingQuantity: 0,
    dailyRate: 0.6,
    lastPeriodStartDate: r4End,
    accruedCharge: 9000,
  });

  await RentalReturn.create({
    returnNumber: 'RET-2026-0002',
    rental: rental4._id,
    returnDate: r4End,
    isFinalReturn: true,
    items: [
      {
        rentalItem: r4Item1._id,
        product: acrow35._id,
        productName: acrow35.name,
        returnedGoodQty: 492,
        damagedQty: 5,
        lostQty: 3,
        quantityHeldBeforeReturn: 500,
        periodStartDate: r4Start,
        periodEndDate: r4End,
        periodDays: 30,
        dailyRate: 0.6,
        periodCharge: 9000,
        replacementCharge: 175,
      },
    ],
    totalPeriodCharge: 9000,
    totalReplacementCharge: 175,
    notes: 'Final villa return; 5 bent collars and 3 missing inner tubes billed.',
    processedBy: storekeeper._id,
  });

  await DamageRecord.create([
    {
      recordNumber: 'DMG-2026-0001',
      product: acrow35._id,
      rental: rental4._id,
      customer: custJubba._id,
      damagedQuantity: 5,
      lostQuantity: 3,
      damageDescription: '5 threaded collars bent by concrete vibrator; 3 inner tubes unreturned.',
      inspectionDate: r4End,
      replacementCost: 175,
      responsibility: 'CUSTOMER',
      resolved: true,
      notes: 'Settled on final invoice INV-2026-0004.',
      inspectedBy: storekeeper._id,
    },
    {
      recordNumber: 'DMG-2026-0002',
      product: acrow45._id,
      damagedQuantity: 15,
      lostQuantity: 5,
      damageDescription: 'Yard audit identified 15 props needing sleeve re-threading and 5 missing.',
      inspectionDate: daysAgo(6),
      replacementCost: 340,
      responsibility: 'COMPANY',
      resolved: false,
      notes: 'Scheduled for welding workshop repair.',
      inspectedBy: storekeeper._id,
    },
  ]);

  const inv4 = await Invoice.create({
    invoiceNumber: 'INV-2026-0004',
    rental: rental4._id,
    customer: custJubba._id,
    project: projVillas._id,
    issueDate: r4Start,
    dueDate: r4End,
    depositAmount: 1500,
    paidAmount: 9175,
    status: 'PAID',
  });

  await Payment.create({
    paymentNumber: 'PAY-2026-0005',
    customer: custJubba._id,
    rental: rental4._id,
    invoice: inv4._id,
    amount: 9175,
    currency: 'USD',
    exchangeRate: 1,
    usdEquivalent: 9175,
    paymentMethod: 'CASH_USD',
    paymentDate: r4End,
    referenceNumber: 'CSH-USD-2026-05',
    notes: 'Final settlement including damage/loss replacement fee',
    receivedBy: accountant._id,
  });

  await syncRentalAndInvoice(String(rental4._id));

  // Expenses
  await Expense.create([
    {
      expenseNumber: 'EXP-2026-0001',
      category: 'MAINTENANCE',
      description: 'Anti-rust industrial primer paint & thread re-cutting dies',
      amount: 640,
      currency: 'USD',
      usdEquivalent: 640,
      expenseDate: daysAgo(15),
      vendor: 'Mogadishu Steel & Welding Supply',
      recordedBy: accountant._id,
    },
    {
      expenseNumber: 'EXP-2026-0002',
      category: 'TRANSPORT',
      description: 'Flatbed truck haulage for Banadir & Port Yard dispatches',
      amount: 1150,
      currency: 'USD',
      usdEquivalent: 1150,
      expenseDate: daysAgo(11),
      vendor: 'Banaadir Freight Logistics',
      recordedBy: accountant._id,
    },
    {
      expenseNumber: 'EXP-2026-0003',
      category: 'WAREHOUSE',
      description: 'Monthly Yard A & Yard B security and storage lease',
      amount: 1800,
      currency: 'USD',
      usdEquivalent: 1800,
      expenseDate: daysAgo(5),
      vendor: 'Hodan Industrial Properties',
      recordedBy: accountant._id,
    },
  ]);

  await AuditLog.create({
    actor: admin._id,
    actorName: admin.name,
    actorRole: admin.role,
    action: 'SYSTEM_INITIALIZED',
    entityType: 'System',
    entityId: 'SEED',
    summary: 'Initialized Kaah Steel Prop Rental System with staff accounts, catalog, and opening contracts.',
  });

  await refreshSystemNotifications();
  console.log('[Seed] Initial dataset created successfully.');
}
