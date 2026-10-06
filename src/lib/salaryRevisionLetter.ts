import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, parseISO } from "date-fns";
import { PDF_COLORS, PDF_TABLE_HEAD_STYLE, drawPdfFooter, drawPdfHeader, formatCurrencyForPdf } from "./pdfTheme";
import {
  COMPONENT_FIELDS,
  formatPercent,
  grossOf,
  netOf,
  percentChange,
  revisionTypeLabel,
  type SalaryComponents,
} from "./salaryRevision";

export interface SalaryRevisionLetterData {
  employeeName: string;
  employeeFirstName: string;
  employeeCode?: string | null;
  designation?: string | null;
  department?: string | null;
  revisionType: string;
  /** yyyy-MM-dd */
  effectiveFrom: string;
  /** yyyy-MM-dd; the day the revision was agreed */
  letterDate: string;
  previous: SalaryComponents;
  revised: SalaryComponents;
  companyName?: string;
  companyAddress?: string;
  logoDataUrl?: string;
}

const longDate = (iso: string) => format(parseISO(iso), "d MMMM yyyy");

export function generateSalaryRevisionLetter(data: SalaryRevisionLetterData): jsPDF {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const textWidth = pageWidth - margin * 2;

  let y = drawPdfHeader(doc, {
    title: "Salary Revision Letter",
    subtitle: `Effective ${longDate(data.effectiveFrom)}`,
    companyName: data.companyName,
    companyAddress: data.companyAddress,
    logoDataUrl: data.logoDataUrl,
    pageWidth,
    margin,
  });

  const oldGross = grossOf(data.previous);
  const newGross = grossOf(data.revised);
  const change = percentChange(oldGross, newGross);
  const isRaise = newGross > oldGross;

  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(longDate(data.letterDate), pageWidth - margin, y, { align: "right" });

  doc.setFont("helvetica", "bold");
  doc.text(data.employeeName, margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...PDF_COLORS.gray);
  const details = [
    data.employeeCode ? `Employee ID: ${data.employeeCode}` : null,
    data.designation ?? null,
    data.department ?? null,
  ].filter((line): line is string => !!line);
  details.forEach((line, i) => doc.text(line, margin, y + 5 + i * 5));
  y += 5 + details.length * 5 + 8;

  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFont("helvetica", "bold");
  doc.text("Subject: Revision of salary", margin, y);
  y += 9;

  doc.setFont("helvetica", "normal");
  const reasonText = revisionTypeLabel(data.revisionType).toLowerCase();
  const paragraphs = [
    `Dear ${data.employeeFirstName},`,
    isRaise
      ? `We are pleased to inform you that, following your ${reasonText}, your salary has been revised with effect from ${longDate(data.effectiveFrom)}. Your revised monthly salary is set out below.`
      : `This is to confirm that, following a ${reasonText}, your salary has been revised with effect from ${longDate(data.effectiveFrom)}. Your revised monthly salary is set out below.`,
  ];
  for (const paragraph of paragraphs) {
    const lines = doc.splitTextToSize(paragraph, textWidth) as string[];
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  const money = (n: number) => formatCurrencyForPdf(n);
  const body: (string | { content: string; styles: Record<string, unknown> })[][] = [];
  const bold = (s: string) => ({ content: s, styles: { fontStyle: "bold" } });

  for (const field of COMPONENT_FIELDS.filter((f) => f.kind === "earning")) {
    if (!data.previous[field.key] && !data.revised[field.key]) continue;
    body.push([field.label, money(data.previous[field.key]), money(data.revised[field.key])]);
  }
  body.push([bold("Gross salary"), bold(money(oldGross)), bold(money(newGross))]);
  for (const field of COMPONENT_FIELDS.filter((f) => f.kind === "deduction")) {
    if (!data.previous[field.key] && !data.revised[field.key]) continue;
    body.push([`Less: ${field.label}`, money(data.previous[field.key]), money(data.revised[field.key])]);
  }
  body.push([bold("Net take-home"), bold(money(netOf(data.previous))), bold(money(netOf(data.revised)))]);
  body.push(["Annual gross", money(oldGross * 12), money(newGross * 12)]);

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Monthly component", "Current", "Revised"]],
    body,
    theme: "grid",
    headStyles: PDF_TABLE_HEAD_STYLE,
    styles: { fontSize: 9, cellPadding: 2.5, lineColor: PDF_COLORS.ruleLight, textColor: PDF_COLORS.dark },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  if (change !== null) {
    doc.text(`Change in monthly gross salary: ${formatPercent(change)}`, margin, y);
    y += 8;
  }

  const closing = [
    "All other terms and conditions of your employment remain unchanged. Please treat this letter and its contents as confidential.",
    isRaise ? "We thank you for your contribution and wish you continued success." : "Please reach out to HR if you have any questions.",
  ];
  for (const paragraph of closing) {
    const lines = doc.splitTextToSize(paragraph, textWidth) as string[];
    doc.text(lines, margin, y);
    y += lines.length * 5 + 4;
  }

  y += 8;
  doc.text(`For ${data.companyName || "the company"}`, margin, y);
  doc.setFont("helvetica", "bold");
  doc.text("Human Resources", margin, y + 14);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_COLORS.gray);
  doc.text("This is a system-generated letter and does not require a signature.", margin, y + 20);

  drawPdfFooter(doc, { pageWidth, pageHeight, margin });
  return doc;
}

export function downloadSalaryRevisionLetter(data: SalaryRevisionLetterData) {
  const doc = generateSalaryRevisionLetter(data);
  const safeName = data.employeeName.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
  doc.save(`Salary-Revision-${safeName}-${data.effectiveFrom}.pdf`);
}
