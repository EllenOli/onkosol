import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export type AcceptanceData = {
  nome: string;
  cpf: string;
  acceptedAtISO: string; // America/Sao_Paulo já vem formatado no App
  acceptanceId: string;  // curto, derivado do hash
};

/**
 * Carrega o PDF base e escreve o aceite na ÚLTIMA página.
 */
export async function generateAcceptedPdf(basePdfBytes: Uint8Array, data: AcceptanceData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(basePdfBytes);
  const pages = pdfDoc.getPages();
  if (pages.length === 0) throw new Error("PDF sem páginas.");

  const lastPage = pages[pages.length - 1];
  const { width } = lastPage.getSize();

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const margin = 36;
  const yStart = 72; // rodapé
  const line = 14;

  const title = "ACEITE DO TERMO LGPD — ONKOSOL";
  const body1 = `Eu, ${data.nome} (CPF: ${data.cpf}), declaro que li e concordo com o Termo LGPD.`;
  const body2 = `Data/Hora (Brasília): ${data.acceptedAtISO} • Identificador: ${data.acceptanceId}`;

  // caixa leve
  lastPage.drawRectangle({
    x: margin,
    y: yStart - 10,
    width: width - margin * 2,
    height: 56,
    color: rgb(0.95, 0.97, 1),
    opacity: 0.6,
    borderColor: rgb(0.2, 0.3, 0.6),
    borderWidth: 1,
  });

  lastPage.drawText(title, {
    x: margin + 10,
    y: yStart + 28,
    size: 11,
    font: fontBold,
    color: rgb(0.05, 0.08, 0.18),
  });

  lastPage.drawText(body1, {
    x: margin + 10,
    y: yStart + 12,
    size: 10,
    font,
    color: rgb(0.05, 0.08, 0.18),
    maxWidth: width - margin * 2 - 20,
    lineHeight: line,
  });

  lastPage.drawText(body2, {
    x: margin + 10,
    y: yStart - 2,
    size: 9,
    font,
    color: rgb(0.05, 0.08, 0.18),
    maxWidth: width - margin * 2 - 20,
    lineHeight: line,
  });

  // Metadados (ajuda em auditoria básica)
  pdfDoc.setSubject("Aceite de Termo LGPD — Onkosol");
  pdfDoc.setKeywords(["LGPD", "Onkosol", "Aceite", data.cpf, data.acceptanceId]);

  return await pdfDoc.save();
}
