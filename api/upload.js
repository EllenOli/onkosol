export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { nome, cpf, pdf_base64 } = req.body || {};
    if (!nome || !cpf || !pdf_base64) {
      return res.status(400).json({ ok: false, error: "Missing fields (nome, cpf, pdf_base64)" });
    }

    const endpoint = process.env.GAS_ENDPOINT;
    const token = process.env.GAS_TOKEN;
    if (!endpoint || !token) {
      return res.status(500).json({ ok: false, error: "Missing GAS_ENDPOINT/GAS_TOKEN in Vercel env" });
    }

    const payload = {
      token,
      pdf_base64,
      nome,
      cpf,
      doc_nome: "Termo_LGPD_Onkosol",
    };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text();

    // O Apps Script devolve JSON como texto
    res.setHeader("Content-Type", "application/json");
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
