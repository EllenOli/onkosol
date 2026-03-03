import React, { useMemo, useState } from "react";
import { generateAcceptedPdf } from "./pdf";
import { sha256Hex, toBase64 } from "./crypto";

const TERM_URL = "/termo-lgpd.pdf";

function formatBrasiliaISO(d: Date): string {
  // Formato legível, mantendo horário de Brasília (sem depender de libs)
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
  // dd/mm/yyyy HH:MM:SS
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
  if (!res.ok) throw new Error("Não consegui carregar o PDF do termo. Verifique public/termo-lgpd.pdf");
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

async function uploadToDrive(pdfBytes: Uint8Array, nome: string, cpf: string) {
  const endpoint = import.meta.env.VITE_GAS_ENDPOINT as string | undefined;
  const token = import.meta.env.VITE_GAS_TOKEN as string | undefined;
  if (!endpoint || !token) {
    throw new Error("Faltam variáveis VITE_GAS_ENDPOINT / VITE_GAS_TOKEN (configure no Vercel).");
  }

  const payload = {
    token,
    pdf_base64: toBase64(pdfBytes),
    nome,
    cpf,
    doc_name: "Termo_LGPD_Onkosol"
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || "Falha ao enviar para o Google Drive.");
  }
  return json;
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
    if (cpfClean.length !== 11) return setMsg("Preencha um CPF válido (11 dígitos).");

    setBusy(true);
    try {
      const basePdf = await fetchTermPdf();
      const now = new Date();
      const acceptedAt = formatBrasiliaISO(now);

      // Primeiro gera o PDF com o carimbo, depois calcula hash do PDF final (pro acceptanceId)
      const temp = await generateAcceptedPdf(basePdf, {
        nome: nomeTrim,
        cpf: cpfClean,
        acceptedAtISO: acceptedAt,
        acceptanceId: "PENDENTE"
      });

      const hash = await sha256Hex(temp);
      const acceptanceId = hash.slice(0, 12).toUpperCase();

      // Regerar com acceptanceId definitivo
      const finalPdf = await generateAcceptedPdf(basePdf, {
        nome: nomeTrim,
        cpf: cpfClean,
        acceptedAtISO: acceptedAt,
        acceptanceId
      });

      // 1) download pro paciente
      const fileName = `Termo_LGPD_Onkosol_${nomeTrim}_${cpfClean}.pdf`.replace(/\s+/g, " ");
      downloadBytes(finalPdf, fileName);

      // 2) salvar no Drive (privado)
      await uploadToDrive(finalPdf, nomeTrim, cpfClean);

      setMsg("✅ Aceite registrado e documento salvo. Você já pode fechar esta página.");
    } catch (e: any) {
      setMsg(`❌ ${e?.message || String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h1>Onkosol • Aceite do Termo LGPD</h1>
            <p className="small">
              Leia o documento, preencha seus dados e clique em <b>Li e concordo</b>. Um PDF com seu aceite será gerado automaticamente.
            </p>
          </div>
          <span className="badge">Termo LGPD</span>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid">
        <div className="card">
          <label>Nome completo *</label>
          <input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Digite seu nome completo"
            autoComplete="name"
          />

          <label>CPF *</label>
          <input
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            placeholder="Somente números"
            inputMode="numeric"
            autoComplete="off"
          />

          <button onClick={handleAccept} disabled={busy || !nome.trim() || !cpfOk}>
            {busy ? "Gerando e salvando..." : "Li e concordo — Gerar PDF"}
          </button>

          <p className="small" style={{ marginTop: 10 }}>
            Ao confirmar, seu aceite será inserido automaticamente no final do PDF e o documento será salvo de forma privada.
          </p>

          {msg && <div className="alert">{msg}</div>}
        </div>

        <div className="card">
          <p className="small" style={{ marginBottom: 10 }}>
            Visualização do termo:
          </p>
          <iframe src={TERM_URL} title="Termo LGPD Onkosol" />
        </div>
      </div>
    </div>
  );
}
