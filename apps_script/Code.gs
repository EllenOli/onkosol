/**
 * Onkosol • Aceite LGPD
 * Recebe PDF final (base64) + metadados e salva em uma pasta do Google Drive.
 *
 * Segurança:
 * - Exige um token simples (API_TOKEN) para evitar upload indevido.
 *
 * Importante:
 * - Publique como Web App "Execute as: Me" e "Anyone".
 * - O arquivo será criado como PRIVADO (sem link público).
 */

const FOLDER_ID = "COLE_AQUI_O_ID_DA_PASTA_NO_DRIVE";
const API_TOKEN = "COLE_AQUI_UM_TOKEN_SECRETO_FORTE";

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents || "{}");

    if (!body.token || body.token !== API_TOKEN) {
      return jsonOut({ ok: false, error: "Unauthorized" });
    }

    const pdfBase64 = body.pdf_base64;
    if (!pdfBase64) return jsonOut({ ok: false, error: "Missing pdf_base64" });

    const nome = safeStr(body.nome);
    const cpf = safeStr(body.cpf);
    const docBaseName = safeStr(body.doc_name) || "Termo_LGPD_Onkosol";

    const now = new Date();
    const stamp = Utilities.formatDate(now, "America/Sao_Paulo", "yyyy-MM-dd_HH-mm-ss");
    const fileName = `${docBaseName}_${nome}_${cpf}_${stamp}.pdf`
      .replace(/[\\/:*?"<>|]/g, "-")
      .replace(/\s+/g, " ")
      .trim();

    const bytes = Utilities.base64Decode(pdfBase64);
    const blob = Utilities.newBlob(bytes, "application/pdf", fileName);

    const folder = DriveApp.getFolderById(FOLDER_ID);
    const file = folder.createFile(blob);

    // Mantém PRIVADO (não setSharing). Se quiser compartilhar internamente, faça via Drive.
    return jsonOut({ ok: true, file_id: file.getId() });

  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

function safeStr(v) {
  if (v === null || v === undefined) return "";
  return String(v).trim().slice(0, 200);
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
