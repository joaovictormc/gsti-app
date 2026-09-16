// Senhas do config.json gravadas cifradas.
// O "cofre" é o safeStorage do Electron (DPAPI no Windows): o texto cifrado só abre
// no mesmo usuário do Windows que o gravou. Em memória a configuração continua
// com as senhas em texto, então o restante do app não muda.

const CAMPOS_SECRETOS = [
  ["database", "password"],
  ["email", "pass"],
];

const sufixo = "Cifrada";

// Cópia da configuração pronta para gravar em disco.
function protegerSegredos(config, cofre) {
  const copia = JSON.parse(JSON.stringify(config));
  const disponivel = cofre.disponivel();
  for (const [secao, campo] of CAMPOS_SECRETOS) {
    const alvo = copia[secao];
    if (!alvo) continue;
    delete alvo[campo + sufixo];
    const valor = alvo[campo];
    if (disponivel && typeof valor === "string" && valor !== "") {
      alvo[campo + sufixo] = cofre.cifrar(valor);
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
    if (typeof cifrada === "string" && cifrada !== "") {
      try {
        if (!disponivel) throw new Error("cofre indisponível");
        alvo[campo] = cofre.decifrar(cifrada);
      } catch (_) {
        alvo[campo] = "";
        falhas.push(secao);
      }
    } else if (disponivel && typeof alvo[campo] === "string" && alvo[campo] !== "") {
      precisaRegravar = true;
    }
    delete alvo[campo + sufixo];
  }
  return { falhas, precisaRegravar };
}

module.exports = { protegerSegredos, abrirSegredos, CAMPOS_SECRETOS };
