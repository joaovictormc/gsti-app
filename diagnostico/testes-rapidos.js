// Testes rápidos do diagnóstico: disco (escrita sequencial em arquivo temporário),
// rede (DNS, latência e download) e uso de CPU. Nada é alterado no sistema; o arquivo de
// teste é apagado ao final.
const fs = require("fs");
const os = require("os");
const path = require("path");
const dns = require("dns");
const net = require("net");
const crypto = require("crypto");

const MB = 1024 * 1024;
const arred = (n, casas = 1) => Math.round(n * 10 ** casas) / 10 ** casas;

async function testeDisco({ pasta = os.tmpdir(), tamanhoMB = 256 } = {}) {
  const arquivo = path.join(pasta, `gsti-teste-disco-${crypto.randomBytes(4).toString("hex")}.bin`);
  const bloco = crypto.randomBytes(4 * MB); // dados aleatórios: SSDs com compressão não "trapaceiam"
  const blocos = Math.max(1, Math.round(tamanhoMB / 4));
  try {
    const livre = fs.statfsSync ? (() => { const s = fs.statfsSync(pasta); return s.bavail * s.bsize; })() : Infinity;
    if (livre < (blocos * 4 + 512) * MB) return { pulado: true, motivo: "Espaço livre insuficiente para o teste de disco." };

    let fd = fs.openSync(arquivo, "w");
    let inicio = process.hrtime.bigint();
    for (let i = 0; i < blocos; i++) fs.writeSync(fd, bloco);
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    const escritaS = Number(process.hrtime.bigint() - inicio) / 1e9;

    return {
      tamanhoMB: blocos * 4,
      unidade: path.parse(pasta).root,
      escritaMBs: arred((blocos * 4) / escritaS),
      observacao: "Escrita sequencial com gravação forçada no disco (a leitura não é medida: o cache do Windows distorce o resultado).",
    };
  } catch (e) {
    return { erro: e.message };
  } finally {
    fs.rmSync(arquivo, { force: true });
  }
}

function latenciaTcp(host, porta, timeout = 4000) {
  return new Promise((resolve) => {
    const inicio = Date.now();
    const s = net.connect({ host, port: porta });
    const fim = (ms) => { s.destroy(); resolve(ms); };
    s.setTimeout(timeout, () => fim(null));
    s.once("connect", () => fim(Date.now() - inicio));
    s.once("error", () => fim(null));
  });
}

async function testeRede({ urlDownload = "https://speed.cloudflare.com/__down?bytes=10000000", timeout = 20000, baixar = fetch } = {}) {
  const out = { internet: false, dnsMs: null, latenciaMs: null, downloadMbps: null };
  try {
    const t = Date.now();
    await dns.promises.lookup("www.google.com");
    out.dnsMs = Date.now() - t;
  } catch {
    out.erro = "Falha na resolução de nomes (DNS).";
    return out;
  }
  out.latenciaMs = await latenciaTcp("1.1.1.1", 443);
  out.internet = out.latenciaMs != null;
  if (!out.internet) {
    out.erro = "Sem conexão com a internet.";
    return out;
  }
  try {
    const controle = new AbortController();
    const limite = setTimeout(() => controle.abort(), timeout);
    const inicio = Date.now();
    const resp = await baixar(urlDownload, { signal: controle.signal });
    let bytes = 0;
    for await (const parte of resp.body) bytes += parte.length;
    clearTimeout(limite);
    const segundos = (Date.now() - inicio) / 1000;
    out.downloadMbps = arred((bytes * 8) / 1e6 / segundos);
  } catch {
    out.downloadMbps = null;
    out.erroDownload = "Não foi possível medir a velocidade de download.";
  }
  return out;
}

// Uso médio de CPU em uma janela curta
function usoCpu(ms = 1500) {
  const amostra = () => os.cpus().reduce((a, c) => {
    const total = Object.values(c.times).reduce((s, v) => s + v, 0);
    return { ocioso: a.ocioso + c.times.idle, total: a.total + total };
  }, { ocioso: 0, total: 0 });
  return new Promise((resolve) => {
    const a = amostra();
    setTimeout(() => {
      const b = amostra();
      const total = b.total - a.total;
      resolve(total ? arred(100 - ((b.ocioso - a.ocioso) / total) * 100) : null);
    }, ms);
  });
}

async function executarTestes({ disco = true, rede = true, aoProgredir = () => {} } = {}) {
  const r = {};
  aoProgredir("cpu");
  r.cpu = { usoPct: await usoCpu() };
  if (disco) {
    aoProgredir("disco");
    r.disco = await testeDisco();
  }
  if (rede) {
    aoProgredir("rede");
    r.rede = await testeRede();
  }
  return r;
}

module.exports = { testeDisco, testeRede, usoCpu, executarTestes };
