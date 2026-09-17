// Gera certificados A1 (.pfx) autoassinados para testes (não têm validade ICP-Brasil).
const forge = require("node-forge");

let chaves = null;
const parDeChaves = () => (chaves ||= forge.pki.rsa.generateKeyPair(2048));

function gerarPfx({ cn, validoAte, cnpjOtherName, cpfOtherName, semChave = false, senha = "1234" }) {
  const { publicKey, privateKey } = parDeChaves();
  const cert = forge.pki.createCertificate();
  cert.publicKey = publicKey;
  cert.serialNumber = "01";
  cert.validity.notBefore = new Date(Date.now() - 86400000 * 30);
  cert.validity.notAfter = validoAte || new Date(Date.now() + 86400000 * 200);
  cert.setSubject([{ name: "commonName", value: cn }, { name: "countryName", value: "BR" }]);
  cert.setIssuer([{ name: "commonName", value: "AC TESTE GSTI" }]);

  // subjectAltName com otherName no formato ICP-Brasil (CNPJ/CPF)
  const otherName = (oid, valor) =>
    forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
      forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OID, false, forge.asn1.oidToDer(oid).getBytes()),
      forge.asn1.create(forge.asn1.Class.CONTEXT_SPECIFIC, 0, true, [
        forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.OCTETSTRING, false, valor),
      ]),
    ]);
  const nomes = [];
  if (cnpjOtherName) nomes.push(otherName("2.16.76.1.3.3", cnpjOtherName));
  if (cpfOtherName) nomes.push(otherName("2.16.76.1.3.1", cpfOtherName));
  if (nomes.length) {
    const san = forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.SEQUENCE, true, nomes);
    cert.setExtensions([{ id: "2.5.29.17", name: "subjectAltName", value: forge.asn1.toDer(san).getBytes() }]);
  }
  cert.sign(privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(semChave ? null : privateKey, [cert], senha, { algorithm: "3des" });
  return Buffer.from(forge.asn1.toDer(p12).getBytes(), "binary");
}

module.exports = { gerarPfx };
