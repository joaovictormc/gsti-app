// Base das suítes de ponta a ponta: roda o app Electron de verdade com pasta de dados
// isolada, banco PostgreSQL temporário e licença simulada.
//
// Uso (dentro do processo Electron): executarSuite({ nome, roteiro, ... })
// Cada suíte é iniciada pelo tests/e2e/rodar.js.
//
// Banco de testes (nessa ordem):
//   1. GSTI_TEST_PG_URL=postgres://usuario:senha@127.0.0.1:5432
//   2. PGUSER / PGPASSWORD (e PGHOST / PGPORT)
//   3. a conexão do GSTI App instalado neste computador (usa host 127.0.0.1)
// Capturas de tela: GSTI_TEST_CAPTURAS=1 grava PNGs em tests/e2e/saida/<suíte>/.
const path = require("path");
const fs = require("fs");
const os = require("os");
const Module = require("module");
const { app, dialog, shell, BrowserWindow } = require("electron");

const RAIZ = path.resolve(__dirname, "..", "..", "..");
const { Client } = require(path.join(RAIZ, "node_modules", "pg"));

const CAPTURAS = /^(1|true|sim)$/i.test(process.env.GSTI_TEST_CAPTURAS || "");
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

function credenciaisBanco(nomeBanco) {
  const url = process.env.GSTI_TEST_PG_URL;
  if (url) {
    const u = new URL(url);
    return { host: u.hostname, port: Number(u.port || 5432), user: decodeURIComponent(u.username), password: decodeURIComponent(u.password), database: nomeBanco };
  }
  if (process.env.PGUSER) {
    return { host: process.env.PGHOST || "127.0.0.1", port: Number(process.env.PGPORT || 5432), user: process.env.PGUSER, password: process.env.PGPASSWORD || "", database: nomeBanco };
  }
  // Conexão do app instalado (senha cifrada pela chave em "Local State", copiada para a pasta do teste)
  const arquivo = path.join(process.env.APPDATA || "", "gsti-project", "config.json");
  if (!fs.existsSync(arquivo)) {
    throw new Error("Defina GSTI_TEST_PG_URL (ex.: postgres://postgres:senha@127.0.0.1:5432) para rodar os testes.");
  }
  const { safeStorage } = require("electron");
  const d = JSON.parse(fs.readFileSync(arquivo, "utf8")).database;
  const password = d.passwordCifrada ? safeStorage.decryptString(Buffer.from(d.passwordCifrada, "base64")) : d.password;
  return { host: "127.0.0.1", port: 5432, user: d.user, password, database: nomeBanco };
}

// Licença simulada: o teste pode mudar "recursos" durante o roteiro
function simularLicenca(licenca) {
  const original = Module._load;
  Module._load = function (req, parent, ...resto) {
    if (req === "./license-manager") {
      return {
        createLicenseManager: () => ({
          getMachineId: () => "teste",
          evaluate: () => ({ ...licenca }),
          touchLastSeen() {},
          activate: async () => ({ success: true }),
          startTrial: async () => ({ success: true }),
          revalidate: async () => ({ status: { ...licenca }, online: false }),
          deactivate: async () => ({ success: true }),
          serverUrl: () => licenca.serverUrl || "",
        }),
      };
    }
    return original.call(this, req, parent, ...resto);
  };
}

function executarSuite({ nome, banco, roteiro, preparar, fase = null, manterDados = false, criarBanco = true, removerBanco = true, recursos = [] }) {
  const USERDATA = path.join(os.tmpdir(), "gsti-e2e", nome);
  const TMP = path.join(USERDATA, "arquivos");
  const SAIDA = path.join(RAIZ, "tests", "e2e", "saida", nome);
  const BANCO = banco || `gsti_e2e_${nome.replace(/\W/g, "_")}`;

  let falhas = 0;
  let total = 0;
  const ok = (condicao, mensagem, extra) => {
    total++;
    const detalhe = !condicao && extra !== undefined ? " -> " + JSON.stringify(extra).slice(0, 500) : "";
    console.log(`${condicao ? "OK    " : "FALHOU"} [${nome}${fase ? ":" + fase : ""}] ${mensagem}${detalhe}`);
    if (!condicao) falhas++;
  };

  const licenca = { active: true, tipo: "full", plano: "anual", recursos: [...recursos] };
  simularLicenca(licenca);

  // Diálogos e abertura de arquivos simulados (nada aparece na tela)
  const dialogos = [];
  const arquivos = { proximo: null };
  const abertos = [];
  dialog.showErrorBox = (titulo) => dialogos.push(titulo);
  dialog.showOpenDialog = async () => (arquivos.proximo ? { canceled: false, filePaths: [arquivos.proximo] } : { canceled: true, filePaths: [] });
  shell.openPath = async (p) => { abertos.push(p); return ""; };

  process.env.NODE_ENV = "production"; // carrega renderer/dist
  if (!manterDados) fs.rmSync(USERDATA, { recursive: true, force: true });
  fs.mkdirSync(TMP, { recursive: true });
  // Sem GSTI_TEST_PG_URL/PGUSER, a senha do app instalado é aberta com a chave dele
  const localState = path.join(process.env.APPDATA || "", "gsti-project", "Local State");
  if (!process.env.GSTI_TEST_PG_URL && !process.env.PGUSER && fs.existsSync(localState)) {
    fs.copyFileSync(localState, path.join(USERDATA, "Local State"));
  }
  app.setPath("userData", USERDATA);
  app.on("browser-window-created", (_, janela) => janela.hide());

  const configPath = path.join(USERDATA, "config.json");

  app.whenReady().then(async () => {
    let DB;
    const sql = async (consulta, parametros, nomeBanco = BANCO) => {
      const c = new Client({ ...DB, database: nomeBanco });
      await c.connect();
      try {
        return (await c.query(consulta, parametros)).rows;
      } finally {
        await c.end();
      }
    };
    const recriarBanco = async (criar) => {
      await sql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${BANCO}' AND pid <> pg_backend_pid()`, [], "postgres");
      await sql(`DROP DATABASE IF EXISTS ${BANCO}`, [], "postgres");
      if (criar) await sql(`CREATE DATABASE ${BANCO}`, [], "postgres");
    };

    const ctx = {
      RAIZ, USERDATA, TMP, BANCO, fase, licenca, dialogos, arquivos, abertos, espera, ok, sql, configPath,
      lerConfig: () => JSON.parse(fs.readFileSync(configPath, "utf8")),
      recriarBanco,
    };

    try {
      DB = credenciaisBanco(BANCO);
      ctx.DB = DB;
      if (criarBanco) await recriarBanco(true);
      if (preparar) await preparar(ctx);

      require(path.join(RAIZ, "main.js"));
      await espera(800);
      const w = BrowserWindow.getAllWindows()[0];
      if (!w) throw new Error("A janela do app não foi criada.");
      if (w.webContents.isLoading()) await new Promise((res) => w.webContents.once("did-finish-load", res));
      await espera(1500);

      const wc = w.webContents;
      Object.assign(ctx, {
        w,
        wc,
        api: (expressao) => wc.executeJavaScript(`window.api.${expressao}`),
        capturas: CAPTURAS,
        captura: async (arquivo) => {
          if (!CAPTURAS) return;
          fs.mkdirSync(SAIDA, { recursive: true });
          fs.writeFileSync(path.join(SAIDA, arquivo), (await wc.capturePage()).toPNG());
        },
        recarregar: async (ms = 3500) => {
          wc.reload();
          await new Promise((res) => wc.once("did-finish-load", res));
          await espera(ms);
        },
        abrirMenu: async (rotulo) => {
          await wc.executeJavaScript(`(() => { const e = [...document.querySelectorAll('.MuiListItemButton-root')].find(e => e.innerText.trim() === ${JSON.stringify(rotulo)}); e.scrollIntoView(); e.click(); })()`);
          await espera(2500);
        },
        criarAdmin: async () => {
          const r = await ctx.api(`saveInitialConfig(${JSON.stringify({
            dbConfig: DB,
            adminUser: { nome: "Admin Teste", email: "admin@teste.local", login: "admin", password: "Senha#123", confirmPassword: "Senha#123" },
          })})`);
          await espera(4000); // migrações assíncronas
          return r;
        },
        entrar: async (login) => {
          await ctx.api("logout()");
          const r = await ctx.api(`login({ login: "${login}", password: "Senha#123" })`);
          if (!r.success) throw new Error(`login ${login}: ${r.error}`);
          return r.user;
        },
      });
      w.setSize(1280, 800);

      await roteiro(ctx);
    } catch (e) {
      console.log(`ERRO [${nome}${fase ? ":" + fase : ""}] ${e.stack || e}`);
      falhas++;
    }
    if (removerBanco && DB) {
      try {
        await recriarBanco(false);
      } catch (_) {
        /* banco já removido */
      }
    }
    console.log(`== [${nome}${fase ? ":" + fase : ""}] ${total - Math.min(falhas, total)}/${total} OK${falhas ? `, ${falhas} falha(s)` : ""}`);
    app.exit(falhas ? 1 : 0);
  });
}

module.exports = { executarSuite, RAIZ };
