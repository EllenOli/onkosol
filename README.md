# Onkosol • Aceite do Termo LGPD (Vercel + Google Drive)

Este projeto publica uma página (Vercel) para o paciente:
1) visualizar o termo LGPD (PDF),
2) preencher **Nome** e **CPF**,
3) clicar em **"Li e concordo"**,
4) gerar um **PDF final** com o aceite inserido automaticamente **na última página**,
5) fazer o download e **salvar automaticamente no Google Drive** (conta `ellenplush@gmail.com`) via Google Apps Script.

## 1) Colocar o PDF do termo
Substitua o arquivo:
- `public/termo-lgpd.pdf`

pelo seu termo real (mesmo nome).

> Eu incluí um PDF placeholder só para o build não quebrar.

## 2) Backend gratuito: Google Apps Script (salva no Drive)
Crie um projeto no Apps Script logada em `ellenplush@gmail.com` e cole o conteúdo de `apps_script/Code.gs`.

Depois:
- Deploy → New deployment → **Web app**
- Execute as: **Me**
- Who has access: **Anyone**
Copie a URL do Web App (endpoint).

No código do Apps Script, configure:
- `FOLDER_ID` (id da pasta "Onkosol - Termos LGPD")
- `API_TOKEN` (um token secreto forte)

## 3) Configurar variáveis de ambiente no Vercel
No Vercel → Project → Settings → Environment Variables:

- `VITE_GAS_ENDPOINT` = URL do Apps Script (termina com `/exec`)
- `VITE_GAS_TOKEN` = o mesmo token do `API_TOKEN` no Apps Script

## 4) Rodar local
```bash
npm install
npm run dev
```

## 5) Deploy no Vercel
Importe o repositório no Vercel.
Framework: Vite (autodetect)
Build: `npm run build`
Output: `dist`

## Observação de privacidade
O Apps Script salva o PDF **privado** no seu Drive (não cria link público). O paciente baixa o PDF diretamente pelo navegador.
