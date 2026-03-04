export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }

    const { nome, cpf, pdf_base64 } = req.body || {};
    if (!nome || !cpf || !pdf_base64) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const endpoint = process.env.GAS_ENDPOINT;
    const token = process.env.GAS_TOKEN;

    if (!endpoint || !token) {
      return res.status(500).json({ ok: false, error: "Server misconfigured" });
    }

    const payload = {
      token,
      nome,
      cpf,
      doc_nome: "Termo_LGPD",
      pdf_base64,
    };

    const r = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const text = await r.text();

    // Apps Script sempre responde 200, então vamos só devolver o texto
    return res.status(200).send(text);
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
