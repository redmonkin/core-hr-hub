// Shared PDF styling so every generated document (payslips, reports, exports)
// reads as one consistent, formal system instead of each file reinventing its
// own header/footer/colors.

// jsPDF's built-in Helvetica font has no Rupee glyph — Intl's "₹" renders as
// a broken superscript in the PDF, so format the number ourselves and prefix
// "Rs." as plain ASCII text instead of using style: "currency". Use this
// (not the on-screen ₹ formatter) for any amount drawn into a PDF.
export const formatCurrencyForPdf = (amount: number) => {
  const formatted = new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `Rs. ${formatted}`;
};

export const PDF_COLORS = {
  accent: [51, 65, 85] as [number, number, number], // Slate
  rule: [203, 213, 225] as [number, number, number], // Light slate rule
  ruleLight: [226, 232, 240] as [number, number, number],
  gray: [100, 116, 139] as [number, number, number],
  dark: [15, 23, 42] as [number, number, number],
};

// autoTable headStyles/alternateRowStyles shared across every report table.
export const PDF_TABLE_HEAD_STYLE = {
  fillColor: PDF_COLORS.accent,
  textColor: [255, 255, 255] as [number, number, number],
  fontStyle: "bold" as const,
  fontSize: 9,
};

export const PDF_TABLE_ALT_ROW_STYLE = {
  fillColor: [248, 250, 252] as [number, number, number],
};

export interface PdfBrandingInfo {
  companyName?: string;
  companyAddress?: string;
  logoDataUrl?: string;
}

interface DrawPdfHeaderOptions extends PdfBrandingInfo {
  title: string;
  subtitle?: string;
  pageWidth: number;
  margin: number;
}

/**
 * Draws the standard document header (company branding on the left, document
 * title/subtitle on the right, thin accent rule beneath) and returns the Y
 * position content should continue from.
 */
export function drawPdfHeader(
  doc: import("jspdf").jsPDF,
  { title, subtitle, companyName, companyAddress, logoDataUrl, pageWidth, margin }: DrawPdfHeaderOptions
): number {
  // Logo is a small mark alongside the name, not a replacement for it — the
  // name/address still need to render even when a logo is present.
  let textX = margin;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, margin, 6, 14, 14, undefined, "FAST");
      textX = margin + 18;
    } catch {
      // Malformed/unsupported image data shouldn't block report generation.
    }
  }

  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(companyName || "PEOPLO HR", textX, 15);

  if (companyAddress) {
    doc.setTextColor(...PDF_COLORS.gray);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(companyAddress, textX, 21, { maxWidth: pageWidth / 2 - textX });
  }

  doc.setTextColor(...PDF_COLORS.dark);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, pageWidth - margin, 15, { align: "right" });

  if (subtitle) {
    doc.setTextColor(...PDF_COLORS.gray);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(subtitle, pageWidth - margin, 21, { align: "right" });
  }

  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, 36, pageWidth - margin, 36);

  return 48;
}

interface DrawPdfFooterOptions {
  pageWidth: number;
  pageHeight: number;
  margin: number;
  pageNumber?: number;
  totalPages?: number;
}

/** Draws the standard "Generated on <date>" + page-number footer. */
export function drawPdfFooter(
  doc: import("jspdf").jsPDF,
  { pageWidth, pageHeight, margin, pageNumber, totalPages }: DrawPdfFooterOptions
): void {
  doc.setDrawColor(...PDF_COLORS.ruleLight);
  doc.setLineWidth(0.3);
  doc.line(margin, pageHeight - 18, pageWidth - margin, pageHeight - 18);

  doc.setTextColor(...PDF_COLORS.gray);
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  doc.text(
    `Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}`,
    margin,
    pageHeight - 10
  );

  if (pageNumber && totalPages) {
    doc.setFont("helvetica", "normal");
    doc.text(`Page ${pageNumber} of ${totalPages}`, pageWidth - margin, pageHeight - 10, { align: "right" });
  }
}

/**
 * Fetches an image URL and converts it to a base64 data URL, since jsPDF's
 * addImage() needs actual image data rather than a remote URL. Returns
 * undefined on any failure so a missing/broken logo never blocks PDF
 * generation.
 */
export async function fetchImageAsDataUrl(url?: string | null): Promise<string | undefined> {
  if (!url) return undefined;
  try {
    const response = await fetch(url);
    if (!response.ok) return undefined;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}
