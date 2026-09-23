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
  salaryBreakdown?: {
    hra?: number;
    lta_allowance?: number;
    transport_allowance?: number;
    medical_allowance?: number;
    other_allowances?: number;
    variable_pay?: number;
    pf_employer_contribution?: number;
    health_insurance?: number;
    pf_deduction?: number;
    professional_tax?: number;
    tds?: number;
    advance_amount_adjusted?: number;
  };
  companyName?: string;
  companyAddress?: string;
  /** Base64 data URL — jsPDF's addImage() needs actual image data, not a remote URL. */
  logoDataUrl?: string;
  dateOfJoining?: string;
  designation?: string;
  department?: string;
  workedDays?: number;
  bankName?: string;
  bankAccountNumber?: string;
  daysInMonth?: number;
  lossOfPayDays?: number;
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

const BOLD_LABELS = new Set(["Total Gross Salary", "Total CTC", "Total Deductions", "Net Take Home"]);

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const center = pageWidth / 2;

  let currentY = 22;
  const headerStartY = currentY;

  // === HEADER: "Salary Slip" + company identity at top-left, logo at top-right ===
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Salary Slip", margin, currentY);
  currentY += 9;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(data.companyName || "PEOPLO HR", margin, currentY);
  currentY += 7;

  if (data.companyAddress) {
    doc.setTextColor(...COLORS.gray);
    doc.setFontSize(9);
    const addressLines = doc.splitTextToSize(data.companyAddress, contentWidth * 0.55);
    doc.text(addressLines, margin, currentY);
    currentY += addressLines.length * 5;
  }

  if (data.logoDataUrl) {
    try {
      const logoSize = 16;
      doc.addImage(data.logoDataUrl, pageWidth - margin - logoSize, headerStartY - 10, logoSize, logoSize, undefined, "FAST");
    } catch {
      // Malformed/unsupported image data shouldn't block payslip generation.
    }
  }

  currentY += 10;

  // === EARNINGS / DEDUCTIONS FIGURES ===
  const sb = data.salaryBreakdown || {};
  const hra = Number(sb.hra || 0);
  const ltaAllowance = Number(sb.lta_allowance || 0);
  const otherAllowance =
    Number(sb.transport_allowance || 0) + Number(sb.medical_allowance || 0) + Number(sb.other_allowances || 0);
  const variablePay = Number(sb.variable_pay || 0);
  const pfEmployerContribution = Number(sb.pf_employer_contribution || 0);
  const healthInsurance = Number(sb.health_insurance || 0);
  const pfEmployeeContribution = Number(sb.pf_deduction || 0);
  const professionalTax = Number(sb.professional_tax || 0);
  const tds = Number(sb.tds || 0);
  const advanceAmountAdjusted = Number(sb.advance_amount_adjusted || 0);

  const totalGrossSalary = data.basicSalary + hra + ltaAllowance + otherAllowance + variablePay;
  const totalCTC = totalGrossSalary + pfEmployerContribution + healthInsurance;
  const totalDeductions = pfEmployeeContribution + professionalTax + tds + advanceAmountAdjusted;
  const netTakeHome = totalGrossSalary - totalDeductions;

  const daysPayable =
    data.daysInMonth !== undefined ? data.daysInMonth - (data.lossOfPayDays || 0) : undefined;

  // === INFO GRID: joining/bank/days on the left, employee/period details on the right ===
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
    ["Bank Name", data.bankName || "—"],
    ["Bank Account No", data.bankAccountNumber || "—"],
    ["Days in Month", data.daysInMonth !== undefined ? String(data.daysInMonth) : "—"],
    ["Days Payable", daysPayable !== undefined ? String(daysPayable) : "—"],
  ];
  const rightRows: [string, string][] = [
    ["Employee name", data.employeeName],
    ["Designation", data.designation || "—"],
    ["Department", data.department || "—"],
    ["Pay Period", `${data.monthName} ${data.year}`],
    ["Loss of Pay (Days)", data.lossOfPayDays !== undefined ? String(data.lossOfPayDays) : "—"],
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

  currentY += Math.max(leftRows.length, rightRows.length) * rowStep + 12;

  // === EARNINGS / DEDUCTIONS TABLE ===
  const earningsRows: [string, string][] = [["Basic Salary", formatCurrency(data.basicSalary)]];
  if (hra) earningsRows.push(["House Rent Allowance", formatCurrency(hra)]);
  if (ltaAllowance) earningsRows.push(["LTA Allowance", formatCurrency(ltaAllowance)]);
  if (otherAllowance) earningsRows.push(["Other Allowance", formatCurrency(otherAllowance)]);
  if (variablePay) earningsRows.push(["Variable Pay", formatCurrency(variablePay)]);
  earningsRows.push(["Total Gross Salary", formatCurrency(totalGrossSalary)]);
  if (pfEmployerContribution) earningsRows.push(["PF Employer Contribution", formatCurrency(pfEmployerContribution)]);
  if (healthInsurance) earningsRows.push(["Health Insurance", formatCurrency(healthInsurance)]);
  earningsRows.push(["Total CTC", formatCurrency(totalCTC)]);

  const deductionRows: [string, string][] = [];
  if (pfEmployeeContribution) deductionRows.push(["PF Employee Contribution", formatCurrency(pfEmployeeContribution)]);
  if (professionalTax) deductionRows.push(["Professional Tax", formatCurrency(professionalTax)]);
  if (tds) deductionRows.push(["TDS", formatCurrency(tds)]);
  if (advanceAmountAdjusted) deductionRows.push(["Advance Amount Adjusted", formatCurrency(advanceAmountAdjusted)]);
  deductionRows.push(["Total Deductions", formatCurrency(totalDeductions)]);
  deductionRows.push(["Net Take Home", formatCurrency(netTakeHome)]);

  const rowCount = Math.max(earningsRows.length, deductionRows.length);

  const body: string[][] = [];
  for (let i = 0; i < rowCount; i++) {
    const [eLabel, eAmount] = earningsRows[i] || ["", ""];
    const [dLabel, dAmount] = deductionRows[i] || ["", ""];
    body.push([eLabel, eAmount, dLabel, dAmount]);
  }

  const col1Width = 50;
  const col2Width = 40;
  const col3Width = 50;
  const col4Width = contentWidth - col1Width - col2Width - col3Width;

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
      if (cellData.section !== "body") return;
      const rowLabel = cellData.column.index <= 1
        ? earningsRows[cellData.row.index]?.[0]
        : deductionRows[cellData.row.index]?.[0];
      if (rowLabel && BOLD_LABELS.has(rowLabel)) {
        cellData.cell.styles.fontStyle = "bold";
      }
    },
  });

  currentY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 18;

  // === NET TAKE HOME IN WORDS ===
  doc.setTextColor(...COLORS.dark);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(netTakeHome), center, currentY, { align: "center" });
  currentY += 7;
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(amountToWords(netTakeHome), center, currentY, { align: "center" });

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
