import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Invoice, Payment, Rental } from '../types';
import type { Language } from '../i18n/translations';
import { formatDate, formatMoney, formatPaymentMethod, formatStatusLabel } from './formatters';

const COMPANY_LOGO_URL = '/src/assets/images/company_logo_mark_1794824457556.jpg';

async function loadLogoBase64(): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Logo load failed'));
      img.src = COMPANY_LOGO_URL;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || 200;
    canvas.height = img.naturalHeight || 200;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.92);
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(params: {
  invoice: Invoice;
  payments: Payment[];
  lang: Language;
  mode?: 'download' | 'print';
}): Promise<void> {
  const { invoice, payments, lang, mode = 'download' } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const logoData = await loadLogoBase64();

  const isSo = lang === 'so';
  const rentalObj = typeof invoice.rental === 'object' ? (invoice.rental as Rental) : null;

  // Header band
  doc.setFillColor(15, 23, 42); // Dark navy #0F172A
  doc.rect(0, 0, 595, 96, 'F');

  if (logoData) {
    doc.addImage(logoData, 'JPEG', 40, 20, 54, 54);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('KAAH STEEL PROPS & SHORING', logoData ? 108 : 40, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(203, 213, 225);
  doc.text('KM4 Industrial Road, Hodan District, Mogadishu, Somalia', logoData ? 108 : 40, 59);
  doc.text('Tel: +252 61 500 1001  |  Email: billing@kaahprops.so', logoData ? 108 : 40, 74);

  doc.setTextColor(251, 191, 36); // Amber accent
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(isSo ? 'QAANSHEEGTA KIRADA' : 'RENTAL INVOICE', 555, 42, { align: 'right' });

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(invoice.invoiceNumber, 555, 60, { align: 'right' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `${isSo ? 'Xaaladda' : 'Status'}: ${formatStatusLabel(invoice.status, lang)}`,
    555,
    76,
    { align: 'right' }
  );

  // Customer & Project Details Grid
  doc.setTextColor(15, 23, 42);
  let y = 122;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(isSo ? 'MACLUUMAADKA MACMIILKA' : 'BILL TO / CUSTOMER DETAILS', 40, y);
  doc.text(isSo ? 'MASHRUUCA & MUDDADA KIRADA' : 'PROJECT & RENTAL PERIOD', 320, y);

  doc.setDrawColor(226, 232, 240);
  doc.line(40, y + 6, 555, y + 6);

  y += 22;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.text(invoice.customer?.name || '—', 40, y);
  doc.text(invoice.project?.name || '—', 320, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(invoice.customer?.companyName || '', 40, y + 15);
  doc.text(`${isSo ? 'Goobta' : 'Location'}: ${invoice.project?.location || '—'}`, 320, y + 15);

  doc.text(`${isSo ? 'Telefoon' : 'Phone'}: ${invoice.customer?.phone || '—'}`, 40, y + 30);
  doc.text(
    `${isSo ? 'Lambarka Kirada' : 'Contract'}: ${rentalObj?.rentalNumber || '—'}`,
    320,
    y + 30
  );

  doc.text(`${isSo ? 'Cinwaan' : 'Address'}: ${invoice.customer?.address || '—'}`, 40, y + 45);
  doc.text(
    `${isSo ? 'Muddada' : 'Period'}: ${formatDate(rentalObj?.startDate || invoice.issueDate)} - ${formatDate(rentalObj?.actualCloseDate || rentalObj?.expectedReturnDate || invoice.dueDate)}`,
    320,
    y + 45
  );

  doc.text(
    `${isSo ? 'Taariikhda Qaansheegta' : 'Issue Date'}: ${formatDate(invoice.issueDate)}`,
    40,
    y + 60
  );
  doc.text(
    `${isSo ? 'Taariikhda Bixinta' : 'Due Date'}: ${formatDate(invoice.dueDate)}`,
    320,
    y + 60
  );

  // Line items table
  autoTable(doc, {
    startY: y + 82,
    head: [
      [
        isSo ? 'Qalabka & Sharaxaadda' : 'Equipment & Billing Period',
        isSo ? 'Tirada' : 'Qty',
        isSo ? 'Maalmo' : 'Days',
        isSo ? 'Qiimaha/Maalin' : 'Daily Rate',
        isSo ? 'Muddada' : 'Dates',
        isSo ? 'Wadarta' : 'Amount',
      ],
    ],
    body: invoice.lineItems.map((li) => [
      `${li.productName}\n(${li.description})`,
      String(li.quantity),
      String(li.days),
      formatMoney(li.dailyRate),
      `${formatDate(li.fromDate)} - ${formatDate(li.toDate)}`,
      formatMoney(li.amount),
    ]),
    styles: { fontSize: 8.5, cellPadding: 6, textColor: [15, 23, 42] },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' },
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let finalY = (doc as any).lastAutoTable.finalY + 20;

  // Financial Summary Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(330, finalY, 225, 96, 4, 4, 'FD');

  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.setFont('helvetica', 'normal');
  doc.text(isSo ? 'Carbuun (Deposit):' : 'Security Deposit:', 344, finalY + 22);
  doc.text(formatMoney(invoice.depositAmount), 542, finalY + 22, { align: 'right' });

  doc.text(isSo ? 'Wadarta Qaansheegta:' : 'Total Invoice Amount:', 344, finalY + 42);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(formatMoney(invoice.totalAmount), 542, finalY + 42, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(22, 163, 74);
  doc.text(isSo ? 'Lacagta La Bixiyay:' : 'Paid Amount:', 344, finalY + 62);
  doc.text(formatMoney(invoice.paidAmount), 542, finalY + 62, { align: 'right' });

  doc.setDrawColor(203, 213, 225);
  doc.line(344, finalY + 70, 542, finalY + 70);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(invoice.balanceAmount > 0 ? 220 : 22, invoice.balanceAmount > 0 ? 38 : 163, invoice.balanceAmount > 0 ? 38 : 74);
  doc.text(isSo ? 'Haraaga Dhiman:' : 'Remaining Balance:', 344, finalY + 86);
  doc.text(formatMoney(invoice.balanceAmount), 542, finalY + 86, { align: 'right' });

  // Payment History summary on left if payments exist
  if (payments.length > 0) {
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.text(isSo ? 'Taariikhda Lacag Bixinta' : 'Recorded Payments', 40, finalY + 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    payments.slice(0, 4).forEach((p, idx) => {
      doc.text(
        `${p.paymentNumber} · ${formatDate(p.paymentDate)} · ${formatPaymentMethod(p.paymentMethod, lang)} · ${formatMoney(p.usdEquivalent)}`,
        40,
        finalY + 32 + idx * 14
      );
    });
  }

  // Signature Section
  const sigY = Math.max(finalY + 135, 720);
  doc.setDrawColor(148, 163, 184);
  doc.line(40, sigY, 220, sigY);
  doc.line(360, sigY, 555, sigY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(isSo ? 'Saxiixa & Shaabadda Shirkadda' : 'Authorized Company Signature', 40, sigY + 15);
  doc.text(isSo ? 'Saxiixa Macmiilka' : 'Customer Signature & Acceptance', 360, sigY + 15);

  if (mode === 'print') {
    doc.autoPrint();
    const blobUrl = doc.output('bloburl');
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = String(blobUrl);
    document.body.appendChild(iframe);
  } else {
    doc.save(`${invoice.invoiceNumber}.pdf`);
  }
}

export async function generateReceiptPdf(params: {
  payment: Payment;
  lang: Language;
}): Promise<void> {
  const { payment, lang } = params;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const logoData = await loadLogoBase64();
  const isSo = lang === 'so';

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 595, 90, 'F');
  if (logoData) {
    doc.addImage(logoData, 'JPEG', 40, 18, 52, 52);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.text('KAAH STEEL PROPS & SHORING', logoData ? 108 : 40, 40);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(203, 213, 225);
  doc.text('KM4 Industrial Road, Hodan District, Mogadishu  |  +252 61 500 1001', logoData ? 108 : 40, 58);

  doc.setTextColor(251, 191, 36);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(isSo ? 'RASIIDKA LACAG BIXINTA' : 'PAYMENT RECEIPT', 555, 42, { align: 'right' });
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(11);
  doc.text(payment.paymentNumber, 555, 60, { align: 'right' });

  let y = 130;
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(isSo ? 'Faahfaahinta Rasiidka' : 'Receipt Details', 40, y);

  autoTable(doc, {
    startY: y + 12,
    theme: 'grid',
    body: [
      [isSo ? 'Lambarka Rasiidka' : 'Payment ID', payment.paymentNumber],
      [isSo ? 'Taariikhda Bixinta' : 'Payment Date', formatDate(payment.paymentDate)],
      [isSo ? 'Macmiilka' : 'Customer', `${payment.customer?.name || '—'} (${payment.customer?.companyName || ''})`],
      [isSo ? 'Heshiiska Kirada' : 'Rental Contract', payment.rental?.rentalNumber || '—'],
      [isSo ? 'Lambarka Qaansheegta' : 'Invoice Number', payment.invoice?.invoiceNumber || '—'],
      [isSo ? 'Habka Lacag Bixinta' : 'Payment Method', formatPaymentMethod(payment.paymentMethod, lang)],
      [isSo ? 'Lambarka Tixraaca' : 'Reference Number', payment.referenceNumber || '—'],
      [
        isSo ? 'Qadarka La Bixiyay' : 'Amount Paid',
        payment.currency === 'SOS'
          ? `${formatMoney(payment.amount, 'SOS')} (Rate: ${payment.exchangeRate}) = ${formatMoney(payment.usdEquivalent)}`
          : formatMoney(payment.amount),
      ],
      [isSo ? 'Haraaga Qaansheegta' : 'Remaining Invoice Balance', formatMoney(payment.invoice?.balanceAmount || 0)],
      [isSo ? 'Faallo' : 'Notes', payment.notes || '—'],
    ],
    styles: { fontSize: 10, cellPadding: 8, textColor: [15, 23, 42] },
    columnStyles: { 0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 190 } },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sigY = (doc as any).lastAutoTable.finalY + 70;
  doc.setDrawColor(148, 163, 184);
  doc.line(40, sigY, 220, sigY);
  doc.line(360, sigY, 555, sigY);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(isSo ? 'Xisaabiyaha Qaabilay' : 'Received By (Accountant)', 40, sigY + 15);
  doc.text(isSo ? 'Saxiixa Macmiilka' : 'Customer Signature', 360, sigY + 15);

  doc.save(`${payment.paymentNumber}_Receipt.pdf`);
}

export function exportTableReportPdf(params: {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, 842, 64, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(`Kaah Steel Props — ${params.title}`, 40, 38);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 802, 38, { align: 'right' });

  autoTable(doc, {
    startY: 82,
    head: [params.columns],
    body: params.rows.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
  });

  doc.save(`${params.filename}.pdf`);
}
