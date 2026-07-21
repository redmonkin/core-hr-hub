import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { PDF_COLORS, formatCurrencyForPdf } from "./pdfTheme";

interface PayslipData {
  employeeName: string;
  employeeCode: string;
  employeeEmail: string;
  monthName: string;
  year: number;
  status: string;
  paidAt?: string;
  basicSalary: number;
  allowances: number;
  deductions: number;
  netSalary: number;
  salaryBreakdown?: {
    hra?: number;
    transport_allowance?: number;
    medical_allowance?: number;
    other_allowances?: number;
    tax_deduction?: number;
    pf_deduction?: number;
  };
  companyName?: string;
  companyAddress?: string;
  /** Base64 data URL — jsPDF's addImage() needs actual image data, not a remote URL. */
  logoDataUrl?: string;
}

const formatCurrency = formatCurrencyForPdf;

// A single restrained accent, plus neutrals — a formal, bank-statement style
// palette rather than a dashboard's semantic green/red coding. Shared with
// every other generated PDF via src/lib/pdfTheme.ts.
const COLORS = PDF_COLORS;

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;

  // === HEADER SECTION ===
  // Logo is a small mark alongside the name, not a replacement for it — the
  // name still needs to render even when a logo is present.
  let textX = margin;
  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, margin, 12, 14, 14, undefined, "FAST");
      textX = margin + 18;
    } catch {
      // Malformed/unsupported image data shouldn't block payslip generation.
    }
  }

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(data.companyName || "PEOPLO HR", textX, 24);

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("MONTHLY STATEMENT OF EARNINGS", textX, 31);

  const statusText = data.status.charAt(0).toUpperCase() + data.status.slice(1);
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.monthName} ${data.year}`, pageWidth - margin, 24, { align: "right" });

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Status: ${statusText}`, pageWidth - margin, 31, { align: "right" });

  let ruleY = 38;
  if (data.companyAddress) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.text(data.companyAddress, margin, 36, { maxWidth: contentWidth / 2 - 10 });
    ruleY = 42;
  }

  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, ruleY, pageWidth - margin, ruleY);

  let currentY = ruleY + 14;

  // === EMPLOYEE DETAILS SECTION ===
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE DETAILS", margin, currentY);

  doc.setDrawColor(...COLORS.ruleLight);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY + 3, pageWidth - margin, currentY + 3);

  const detailsY = currentY + 15;
  const col1X = margin;
  const col2X = margin + contentWidth / 2;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  doc.setTextColor(...COLORS.gray);
  doc.text("Name", col1X, detailsY);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.text(data.employeeName, col1X + 32, detailsY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text("Email", col1X, detailsY + 9);
  doc.setTextColor(...COLORS.dark);
  doc.text(data.employeeEmail, col1X + 32, detailsY + 9);

  doc.setTextColor(...COLORS.gray);
  doc.text("Employee ID", col2X, detailsY);
  doc.setTextColor(...COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.text(data.employeeCode, col2X + 32, detailsY);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.gray);
  doc.text("Pay Period", col2X, detailsY + 9);
  doc.setTextColor(...COLORS.dark);
  doc.text(`${data.monthName} ${data.year}`, col2X + 32, detailsY + 9);

  currentY += 38;

  // === EARNINGS & DEDUCTIONS SIDE BY SIDE ===
  const halfWidth = (contentWidth - 10) / 2;

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EARNINGS", margin, currentY);
  doc.text("DEDUCTIONS", margin + halfWidth + 10, currentY);

  doc.setDrawColor(...COLORS.ruleLight);
  doc.setLineWidth(0.3);
  doc.line(margin, currentY + 3, margin + halfWidth, currentY + 3);
  doc.line(margin + halfWidth + 10, currentY + 3, pageWidth - margin, currentY + 3);

  // Earnings table
  const earningsBody: [string, string][] = [
    ["Basic Salary", formatCurrency(data.basicSalary)],
  ];

  if (data.salaryBreakdown) {
    const sb = data.salaryBreakdown;
    if (sb.hra) earningsBody.push(["House Rent Allowance", formatCurrency(sb.hra)]);
    if (sb.transport_allowance) earningsBody.push(["Transport Allowance", formatCurrency(sb.transport_allowance)]);
    if (sb.medical_allowance) earningsBody.push(["Medical Allowance", formatCurrency(sb.medical_allowance)]);
    if (sb.other_allowances) earningsBody.push(["Other Allowances", formatCurrency(sb.other_allowances)]);
  } else if (data.allowances > 0) {
    earningsBody.push(["Allowances", formatCurrency(data.allowances)]);
  }

  const grossSalary = data.basicSalary + data.allowances;
  earningsBody.push(["Gross Salary", formatCurrency(grossSalary)]);

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: margin },
    tableWidth: halfWidth,
    head: [],
    body: earningsBody,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: halfWidth - 40, textColor: COLORS.gray },
      1: { cellWidth: 40, halign: "right", textColor: COLORS.dark },
    },
    didParseCell: (cellData) => {
      if (cellData.row.index === earningsBody.length - 1) {
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.textColor = COLORS.dark;
      }
    },
    didDrawCell: (cellData) => {
      if (cellData.row.index === earningsBody.length - 1 && cellData.column.index === 0) {
        doc.setDrawColor(...COLORS.rule);
        doc.setLineWidth(0.3);
        doc.line(margin, cellData.cell.y, margin + halfWidth, cellData.cell.y);
      }
    },
  });

  const earningsFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY + 8;

  // Deductions table
  const deductionsBody: [string, string][] = [];

  if (data.salaryBreakdown) {
    const sb = data.salaryBreakdown;
    if (sb.tax_deduction) deductionsBody.push(["Tax Deduction", formatCurrency(sb.tax_deduction)]);
    if (sb.pf_deduction) deductionsBody.push(["PF Deduction", formatCurrency(sb.pf_deduction)]);
  }

  if (deductionsBody.length > 0) {
    deductionsBody.push(["Total Deductions", formatCurrency(data.deductions)]);
  } else {
    deductionsBody.push(["No Deductions", formatCurrency(0)]);
  }

  autoTable(doc, {
    startY: currentY + 8,
    margin: { left: margin + halfWidth + 10 },
    tableWidth: halfWidth,
    head: [],
    body: deductionsBody,
    theme: "plain",
    styles: {
      fontSize: 9,
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: halfWidth - 40, textColor: COLORS.gray },
      1: { cellWidth: 40, halign: "right", textColor: COLORS.dark },
    },
    didParseCell: (cellData) => {
      if (cellData.row.index === deductionsBody.length - 1) {
        cellData.cell.styles.fontStyle = "bold";
        cellData.cell.styles.textColor = COLORS.dark;
      }
    },
    didDrawCell: (cellData) => {
      if (cellData.row.index === deductionsBody.length - 1 && cellData.column.index === 0) {
        doc.setDrawColor(...COLORS.rule);
        doc.setLineWidth(0.3);
        doc.line(margin + halfWidth + 10, cellData.cell.y, pageWidth - margin, cellData.cell.y);
      }
    },
  });

  const deductionsFinalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY + 8;

  // Net pay box sits directly below whichever column (earnings/deductions) ran longer.
  currentY = Math.max(earningsFinalY, deductionsFinalY) + 12;

  // === NET PAY SECTION ===
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.8);
  doc.roundedRect(margin, currentY, contentWidth, 30, 2, 2, "S");

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("NET SALARY", margin + 12, currentY + 18);

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(data.netSalary), pageWidth - margin - 12, currentY + 19, { align: "right" });

  // Payment date if paid
  if (data.paidAt && data.status === "paid") {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(`Paid on: ${data.paidAt}`, margin + 12, currentY + 26);
  }

  currentY += 45;

  // === FOOTER ===
  doc.setDrawColor(...COLORS.ruleLight);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a computer-generated payslip and does not require a signature.",
    pageWidth / 2,
    pageHeight - 25,
    { align: "center" }
  );
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })}`,
    pageWidth / 2,
    pageHeight - 18,
    { align: "center" }
  );

  return doc;
}

export function downloadPayslip(data: PayslipData, filename: string) {
  const doc = generatePayslipPDF(data);
  doc.save(filename);
}
