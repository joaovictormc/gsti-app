// Certificado digital A1 (.pfx/.p12) da empresa.
// Lê o arquivo com a senha, confere se tem chave privada e extrai titular, CPF/CNPJ,
// emissor e validade. O arquivo é guardado cifrado pelo processo principal (safeStorage),
// somente no computador onde foi cadastrado.
const forge = require("node-forge");

const TAMANHO_MAXIMO = 512 * 1024; // certificados A1 costumam ter poucos KB

// OIDs ICP-Brasil (otherName do subjectAltName)
const OID_CNPJ = "2.16.76.1.3.3";
const OID_CPF_PF = "2.16.76.1.3.1"; // nascimento(8) + CPF(11) + ...

class CertificadoErro extends Error {}

function lerAtributo(certificado, nome) {
  return certificado.subject.getField(nome)?.value || "";
}

// Procura CNPJ/CPF nos otherName do subjectAltName; se não achar, tenta o CN ("EMPRESA:12345678000199").
function documentoDoCertificado(certificado) {
  const der = forge.asn1.toDer(forge.pki.certificateToAsn1(certificado)).getBytes();
  const texto = Buffer.from(der, "binary");
  const procurarOid = (oid) => {
    const oidDer = Buffer.from(forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(oid).getBytes())).getBytes(), "binary");
    const pos = texto.indexOf(oidDer);
    if (pos < 0) return null;
    const depois = texto.subarray(pos + oidDer.length, pos + oidDer.length + 80).toString("latin1");
    const digitos = depois.replace(/\D/g, "");
    return digitos || null;
  };
  const cnpj = procurarOid(OID_CNPJ);
  if (cnpj && cnpj.length >= 14) return { tipo: "CNPJ", numero: cnpj.slice(0, 14) };
  const cpf = procurarOid(OID_CPF_PF);
  if (cpf && cpf.length >= 19) return { tipo: "CPF", numero: cpf.slice(8, 19) };
  const cn = lerAtributo(certificado, "CN");
  const m = cn.match(/:(\d{14}|\d{11})$/);
  if (m) return { tipo: m[1].length === 14 ? "CNPJ" : "CPF", numero: m[1] };
  return null;
}

// Valida o arquivo e devolve os dados do certificado (lança CertificadoErro com mensagem para o usuário).
function lerCertificadoA1(conteudo, senha) {
  if (!Buffer.isBuffer(conteudo) || conteudo.length === 0) {
    throw new CertificadoErro("Arquivo de certificado vazio.");
  }
  if (conteudo.length > TAMANHO_MAXIMO) {
    throw new CertificadoErro("Arquivo grande demais para um certificado A1 (.pfx).");
  }
  let p12;
  try {
    const asn1 = forge.asn1.fromDer(conteudo.toString("binary"));
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, String(senha ?? ""));
  } catch (e) {
    const msg = String(e?.message || "");
    if (/password|MAC|decrypt|Invalid/i.test(msg)) {
      throw new CertificadoErro("Senha do certificado incorreta.");
    }
    throw new CertificadoErro("Arquivo inválido. Use o certificado A1 no formato .pfx ou .p12.");
  }

  const chaves = [
    ...(p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] || []),
    ...(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] || []),
  ].filter((b) => b.key);
  if (chaves.length === 0) {
    throw new CertificadoErro("O arquivo não contém a chave privada. Exporte o certificado A1 completo (.pfx).");
  }

  const certificados = (p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] || [])
    .map((b) => b.cert)
    .filter(Boolean);
  // Certificado da empresa: o que corresponde à chave privada
  const chavePublica = forge.pki.setRsaPublicKey(chaves[0].key.n, chaves[0].key.e);
  const doTitular =
    certificados.find((c) => c.publicKey?.n && c.publicKey.n.equals(chavePublica.n)) || certificados[0];
  if (!doTitular) throw new CertificadoErro("Nenhum certificado encontrado no arquivo.");

  const validoAte = doTitular.validity.notAfter;
  if (validoAte.getTime() < Date.now()) {
    throw new CertificadoErro(`Certificado vencido em ${validoAte.toLocaleDateString("pt-BR")}.`);
  }

  return {
    titular: lerAtributo(doTitular, "CN").replace(/:\d{11,14}$/, ""),
    documento: documentoDoCertificado(doTitular),
    emissor: doTitular.issuer.getField("CN")?.value || "",
    validoDe: doTitular.validity.notBefore.toISOString(),
    validoAte: validoAte.toISOString(),
  };
}

module.exports = { lerCertificadoA1, CertificadoErro };
