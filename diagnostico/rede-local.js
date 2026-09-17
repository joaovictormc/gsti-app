// Envio do laudo pela rede local, do agente de diagnóstico para o GSTI App.
//
// Receptor (GSTI App, enquanto a tela "Receber laudo" está aberta):
//   - escuta UDP na PORTA_DESCOBERTA e responde a pedidos de descoberta com nome e porta HTTP;
//   - HTTP em porta aleatória: POST /laudo com o código de 6 dígitos mostrado na tela.
//   - expira após alguns minutos; 5 códigos errados encerram o receptor.
// Agente: descobrir() envia broadcast e lista os GSTI App encontrados; enviar() manda o laudo.
const dgram = require("dgram");
const http = require("http");
const os = require("os");
const crypto = require("crypto");
const { validarLaudo } = require("./laudo");

const PORTA_DESCOBERTA = 47851;
const MAX_BYTES = 3 * 1024 * 1024;
const MSG_DESCOBRIR = "gsti-laudo-descobrir/1";

const gerarCodigo = () => String(crypto.randomInt(0, 1000000)).padStart(6, "0");

function iguais(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function criarReceptor({ nome, aoReceber, minutos = 15, portaDescoberta = PORTA_DESCOBERTA, aoEncerrar = () => {} }) {
  const codigo = gerarCodigo();
  let tentativasErradas = 0;
  let udp = null;
  let servidor = null;
  let timer = null;
  let encerrado = false;

  const encerrar = (motivo = "encerrado") => {
    if (encerrado) return;
    encerrado = true;
    clearTimeout(timer);
    try { udp && udp.close(); } catch { /* já fechado */ }
    try {
      if (servidor) {
        servidor.close();
        servidor.closeAllConnections(); // conexões reaproveitadas (keep-alive) também param de receber
      }
    } catch { /* já fechado */ }
    aoEncerrar(motivo);
  };

  const responder = (res, status, corpo) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(corpo));
  };

  async function iniciar() {
    servidor = http.createServer((req, res) => {
      if (encerrado) return responder(res, 410, { success: false, error: "O recebimento foi encerrado no GSTI App." });
      if (req.method !== "POST" || req.url !== "/laudo") return responder(res, 404, { success: false, error: "Rota inválida." });
      if (!iguais(req.headers["x-gsti-codigo"] || "", codigo)) {
        tentativasErradas++;
        responder(res, 403, { success: false, error: "Código incorreto. Confira o código mostrado no GSTI App." });
        if (tentativasErradas >= 5) encerrar("tentativas");
        return;
      }
      const partes = [];
      let tamanho = 0;
      req.on("data", (p) => {
        tamanho += p.length;
        if (tamanho > MAX_BYTES) {
          responder(res, 413, { success: false, error: "Laudo grande demais." });
          req.destroy();
        } else partes.push(p);
      });
      req.on("end", async () => {
        if (res.headersSent) return;
        let laudo;
        try {
          laudo = JSON.parse(Buffer.concat(partes).toString("utf8"));
        } catch {
          return responder(res, 400, { success: false, error: "Laudo inválido." });
        }
        const v = validarLaudo(laudo);
        if (!v.valido) return responder(res, 422, { success: false, error: v.error || v.erro });
        try {
          const r = (await aoReceber(laudo)) || {};
          responder(res, 200, { success: true, ...r });
        } catch (e) {
          responder(res, 500, { success: false, error: e.message || "O GSTI App não conseguiu salvar o laudo." });
        }
      });
    });
    await new Promise((resolve, reject) => {
      servidor.once("error", reject);
      servidor.listen(0, "0.0.0.0", resolve);
    });
    const portaHttp = servidor.address().port;

    udp = dgram.createSocket({ type: "udp4", reuseAddr: true });
    udp.on("message", (msg, rinfo) => {
      if (msg.toString() !== MSG_DESCOBRIR) return;
      const resposta = Buffer.from(JSON.stringify({ tipo: "gsti-laudo-receptor", v: 1, nome, porta: portaHttp }));
      udp.send(resposta, rinfo.port, rinfo.address);
    });
    await new Promise((resolve, reject) => {
      udp.once("error", reject);
      udp.bind(portaDescoberta, "0.0.0.0", resolve);
    });
    timer = setTimeout(() => encerrar("expirado"), minutos * 60000);
    return { codigo, porta: portaHttp, enderecos: enderecosLocais(), expiraEm: new Date(Date.now() + minutos * 60000).toISOString() };
  }

  return { iniciar, encerrar, codigo };
}

function enderecosLocais() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === "IPv4" && !i.internal)
    .map((i) => i.address)
    .sort((x, y) => Number(!redePrivada(x)) - Number(!redePrivada(y)));
}

// Endereços de broadcast de cada rede local (além do 255.255.255.255)
function enderecosBroadcast() {
  const lista = new Set(["255.255.255.255"]);
  for (const i of Object.values(os.networkInterfaces()).flat()) {
    if (!i || i.family !== "IPv4" || i.internal) continue;
    const ip = i.address.split(".").map(Number);
    const mascara = i.netmask.split(".").map(Number);
    lista.add(ip.map((p, k) => (p & mascara[k]) | (~mascara[k] & 255)).join("."));
  }
  return [...lista];
}

const redePrivada = (ip) => /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

function descobrir({ tempoMs = 2500, destinos = enderecosBroadcast(), porta = PORTA_DESCOBERTA } = {}) {
  return new Promise((resolve) => {
    const encontrados = new Map();
    const udp = dgram.createSocket("udp4");
    udp.on("message", (msg, rinfo) => {
      try {
        const r = JSON.parse(msg.toString());
        if (r.tipo === "gsti-laudo-receptor" && Number(r.porta) > 0) {
          // O mesmo GSTI App pode responder por várias redes (Wi-Fi, cabo, VPN): um item com todos os endereços
          const chave = `${r.nome}:${r.porta}`;
          const item = encontrados.get(chave) || { nome: String(r.nome || "GSTI App").slice(0, 80), porta: Number(r.porta), hosts: [] };
          if (!item.hosts.includes(rinfo.address)) item.hosts.push(rinfo.address);
          // Rede local comum primeiro (192.168.x, 10.x, 172.16-31.x)
          item.hosts.sort((x, y) => Number(!redePrivada(x)) - Number(!redePrivada(y)));
          item.host = item.hosts[0];
          encontrados.set(chave, item);
        }
      } catch { /* ignora respostas que não são do GSTI App */ }
    });
    udp.on("error", () => { /* rede indisponível: devolve o que tiver */ });
    udp.bind(0, () => {
      udp.setBroadcast(true);
      const msg = Buffer.from(MSG_DESCOBRIR);
      for (const d of destinos) udp.send(msg, porta, d, () => {});
    });
    setTimeout(() => {
      try { udp.close(); } catch { /* já fechado */ }
      resolve([...encontrados.values()]);
    }, tempoMs);
  });
}

// Tenta cada endereço do receptor até um responder
async function enviar({ host, hosts, porta, codigo, laudo, timeout = 15000 }) {
  const lista = hosts && hosts.length ? hosts : [host];
  let ultimo;
  for (const h of lista) {
    ultimo = await enviarPara({ host: h, porta, codigo, laudo, timeout });
    if (ultimo.success || !ultimo.semConexao) return ultimo;
  }
  return ultimo;
}

function enviarPara({ host, porta, codigo, laudo, timeout }) {
  return new Promise((resolve) => {
    const corpo = Buffer.from(JSON.stringify(laudo));
    const req = http.request(
      { host, port: porta, method: "POST", path: "/laudo", timeout, agent: false, headers: { Connection: "close", "Content-Type": "application/json", "Content-Length": corpo.length, "x-gsti-codigo": String(codigo || "").trim() } },
      (res) => {
        const partes = [];
        res.on("data", (p) => partes.push(p));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(partes).toString("utf8")));
          } catch {
            resolve({ success: false, error: "Resposta inválida do GSTI App." });
          }
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("tempo esgotado")));
    req.on("error", (e) => resolve({ success: false, semConexao: true, error: `Não foi possível conectar ao GSTI App (${e.message}). Verifique se a tela "Receber laudo" está aberta e se o firewall permite.` }));
    req.end(corpo);
  });
}

module.exports = { PORTA_DESCOBERTA, criarReceptor, descobrir, enviar, enderecosLocais, gerarCodigo };
