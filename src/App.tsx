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
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "";

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
  const res = await fetch(TERM_URL);
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

  const json = await res.json();

  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Falha ao enviar para o Google Drive.");
  }
}

export default function App() {

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cpfOk = useMemo(() => sanitizeCpf(cpf).length === 11, [cpf]);

  async function handleAccept() {

    setMsg(null);

    const nomeTrim = nome.trim();
    const cpfClean = sanitizeCpf(cpf);

    if (!nomeTrim) return setMsg("Preencha seu nome completo.");
    if (cpfClean.length !== 11) return setMsg("Preencha um CPF válido.");

    setBusy(true);

    try {

      const basePdf = await fetchTermPdf();
      const now = new Date();
      const acceptedAt = formatBrasiliaISO(now);

      const temp = await generateAcceptedPdf(basePdf, {
        nome: nomeTrim,
        cpf: cpfClean,
        acceptedAtISO: acceptedAt,
        acceptanceId: "TEMP"
      });

      const hash = await sha256Hex(temp);
      const acceptanceId = hash.slice(0, 12).toUpperCase();

      const finalPdf = await generateAcceptedPdf(basePdf, {
        nome: nomeTrim,
        cpf: cpfClean,
        acceptedAtISO: acceptedAt,
        acceptanceId
      });

      const fileName = `Termo_LGPD_Onkosol_${nomeTrim}_${cpfClean}.pdf`;
      downloadBytes(finalPdf, fileName);

      await uploadToDrive(finalPdf, nomeTrim, cpfClean);

      setMsg("✅ Aceite registrado e documento salvo.");

    } catch (e: any) {
      setMsg(`❌ ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (

    <div className="page">

      <header className="header">

        <img src="/logo_full.jpeg" className="logo" />

      </header>

      <div className="container">

        <div className="card formCard">

          <img src="/boneco.jpeg" className="illustration"/>

          <h1>Aceite do Termo LGPD</h1>

          <p className="subtitle">
            Leia o documento e confirme seu aceite para continuar seu atendimento.
          </p>

          <label>Nome completo *</label>

          <input
            value={nome}
            onChange={(e)=>setNome(e.target.value)}
            placeholder="Digite seu nome completo"
          />

          <label>CPF *</label>

          <input
            value={cpf}
            onChange={(e)=>setCpf(e.target.value)}
            placeholder="Somente números"
          />

          <button
            disabled={busy || !nome.trim() || !cpfOk}
            onClick={handleAccept}
          >
            {busy ? "Gerando..." : "Li e concordo"}
          </button>

          {msg && <div className="alert">{msg}</div>}

        </div>

        <div className="card pdfCard">

          <iframe src={TERM_URL}/>

        </div>

      </div>

    </div>

  );
}
