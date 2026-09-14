/**
 * Licenciamento do GSTI App (cliente) — v2.
 *
 * - Ativação online com CHAVE DE LICENÇA (GSTI-XXXX-XXXX-XXXX-XXXX) ou trial por e-mail.
 * - Verificação OFFLINE a cada abertura: assinatura Ed25519 (chave pública por "kid"),
 *   vínculo com este computador, validade, janela de revalidação e anti-retrocesso de relógio.
 * - Revalidação online periódica: aplica revogação/suspensão e recebe token renovado.
 *
 * O servidor (pasta license-server/) detém a chave privada; o app só tem as públicas
 * (license-config.js), então licenças não podem ser forjadas no cliente.
 */
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const { execFileSync } = require("child_process");
const axios = require("axios");
const LICENSE_CONFIG = require("./license-config");

const DIA_MS = 86400000;
const AVISO_REVALIDAR_DIAS = 7;

const b64urlDecode = (str) => Buffer.from(String(str).replace(/-/g, "+").replace(/_/g, "/"), "base64");

// --- Identificador estável do computador ---------------------------------
// Usa o ID do sistema operacional (não muda com VPN/Tailscale, dock ou troca de placa de rede).
function lerIdDoSistema() {
  try {
    if (process.platform === "win32") {
      const out = execFileSync(
        "reg",
        ["query", "HKLM\\SOFTWARE\\Microsoft\\Cryptography", "/v", "MachineGuid", "/reg:64"],
        { encoding: "utf8", windowsHide: true, timeout: 5000 }
      );
      const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-f-]+)/i);
      if (m) return m[1];
    } else if (process.platform === "darwin") {
      const out = execFileSync("ioreg", ["-rd1", "-c", "IOPlatformExpertDevice"], { encoding: "utf8", timeout: 5000 });
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    } else {
      for (const p of ["/etc/machine-id", "/var/lib/dbus/machine-id"]) {
        if (fs.existsSync(p)) return fs.readFileSync(p, "utf8").trim();
      }
    }
  } catch (_) {
    /* cai no fallback */
  }
  return null;
}

let machineIdCache = null;
function getMachineId() {
  if (machineIdCache) return machineIdCache;
  let base = lerIdDoSistema();
  if (!base) {
    const mac = Object.values(os.networkInterfaces())
      .flat()
      .find((ni) => ni && !ni.internal && ni.mac && ni.mac !== "00:00:00:00:00:00");
    base = `${os.hostname()}|${mac ? mac.mac : ""}`;
  }
  machineIdCache = crypto.createHash("sha256").update(`gsti-app|${base}`).digest("hex").slice(0, 32);
  return machineIdCache;
}

// --- Token -----------------------------------------------------------------
// Retorna { payload } se válido, ou { erro, codigo }.
function decodeToken(token) {
  const [payloadB64, sigB64] = String(token || "").split(".");
  if (!payloadB64 || !sigB64) return { erro: "Licença inválida.", codigo: "FORMATO" };
  let payload;
  try {
    payload = JSON.parse(b64urlDecode(payloadB64).toString("utf8"));
  } catch (_) {
    return { erro: "Licença inválida.", codigo: "FORMATO" };
  }
  if (!payload || payload.v !== 2) {
    return { erro: "Licença de uma versão anterior do sistema. Ative novamente com sua chave de licença.", codigo: "VERSAO" };
  }
  const pem = LICENSE_CONFIG.publicKeys[payload.kid];
  if (!pem) {
    return {
      erro:
        "O servidor de licenças usa uma chave que esta versão do GSTI App não reconhece. " +
        "Instale a versão mais recente do aplicativo.",
      codigo: "KID_DESCONHECIDO",
    };
  }
  try {
    const ok = crypto.verify(null, Buffer.from(payloadB64), crypto.createPublicKey(pem), b64urlDecode(sigB64));
    if (!ok) return { erro: "Licença inválida (assinatura).", codigo: "ASSINATURA" };
  } catch (_) {
    return { erro: "Licença inválida (assinatura).", codigo: "ASSINATURA" };
  }
  if (payload.maquina !== getMachineId()) {
    return { erro: "Esta licença foi ativada em outro computador. Ative novamente neste computador.", codigo: "MAQUINA" };
  }
  return { payload };
}

function createLicenseManager({ getConfig, saveConfig, appVersion }) {
  const lic = () => getConfig().license || {};

  const serverUrl = () => String(lic().serverUrl || LICENSE_CONFIG.serverUrl || "").replace(/\/+$/, "");

  function persist(patch) {
    const cfg = getConfig();
    cfg.license = { ...(cfg.license || {}), ...patch };
    saveConfig();
  }

  function limparLicenca() {
    persist({
      token: "", email: "", tipo: "", plano: "", validade: null, detalhes: null,
      activatedAt: null, lastSeen: null, revoked: false, revogadaMotivo: "",
    });
  }

  // Estado atual, só com dados locais.
  function evaluate() {
    const l = lic();
    if (!l.token) return { active: false, motivo: "Sem licença ativada." };

    const d = decodeToken(l.token);
    if (d.erro) return { active: false, motivo: d.erro, codigo: d.codigo };
    const p = d.payload;
    const base = {
      tipo: p.tipo,
      plano: p.plano,
      email: p.email,
      validade: p.validade || null,
      revalidarAte: p.revalidarAte || null,
      detalhes: l.detalhes || null,
      lastSeen: l.lastSeen || null,
    };

    if (l.revoked) return { ...base, active: false, motivo: l.revogadaMotivo || "Licença revogada.", codigo: "REVOGADA" };

    const agora = Date.now();
    if (l.lastSeen && agora < new Date(l.lastSeen).getTime() - DIA_MS) {
      return {
        ...base,
        active: false,
        motivo: "Relógio do sistema inconsistente. Corrija a data/hora e conecte-se à internet para revalidar.",
        codigo: "RELOGIO",
      };
    }

    let diasRestantes = null;
    if (p.validade) {
      const exp = new Date(p.validade).getTime();
      if (exp < agora) {
        return {
          ...base,
          active: false,
          diasRestantes: 0,
          motivo: p.tipo === "trial" ? "Período de teste expirado." : "Licença expirada. Renove para continuar usando.",
          codigo: "EXPIRADA",
        };
      }
      diasRestantes = Math.ceil((exp - agora) / DIA_MS);
    }

    let diasParaRevalidar = null;
    if (p.revalidarAte) {
      const limite = new Date(p.revalidarAte).getTime();
      if (limite < agora) {
        return {
          ...base,
          active: false,
          diasRestantes,
          motivo: "A licença precisa ser revalidada. Conecte-se à internet e tente novamente.",
          codigo: "REVALIDAR",
        };
      }
      diasParaRevalidar = Math.ceil((limite - agora) / DIA_MS);
    }

    return {
      ...base,
      active: true,
      diasRestantes,
      diasParaRevalidar,
      avisoRevalidar: diasParaRevalidar != null && diasParaRevalidar <= AVISO_REVALIDAR_DIAS,
    };
  }

  // Atualiza lastSeen (só avança) — base do anti-retrocesso de relógio.
  function touchLastSeen() {
    const l = lic();
    if (!l.token) return;
    const agora = new Date();
    if (!l.lastSeen || agora > new Date(l.lastSeen)) {
      try {
        persist({ lastSeen: agora.toISOString() });
      } catch (_) {
        /* ignora falha de escrita */
      }
    }
  }

  function erroDeRede(err, padrao) {
    if (err.response && err.response.data) {
      return err.response.data.error || err.response.data.motivo || padrao;
    }
    return "Não foi possível contatar o servidor de licenças. Verifique sua conexão com a internet.";
  }

  async function post(rota, corpo, timeout = 15000) {
    if (!serverUrl()) throw new Error("Servidor de licenças não configurado.");
    const { data } = await axios.post(serverUrl() + rota, corpo, { timeout });
    return data;
  }

  // Salva um token recebido do servidor após conferir assinatura e vínculo com a máquina.
  function aceitarToken(token, extras = {}) {
    const d = decodeToken(token);
    if (d.erro) return { success: false, error: d.erro };
    const p = d.payload;
    const agora = new Date().toISOString();
    persist({
      token,
      email: p.email,
      tipo: p.tipo,
      plano: p.plano,
      validade: p.validade || null,
      revoked: false,
      revogadaMotivo: "",
      lastSeen: agora,
      ...extras,
    });
    return { success: true };
  }

  function resumo() {
    const s = evaluate();
    return {
      tipo: s.tipo,
      plano: s.plano,
      email: s.email,
      validade: s.validade,
      diasRestantes: s.diasRestantes,
    };
  }

  async function activate(chave) {
    if (!String(chave || "").trim()) return { success: false, error: "Informe a chave de licença." };
    try {
      const data = await post("/v2/ativar", {
        chave: String(chave).trim(),
        maquinaId: getMachineId(),
        nomeMaquina: os.hostname(),
        appVersao: appVersion,
      });
      if (!data || !data.success || !data.token) return { success: false, error: (data && data.error) || "Falha na ativação." };
      const r = aceitarToken(data.token, { detalhes: data.detalhes || null, activatedAt: new Date().toISOString() });
      return r.success ? { success: true, license: resumo() } : r;
    } catch (err) {
      return { success: false, error: erroDeRede(err, "Falha na ativação.") };
    }
  }

  async function startTrial(email) {
    const e = String(email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { success: false, error: "Informe um e-mail válido." };
    try {
      const data = await post("/v2/trial", { email: e, maquinaId: getMachineId() });
      if (!data || !data.success || !data.token) return { success: false, error: (data && data.error) || "Falha ao iniciar o teste." };
      const r = aceitarToken(data.token, { detalhes: null, activatedAt: new Date().toISOString() });
      return r.success ? { success: true, license: resumo() } : r;
    } catch (err) {
      return { success: false, error: erroDeRede(err, "Falha ao iniciar o teste.") };
    }
  }

  // Revalidação online. Sem conexão, mantém o estado local (dentro da janela offline).
  async function revalidate() {
    const l = lic();
    if (!l.token) return { status: evaluate(), online: false };
    try {
      const data = await post("/v2/validar", { token: l.token }, 10000);
      if (data && data.valido === false) {
        persist({ revoked: true, revogadaMotivo: data.motivo || "Licença inválida." });
      } else if (data && data.valido === true) {
        if (data.token) aceitarToken(data.token, { detalhes: data.detalhes || l.detalhes || null });
        else persist({ revoked: false, revogadaMotivo: "", lastSeen: new Date().toISOString() });
      }
      return { status: evaluate(), online: true };
    } catch (err) {
      // 410 = servidor rejeitou a rota (app desatualizado); demais erros = offline.
      if (err.response && err.response.status === 410) {
        persist({ revoked: true, revogadaMotivo: erroDeRede(err, "Aplicativo desatualizado.") });
      }
      return { status: evaluate(), online: !!err.response };
    }
  }

  // Libera a vaga deste computador no servidor (transferência de licença).
  async function deactivate() {
    const l = lic();
    if (!l.token) return { success: true };
    try {
      await post("/v2/desativar", { token: l.token });
    } catch (err) {
      if (!err.response) {
        return { success: false, error: "É preciso estar conectado à internet para transferir a licença." };
      }
      // Token rejeitado pelo servidor (ex.: já inválido) — segue limpando localmente.
    }
    limparLicenca();
    return { success: true };
  }

  return { getMachineId, evaluate, touchLastSeen, activate, startTrial, revalidate, deactivate, serverUrl };
}

module.exports = { createLicenseManager, getMachineId };
