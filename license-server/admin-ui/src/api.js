// Cliente da API do painel: cookies de sessão + token CSRF em cada mutação.
let csrf = "";
let aoExpirar = () => {};

export const definirCsrf = (token) => { csrf = token || ""; };
export const quandoSessaoExpirar = (fn) => { aoExpirar = fn; };

export class ErroApi extends Error {
  constructor(mensagem, status, codigo) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

export async function api(metodo, rota, corpo, { bruto = false, headers = {} } = {}) {
  const opcoes = { method: metodo, credentials: "same-origin", headers: { ...headers } };
  if (csrf) opcoes.headers["X-CSRF-Token"] = csrf;
  if (corpo !== undefined) {
    if (bruto) {
      opcoes.body = corpo;
      opcoes.headers["Content-Type"] = "application/octet-stream";
    } else {
      opcoes.body = JSON.stringify(corpo);
      opcoes.headers["Content-Type"] = "application/json";
    }
  }
  let resp;
  try {
    resp = await fetch(`/admin/api${rota}`, opcoes);
  } catch {
    throw new ErroApi("Sem conexão com o servidor.", 0);
  }
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || json.success === false) {
    if (resp.status === 401 && json.codigo === "NAO_AUTENTICADO") aoExpirar();
    throw new ErroApi(json.error || `Erro ${resp.status}`, resp.status, json.codigo);
  }
  return json;
}

export const get = (rota) => api("GET", rota);
export const post = (rota, corpo = {}) => api("POST", rota, corpo);
export const put = (rota, corpo = {}) => api("PUT", rota, corpo);

export function qs(params) {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== "" && v != null && v !== false) s.set(k, v);
  const t = s.toString();
  return t ? `?${t}` : "";
}
