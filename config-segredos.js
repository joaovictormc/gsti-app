// Senhas do config.json gravadas cifradas.
// O "cofre" é o safeStorage do Electron (DPAPI no Windows): a chave fica no arquivo
// "Local State" da pasta de dados do app, protegida pelo usuário do Windows. Em memória a configuração continua
// com as senhas em texto, então o restante do app não muda.

const CAMPOS_SECRETOS = [
  ["database", "password"],
  ["email", "pass"],
  ["fiscal", "certificadoSenha"],
  ["fiscal", "credenciais"], // objeto { idDoEmissor: { campo: valor } }
];

const sufixo = "Cifrada";
const sufixoJson = "CifradaJson"; // valores objeto (serializados antes de cifrar)

const vazio = (v) => v === undefined || v === null || v === "" || (typeof v === "object" && Object.keys(v).length === 0);

// Cópia da configuração pronta para gravar em disco.
function protegerSegredos(config, cofre) {
  const copia = JSON.parse(JSON.stringify(config));
  const disponivel = cofre.disponivel();
  for (const [secao, campo] of CAMPOS_SECRETOS) {
    const alvo = copia[secao];
    if (!alvo) continue;
    delete alvo[campo + sufixo];
    delete alvo[campo + sufixoJson];
    const valor = alvo[campo];
    if (!disponivel || vazio(valor)) continue;
    if (typeof valor === "string") {
      alvo[campo + sufixo] = cofre.cifrar(valor);
      delete alvo[campo];
    } else if (typeof valor === "object") {
      alvo[campo + sufixoJson] = cofre.cifrar(JSON.stringify(valor));
      delete alvo[campo];
    }
  }
  return copia;
}

// Decifra em memória (altera a própria config).
// falhas: seções cuja senha não pôde ser lida (arquivo de outro computador/usuário).
// precisaRegravar: havia senha em texto puro e o cofre está disponível (migração).
function abrirSegredos(config, cofre) {
  const falhas = [];
  let precisaRegravar = false;
  const disponivel = cofre.disponivel();
  for (const [secao, campo] of CAMPOS_SECRETOS) {
    const alvo = config[secao];
    if (!alvo) continue;
    const cifrada = alvo[campo + sufixo];
    const cifradaJson = alvo[campo + sufixoJson];
    if (typeof cifrada === "string" && cifrada !== "") {
      try {
        if (!disponivel) throw new Error("cofre indisponível");
        alvo[campo] = cofre.decifrar(cifrada);
      } catch (_) {
        alvo[campo] = "";
        falhas.push(secao);
      }
    } else if (typeof cifradaJson === "string" && cifradaJson !== "") {
      try {
        if (!disponivel) throw new Error("cofre indisponível");
        alvo[campo] = JSON.parse(cofre.decifrar(cifradaJson));
      } catch (_) {
        alvo[campo] = {};
        falhas.push(secao);
      }
    } else if (disponivel && !vazio(alvo[campo])) {
      precisaRegravar = true;
    }
    delete alvo[campo + sufixo];
    delete alvo[campo + sufixoJson];
  }
  return { falhas, precisaRegravar };
}

module.exports = { protegerSegredos, abrirSegredos, CAMPOS_SECRETOS };
