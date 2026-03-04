import React, { useMemo, useState } from "react";
import { generateAcceptedPdf } from "./pdf";
import { sha256Hex, toBase64 } from "./crypto";

const TERM_URL = "/termo-lgpd.pdf";

function formatBrasiliaISO(d: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  };

  const parts = new Intl.DateTimeFormat("pt-BR", opts).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")} ${get("hour")}:${get("minute")}:${get("second")}`;
}

function sanitizeCpf(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 11);
}

function downloadBytes(bytes: Uint8Array, filename: string) {
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

async function fetchTermPdf(): Promise<Uint8Array> {
  const res = await fetch(TERM_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("Não consegui carregar o PDF do termo.");
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function uploadToDrive(pdfBytes: Uint8Array, nome: string, cpf: string) {
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      nome,
      cpf,
      pdf_base64: toBase64(pdfBytes),
    }),
  });

  const json = await res.json().catch(() => ({} as any));
  if (!res.ok || !json.ok) {
    throw new Error(json?.error || "Falha ao enviar para o Google Drive.");
  }
  return json;
}

export default function App() {
  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cpfClean = useMemo(() => sanitizeCpf(cpf), [cpf]);
  const cpfOk = useMemo(() => cpfClean.length === 11, [cpfClean]);

  async function handleAccept() {
    setMsg(null);

    const nomeTrim = nome.trim();
    if (!nomeTrim) return setMsg("Preencha seu nome completo.");
    if (!cpfOk) return setMsg("Preencha um CPF válido (11 dígitos).");

    setBusy(true);
    try {
      const basePdf = await fetchTermPdf();
      const now = new Date();
      const acceptedAt = formatBrasiliaISO(now);

      const temp = await generateAcceptedPdf(basePdf, {
        nome: nomeTrim,
        cpf: cpfClean,
        acceptedAtISO: acceptedAt,
        acceptanceId: "TEMP",
      });

      const hash = await sha256Hex(temp);
      const acceptanceId = hash.slice(0, 12).toUpperCase();

      const finalPdf = await generateAcceptedPdf(basePdf, {
        nome: nomeTrim,
        cpf: cpfClean,
        acceptedAtISO: acceptedAt,
        acceptanceId,
      });

      const fileName = `Termo_LGPD_Onkosol_${nomeTrim}_${cpfClean}.pdf`.replace(/\s+/g, " ");
      downloadBytes(finalPdf, fileName);

      await uploadToDrive(finalPdf, nomeTrim, cpfClean);

      setMsg("✅ Aceite registrado e documento salvo. Você já pode fechar esta página.");
    } catch (e: any) {
      setMsg(`❌ ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="header">
        <div className="headerInner">
          <img src="/logo_full.jpeg" className="logo" alt="Onkosol" />
          <div className="headerTitle">
            <h1>Aceite do Termo LGPD</h1>
            <p>
              Leia o documento e confirme seus dados. Um PDF com seu aceite será gerado automaticamente.
            </p>
          </div>
        </div>
      </header>

      <main className="container">
        {/* FORM */}
        <section className="card formCard">
          <div className="formSideImage" aria-hidden="true">
            <img src="/boneco.jpeg" alt="" />
            <div className="formSideOverlay" />
          </div>

          <div className="formContent">
            <div className="field">
              <label>Nome completo *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Digite seu nome completo"
                autoComplete="name"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label>CPF *</label>
              <input
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                placeholder="Somente números"
                inputMode="numeric"
                autoComplete="off"
                disabled={busy}
              />
              <div className="hint">Somente números (11 dígitos).</div>
            </div>

            <button onClick={handleAccept} disabled={busy || !nome.trim() || !cpfOk}>
              {busy ? "Gerando e salvando..." : "Li e concordo — Gerar PDF"}
            </button>

            {msg && <div className="alert">{msg}</div>}

            <div className="privacyNote">
              Ao confirmar, seu aceite será inserido no final do PDF e o documento será salvo de forma privada.
            </div>
          </div>
        </section>

        {/* PDF */}
        <section className="card pdfCard">
          <div className="pdfHeader">
            <span className="dot" />
            <span className="pdfTitle">Visualização do termo</span>
          </div>
          <div className="pdfFrame">
            <iframe src={TERM_URL} title="Termo LGPD Onkosol" />
          </div>
        </section>
      </main>
    </div>
  );
}
