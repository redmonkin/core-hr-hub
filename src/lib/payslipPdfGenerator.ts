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
  dateOfJoining?: string;
  designation?: string;
  department?: string;
  workedDays?: number;
}

const formatCurrency = formatCurrencyForPdf;
const COLORS = PDF_COLORS;

const ONES = [
  "Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const rest = n % 10;
  return TENS[tens] + (rest ? " " + ONES[rest] : "");
}

function threeDigitsToWords(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (hundreds) parts.push(ONES[hundreds] + " Hundred");
  if (rest) parts.push(twoDigitsToWords(rest));
  return parts.join(" ");
}

/** Converts a whole rupee amount to words using the Indian numbering system (lakh/crore). */
function amountToWords(amount: number): string {
  let n = Math.round(Math.abs(amount));
  if (n === 0) return "Zero";

  const crore = Math.floor(n / 10000000);
  n %= 10000000;
  const lakh = Math.floor(n / 100000);
  n %= 100000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  const rest = n;

  const parts: string[] = [];
  if (crore) parts.push(threeDigitsToWords(crore) + " Crore");
  if (lakh) parts.push(threeDigitsToWords(lakh) + " Lakh");
  if (thousand) parts.push(threeDigitsToWords(thousand) + " Thousand");
  if (rest) parts.push(threeDigitsToWords(rest));
  return parts.join(" ");
}

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const center = pageWidth / 2;

  let currentY = 22;

  // === HEADER: title, then company identity, all centered ===
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Payslip", center, currentY, { align: "center" });
  currentY += 12;

  if (data.logoDataUrl) {
    try {
      doc.addImage(data.logoDataUrl, center - 7, currentY - 8, 14, 14, undefined, "FAST");
      currentY += 8;
    } catch {
      // Malformed/unsupported image data shouldn't block payslip generation.
    }
  }

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(data.companyName || "PEOPLO HR", center, currentY, { align: "center" });
  currentY += 8;

  if (data.companyAddress) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(10);
    const addressLines = doc.splitTextToSize(data.companyAddress, contentWidth * 0.7);
    doc.text(addressLines, center, currentY, { align: "center" });
    currentY += addressLines.length * 6;
  }

  currentY += 10;

  // === INFO GRID: joining/period/worked-days on the left, employee details on the right ===
  const col1LabelX = margin;
  const col1ValueX = margin + 40;
  const col2LabelX = margin + contentWidth / 2 + 5;
  const col2ValueX = col2LabelX + 42;
  const rowStep = 9;

  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const leftRows: [string, string][] = [
    ["Date of Joining", data.dateOfJoining || "—"],
    ["Pay Period", `${data.monthName} ${data.year}`],
    ["Worked Days", data.workedDays !== undefined ? String(data.workedDays) : "—"],
  ];
  const rightRows: [string, string][] = [
    ["Employee name", data.employeeName],
    ["Designation", data.designation || "—"],
    ["Department", data.department || "—"],
  ];

  leftRows.forEach(([label, value], i) => {
    const y = currentY + i * rowStep;
    doc.text(label, col1LabelX, y);
    doc.text(`: ${value}`, col1ValueX, y);
  });
  rightRows.forEach(([label, value], i) => {
    const y = currentY + i * rowStep;
    doc.text(label, col2LabelX, y);
    doc.text(`: ${value}`, col2ValueX, y);
  });

  currentY += leftRows.length * rowStep + 12;

  // === EARNINGS / DEDUCTIONS TABLE ===
  const earningsRows: [string, string][] = [["Basic", formatCurrency(data.basicSalary)]];
  const sb = data.salaryBreakdown;
  if (sb?.hra) earningsRows.push(["House Rent Allowance", formatCurrency(sb.hra)]);
  if (sb?.transport_allowance) earningsRows.push(["Transport Allowance", formatCurrency(sb.transport_allowance)]);
  if (sb?.medical_allowance) earningsRows.push(["Meal Allowance", formatCurrency(sb.medical_allowance)]);
  if (sb?.other_allowances) earningsRows.push(["Other Allowances", formatCurrency(sb.other_allowances)]);
  if (!sb && data.allowances > 0) earningsRows.push(["Allowances", formatCurrency(data.allowances)]);

  const deductionRows: [string, string][] = [];
  if (sb?.pf_deduction) deductionRows.push(["Provident Fund", formatCurrency(sb.pf_deduction)]);
  if (sb?.tax_deduction) deductionRows.push(["Professional Tax", formatCurrency(sb.tax_deduction)]);
  if (deductionRows.length === 0 && data.deductions > 0) deductionRows.push(["Deductions", formatCurrency(data.deductions)]);

  const rowCount = Math.max(earningsRows.length, deductionRows.length);
  const grossSalary = data.basicSalary + data.allowances;

  const body: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const [eLabel, eAmount] = earningsRows[i] || ["", ""];
    const [dLabel, dAmount] = deductionRows[i] || ["", ""];
    body.push([eLabel, eAmount, dLabel, dAmount]);
  }
  body.push(["Total Earnings", formatCurrency(grossSalary), "Total Deductions", formatCurrency(data.deductions)]);
  body.push(["", "", "Net Pay", formatCurrency(data.netSalary)]);

  const col1Width = 45;
  const col2Width = 40;
  const col3Width = 45;
  const col4Width = contentWidth - col1Width - col2Width - col3Width;
  const totalsRowIndex = body.length - 2;
  const netPayRowIndex = body.length - 1;

  autoTable(doc, {
    startY: currentY,
    margin: { left: margin, right: margin },
    head: [["Earnings", "Amount", "Deductions", "Amount"]],
    body,
    theme: "grid",
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: COLORS.rule,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [230, 232, 236],
      textColor: COLORS.dark,
      fontStyle: "bold",
      fontSize: 10,
      halign: "center",
    },
    columnStyles: {
      0: { cellWidth: col1Width },
      1: { cellWidth: col2Width, halign: "right" },
      2: { cellWidth: col3Width },
      3: { cellWidth: col4Width, halign: "right" },
    },
    didParseCell: (cellData) => {
      if (cellData.section === "body" && (cellData.row.index === totalsRowIndex || cellData.row.index === netPayRowIndex)) {
        cellData.cell.styles.fontStyle = "bold";
        if (cellData.row.index === netPayRowIndex && (cellData.column.index === 0 || cellData.column.index === 1)) {
          cellData.cell.styles.lineWidth = 0;
        }
      }
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // === NET PAY IN WORDS ===
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(data.netSalary), center, currentY, { align: "center" });
  currentY += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(amountToWords(data.netSalary), center, currentY, { align: "center" });

  const pageHeight = doc.internal.pageSize.getHeight();

  // === FOOTER ===
  doc.setDrawColor(...COLORS.ruleLight);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);

  doc.setTextColor(...COLORS.gray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    "This is a computer-generated payslip and does not require a signature.",
    center,
    pageHeight - 25,
    { align: "center" }
  );
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric"
    })}`,
    center,
    pageHeight - 18,
    { align: "center" }
  );

  return doc;
}

export function downloadPayslip(data: PayslipData, filename: string) {
  const doc = generatePayslipPDF(data);
  doc.save(filename);
}
