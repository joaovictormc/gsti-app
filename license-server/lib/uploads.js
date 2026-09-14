/**
 * Upload de imagens do site (PNG, JPEG, WebP, GIF — SVG é recusado por segurança).
 * O tipo é detectado pelos bytes do arquivo, não pela extensão informada.
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { abrir } = require("./db");
const cfg = require("./config");
const { LicencaErro } = require("./erros");

const MAX_BYTES = 5 * 1024 * 1024;

function detectarTipo(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
  if (buf.length > 12 && buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return { mime: "image/webp", ext: "webp" };
  if (buf.length > 6 && /^GIF8[79]a$/.test(buf.subarray(0, 6).toString())) return { mime: "image/gif", ext: "gif" };
  return null;
}

function salvar(buffer, nomeOriginal, autor) {
  if (!buffer?.length) throw new LicencaErro("ARQUIVO_VAZIO", "Selecione uma imagem.");
  if (buffer.length > MAX_BYTES) throw new LicencaErro("ARQUIVO_GRANDE", "A imagem deve ter no máximo 5 MB.", 413);
  const tipo = detectarTipo(buffer);
  if (!tipo) throw new LicencaErro("TIPO_INVALIDO", "Formato não suportado. Use PNG, JPG, WebP ou GIF.");
  fs.mkdirSync(cfg.UPLOADS_DIR, { recursive: true });
  const id = `${crypto.randomUUID()}.${tipo.ext}`;
  fs.writeFileSync(path.join(cfg.UPLOADS_DIR, id), buffer);
  abrir()
    .prepare("INSERT INTO uploads (id, nome_original, mime, tamanho, enviado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, String(nomeOriginal || "").slice(0, 200), tipo.mime, buffer.length, autor, new Date().toISOString());
  return { id, url: `/uploads/${id}`, mime: tipo.mime, tamanho: buffer.length };
}

function listar() {
  return abrir()
    .prepare("SELECT * FROM uploads ORDER BY criado_em DESC LIMIT 200")
    .all()
    .map((u) => ({ ...u, url: `/uploads/${u.id}` }));
}

// Caminho seguro para servir um upload (ou null).
function caminho(id) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/.test(String(id))) return null;
  const u = abrir().prepare("SELECT * FROM uploads WHERE id = ?").get(id);
  if (!u) return null;
  const p = path.join(cfg.UPLOADS_DIR, id);
  return fs.existsSync(p) ? { arquivo: p, mime: u.mime } : null;
}

module.exports = { MAX_BYTES, salvar, listar, caminho };
