/**
 * Servidor de ativação de licenças do GSTI App.
 *
 * Mantém a chave PRIVADA (assina licenças) e a lista de clientes pagantes.
 * O app cliente embute apenas a chave PÚBLICA e verifica as licenças offline.
 *
 * Endpoints:
 *   POST /ativar   { email, maquina }  -> licença definitiva (e-mail precisa estar em clientes.json)
 *   POST /trial    { email, maquina }  -> licença de teste de 7 dias (1x por e-mail/máquina)
 *   POST /validar  { token }           -> revalidação (revogação + validade)
 *   GET  /health                       -> verificação de saúde
 *
 * Armazenamento (arquivos locais):
 *   private.key    -> chave privada Ed25519 (NUNCA versionar / NUNCA enviar ao cliente)
 *   clientes.json  -> [{ "email": "x@y.com", "ativo": true, "validade": null }]
 *   trials.json    -> trials já emitidos (gerado automaticamente)
 *
 * Para adicionar um cliente: inclua o e-mail em clientes.json (ativo: true).
 * Para revogar: defina ativo:false (ou remova). A revogação vale na próxima revalidação.
 */
const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3030;
const TRIAL_DIAS = Number(process.env.TRIAL_DIAS || 7);

const PRIVATE_KEY_PATH = path.join(__dirname, "private.key");
const CLIENTES_PATH = path.join(__dirname, "clientes.json");
const TRIALS_PATH = path.join(__dirname, "trials.json");

if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(
    "[FATAL] private.key não encontrado. Rode: node gerar-chaves.js"
  );
  process.exit(1);
}
const privateKey = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY_PATH, "utf8"));
// A pública é derivada da privada (para validar tokens no /validar).
const publicKey = crypto.createPublicKey(privateKey);

// --- Helpers de arquivo ---
function loadJson(p, def) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch (_) {
    return def;
  }
}
function saveJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// --- Helpers de licença ---
const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const b64urlDecode = (str) =>
  Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64");
const normEmail = (e) => String(e || "").trim().toLowerCase();

function emitirLicenca({ email, tipo, validade, maquina }) {
  const payload = {
    email,
    tipo, // "full" | "trial"
    maquina: maquina || null,
    emitidoEm: new Date().toISOString(),
    validade: validade || null, // ISO ou null (sem expiração)
  };
  const payloadB64 = b64url(JSON.stringify(payload));
  const sig = crypto.sign(null, Buffer.from(payloadB64), privateKey);
  return { token: `${payloadB64}.${b64url(sig)}`, license: payload };
}

function decodeToken(token) {
  const [payloadB64, sigB64] = String(token || "").split(".");
  if (!payloadB64 || !sigB64) return null;
  const ok = crypto.verify(null, Buffer.from(payloadB64), publicKey, b64urlDecode(sigB64));
  if (!ok) return null;
  try {
    return JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch (_) {
    return null;
  }
}

const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

// Ativação definitiva: e-mail precisa estar cadastrado em clientes.json
app.post("/ativar", (req, res) => {
  const email = normEmail(req.body && req.body.email);
  const maquina = req.body && req.body.maquina;
  if (!email) return res.status(400).json({ success: false, error: "E-mail obrigatório." });

  const clientes = loadJson(CLIENTES_PATH, []);
  const cliente = clientes.find((c) => normEmail(c.email) === email && c.ativo !== false);
  if (!cliente) {
    return res.status(403).json({
      success: false,
      error: "E-mail não encontrado na base de clientes. Entre em contato com o suporte.",
    });
  }

  const { token, license } = emitirLicenca({
    email,
    tipo: "full",
    validade: cliente.validade || null,
    maquina,
  });
  console.log(`[ativar] Licença definitiva emitida para ${email}`);
  res.json({ success: true, token, license });
});

// Trial de 7 dias: 1x por e-mail ou máquina
app.post("/trial", (req, res) => {
  const email = normEmail(req.body && req.body.email);
  const maquina = String((req.body && req.body.maquina) || "");
  if (!email) return res.status(400).json({ success: false, error: "E-mail obrigatório." });
  if (!maquina) return res.status(400).json({ success: false, error: "Identificador de máquina ausente." });

  const trials = loadJson(TRIALS_PATH, []);
  const jaUsou = trials.find((t) => normEmail(t.email) === email || t.maquina === maquina);
  if (jaUsou) {
    return res.status(403).json({
      success: false,
      error: "Período de teste já utilizado neste e-mail ou nesta máquina.",
    });
  }

  const validade = new Date(Date.now() + TRIAL_DIAS * 86400000).toISOString();
  const { token, license } = emitirLicenca({ email, tipo: "trial", validade, maquina });
  trials.push({ email, maquina, emitidoEm: new Date().toISOString(), validade });
  saveJson(TRIALS_PATH, trials);
  console.log(`[trial] Trial de ${TRIAL_DIAS} dias emitido para ${email} (máquina ${maquina.slice(0, 8)}…)`);
  res.json({ success: true, token, license });
});

// Revalidação: usada periodicamente pelo app para detectar revogação/expiração
app.post("/validar", (req, res) => {
  const payload = decodeToken(req.body && req.body.token);
  if (!payload) {
    return res.json({ valido: false, motivo: "Assinatura inválida." });
  }
  // Expiração
  if (payload.validade && new Date(payload.validade).getTime() < Date.now()) {
    return res.json({ valido: false, motivo: "Licença expirada." });
  }
  // Revogação (apenas para licença definitiva)
  if (payload.tipo === "full") {
    const clientes = loadJson(CLIENTES_PATH, []);
    const cliente = clientes.find((c) => normEmail(c.email) === normEmail(payload.email));
    if (!cliente || cliente.ativo === false) {
      return res.json({ valido: false, motivo: "Licença revogada." });
    }
  }
  res.json({ valido: true });
});

app.listen(PORT, () => {
  console.log(`Servidor de licenças GSTI ouvindo na porta ${PORT}`);
});
