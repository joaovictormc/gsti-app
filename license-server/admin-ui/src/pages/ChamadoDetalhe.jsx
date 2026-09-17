import { useRef, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Chip, Divider, FormControlLabel, Grid, Link, MenuItem, Paper, Stack, Switch, TextField, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import { api, get, post, put } from "../api";
import { data, dataHora, PLANOS } from "../format";
import { Cabecalho, Carregando, Erro, StatusChip, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";
import { Campo } from "./LicencaDetalhe";
import { COR_PRIORIDADE } from "./Chamados";

const MAX_ARQUIVOS = 5;
const MAX_BYTES = 5 * 1024 * 1024;

function Mensagem({ m, chamadoId }) {
  if (m.autor === "sistema") {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", py: 0.5, fontStyle: "italic" }}>
        {m.texto} · {dataHora(m.criadoEm)}
      </Typography>
    );
  }
  const equipe = m.autor === "equipe";
  return (
    <Paper
      sx={{
        p: 2, ml: equipe ? { md: 6 } : 0, mr: equipe ? 0 : { md: 6 },
        bgcolor: m.interna ? "#fff8e1" : equipe ? "#f7f4ee" : "background.paper",
        borderLeft: equipe && !m.interna ? "4px solid #ff6a2b" : undefined,
        borderStyle: m.interna ? "dashed" : undefined,
      }}
    >
      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
        <Typography variant="body2" fontWeight={600}>
          {m.autorNome || (equipe ? "Equipe" : "Cliente")} {equipe ? "· equipe" : "· cliente"}
          {m.interna && <Chip size="small" label="Nota interna" color="warning" sx={{ ml: 1, height: 20 }} />}
        </Typography>
        <Typography variant="caption" color="text.secondary">{dataHora(m.criadoEm)}</Typography>
      </Stack>
      <Typography sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{m.texto}</Typography>
      {m.anexos.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
          {m.anexos.map((a) => {
            const url = `/admin/api/suporte/chamados/${chamadoId}/anexos/${encodeURIComponent(a.id)}`;
            return (
              <Chip
                key={a.id} component="a" href={url} target="_blank" rel="noopener" clickable variant="outlined"
                icon={a.mime.startsWith("image/") ? <Box component="img" src={url} alt="" sx={{ width: 22, height: 22, objectFit: "cover", borderRadius: 0.5 }} /> : <AttachFileIcon />}
                label={`${a.nome} (${Math.max(1, Math.round(a.tamanho / 1024))} KB)`}
              />
            );
          })}
        </Stack>
      )}
    </Paper>
  );
}

const ROTULOS_TECNICOS = { versaoApp: "Versão do app", electron: "Electron", sistema: "Sistema", memoria: "Memória", idioma: "Idioma", computador: "Computador", licenca: "Licença", modulos: "Módulos", perfilUsuario: "Perfil do usuário", tela: "Tela aberta" };

function DadosTecnicos({ dados }) {
  if (!dados) return null;
  const { errosRecentes, ...resto } = dados;
  return (
    <Paper sx={{ p: 3, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>Dados técnicos do app</Typography>
      <Stack spacing={1}>
        {Object.entries(resto).map(([k, v]) => (
          <Box key={k}>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>{ROTULOS_TECNICOS[k] || k}</Typography>
            <Typography variant="body2" sx={{ fontFamily: "JetBrains Mono, monospace", wordBreak: "break-word" }}>{typeof v === "object" ? JSON.stringify(v) : String(v)}</Typography>
          </Box>
        ))}
        {Array.isArray(errosRecentes) && errosRecentes.length > 0 && (
          <Box>
            <Typography variant="overline" color="text.secondary">Erros recentes</Typography>
            <Box component="pre" sx={{ m: 0, p: 1.5, bgcolor: "#f4f1ea", borderRadius: 1, fontSize: 12, whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflowY: "auto" }}>
              {errosRecentes.join("\n")}
            </Box>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}

export default function ChamadoDetalhe() {
  const { id } = useParams();
  const { pode } = useSessao();
  const [aviso, avisar] = useAviso();
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/suporte/chamados/${id}`), [id]);
  const [texto, setTexto] = useState("");
  const [interna, setInterna] = useState(false);
  const [statusResposta, setStatusResposta] = useState("aguardando_cliente");
  const [arquivos, setArquivos] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const entradaArquivo = useRef(null);

  if (carregando && !dados) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;
  const { chamado: c, cliente, licencas, equipe, link, categorias, status, prioridades, origens } = dados;
  const podeResponder = pode("suporte.responder");

  const escolherArquivos = (lista) => {
    const novos = [...arquivos, ...lista].slice(0, MAX_ARQUIVOS);
    const grande = novos.find((a) => a.size > MAX_BYTES);
    if (grande) return avisar(`"${grande.name}" passa de 5 MB.`, "error");
    setArquivos(novos);
  };

  const responder = async () => {
    setEnviando(true);
    try {
      const r = await post(`/suporte/chamados/${c.id}/mensagens`, { texto, interna, status: statusResposta });
      const falhas = [];
      for (const a of arquivos) {
        try {
          await api("POST", `/suporte/chamados/${c.id}/mensagens/${r.mensagemId}/anexos`, a, { bruto: true, headers: { "X-Nome-Arquivo": encodeURIComponent(a.name) } });
        } catch (e) {
          falhas.push(`${a.name}: ${e.message}`);
        }
      }
      setTexto("");
      setArquivos([]);
      setInterna(false);
      avisar(falhas.length ? `Enviado, mas alguns arquivos falharam: ${falhas.join("; ")}` : interna ? "Nota interna registrada." : "Resposta enviada ao cliente por e-mail.", falhas.length ? "warning" : "success");
      recarregar();
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setEnviando(false);
    }
  };

  const atualizar = async (campos) => {
    try {
      await put(`/suporte/chamados/${c.id}`, campos);
      recarregar();
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  return (
    <>
      <Cabecalho
        voltar={<Button component={RouterLink} to="/suporte" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1, ml: -1 }}>Suporte</Button>}
        titulo={`#${c.id} · ${c.assunto}`}
        subtitulo={<>{c.nome ? `${c.nome} · ` : ""}{cliente ? <Link component={RouterLink} to={`/clientes/${cliente.id}`}>{c.email}</Link> : c.email} · {categorias[c.categoria]} · via {origens[c.origem]}</>}
        acoes={<><StatusChip status={c.status} />{c.prioridade !== "normal" && <Chip size="small" label={prioridades[c.prioridade]} color={COR_PRIORIDADE[c.prioridade]} />}</>}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={1.5} sx={{ mb: 2 }}>
            {c.mensagens.map((m) => <Mensagem key={m.id} m={m} chamadoId={c.id} />)}
          </Stack>

          {podeResponder && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 1.5 }}>{interna ? "Nota interna" : "Responder ao cliente"}</Typography>
              {c.status === "fechado" && !interna && <Alert severity="info" sx={{ mb: 2 }}>O chamado está fechado. Responder reabre a conversa com a situação escolhida abaixo.</Alert>}
              <TextField
                multiline minRows={5} fullWidth value={texto} onChange={(e) => setTexto(e.target.value)}
                placeholder={interna ? "Visível só para a equipe" : "A resposta vai para o cliente por e-mail e fica na página do chamado"}
                onPaste={(e) => { const imgs = [...e.clipboardData.files].filter((f) => f.type.startsWith("image/")); if (imgs.length) escolherArquivos(imgs); }}
              />
              {arquivos.length > 0 && (
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
                  {arquivos.map((a, i) => <Chip key={`${a.name}-${i}`} label={a.name || "imagem colada"} onDelete={() => setArquivos(arquivos.filter((_x, j) => j !== i))} />)}
                </Stack>
              )}
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} flexWrap="wrap" useFlexGap sx={{ mt: 2 }}>
                <FormControlLabel control={<Switch checked={interna} onChange={(e) => setInterna(e.target.checked)} />} label="Nota interna" sx={{ whiteSpace: "nowrap" }} />
                {!interna && (
                  <TextField select label="Depois de enviar" value={statusResposta} onChange={(e) => setStatusResposta(e.target.value)} sx={{ minWidth: 220 }}>
                    {Object.entries(status).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
                  </TextField>
                )}
                <Box sx={{ flex: 1 }} />
                <input ref={entradaArquivo} type="file" multiple hidden accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,.txt,.log" onChange={(e) => { escolherArquivos([...e.target.files]); e.target.value = ""; }} />
                <Button startIcon={<AttachFileIcon />} onClick={() => entradaArquivo.current?.click()} disabled={arquivos.length >= MAX_ARQUIVOS}>Anexar</Button>
                <Button variant="contained" onClick={responder} disabled={enviando || texto.trim().length < 2} sx={{ whiteSpace: "nowrap" }}>
                  {enviando ? "Enviando…" : interna ? "Salvar nota" : "Enviar resposta"}
                </Button>
              </Stack>
            </Paper>
          )}
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Atendimento</Typography>
            <Stack spacing={2}>
              <TextField select label="Situação" value={c.status} disabled={!podeResponder} onChange={(e) => atualizar({ status: e.target.value })}>
                {Object.entries(status).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="Prioridade" value={c.prioridade} disabled={!podeResponder} onChange={(e) => atualizar({ prioridade: e.target.value })}>
                {Object.entries(prioridades).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField select label="Responsável" value={c.atribuidoA || ""} disabled={!podeResponder} onChange={(e) => atualizar({ atribuidoA: e.target.value || null })}>
                <MenuItem value="">Sem responsável</MenuItem>
                {equipe.map((u) => <MenuItem key={u.id} value={u.id}>{u.nome}</MenuItem>)}
              </TextField>
              <Divider />
              <Campo rotulo="Aberto em">{dataHora(c.criadoEm)}</Campo>
              <Campo rotulo="Última atualização">{dataHora(c.atualizadoEm)}</Campo>
              {c.fechadoEm && <Campo rotulo="Fechado em">{dataHora(c.fechadoEm)}</Campo>}
              <Button
                size="small" variant="outlined" startIcon={<ContentCopyIcon />}
                onClick={async () => { await navigator.clipboard?.writeText(link); avisar("Link do cliente copiado."); }}
              >
                Copiar link do cliente
              </Button>
            </Stack>
          </Paper>

          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 1.5 }}>Cliente</Typography>
            {!cliente && <Typography color="text.secondary">Sem compras com este e-mail (pode ser um interessado ou um e-mail diferente do da compra).</Typography>}
            {cliente && (
              <Stack spacing={1}>
                <Link component={RouterLink} to={`/clientes/${cliente.id}`}>{cliente.nome || cliente.email}</Link>
                {licencas.map((l) => (
                  <Stack key={l.id} direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Link component={RouterLink} to={`/licencas/${l.id}`} sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: 13 }}>…{l.chave_final}</Link>
                    <Typography variant="body2">{PLANOS[l.plano] || l.plano} · até {l.valida_ate ? data(l.valida_ate) : "sem expiração"}</Typography>
                    <StatusChip status={l.status} />
                    {c.licencaId === l.id && <Chip size="small" label="aberto por esta licença" variant="outlined" />}
                  </Stack>
                ))}
                {!licencas.length && <Typography variant="body2" color="text.secondary">Nenhuma licença.</Typography>}
              </Stack>
            )}
          </Paper>

          <DadosTecnicos dados={c.dadosTecnicos} />
        </Grid>
      </Grid>
      {aviso}
    </>
  );
}
