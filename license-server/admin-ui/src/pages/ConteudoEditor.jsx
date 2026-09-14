import { useEffect, useRef, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton,
  List, ListItemButton, ListItemText, Paper, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import HistoryIcon from "@mui/icons-material/History";
import { api, get, post, put } from "../api";
import { dataHora } from "../format";
import { Cabecalho, Carregando, Erro, useAviso, useCarregar } from "../components/comum";

function CampoImagem({ campo, valor, onChange }) {
  const entrada = useRef(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  const enviar = async (arquivo) => {
    if (!arquivo) return;
    setErro("");
    setEnviando(true);
    try {
      const r = await api("POST", "/uploads", arquivo, { bruto: true, headers: { "X-Nome-Arquivo": encodeURIComponent(arquivo.name) } });
      onChange(r.url);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
      entrada.current.value = "";
    }
  };

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{campo.rotulo}</Typography>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
        <Box sx={{ width: 160, height: 100, borderRadius: 2, border: "1px dashed", borderColor: "divider", bgcolor: "#faf8f3", display: "grid", placeItems: "center", overflow: "hidden", flex: "none" }}>
          {valor ? <img src={valor} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Typography variant="caption" color="text.secondary">Sem imagem</Typography>}
        </Box>
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => entrada.current.click()} disabled={enviando}>{enviando ? "Enviando…" : valor ? "Trocar imagem" : "Enviar imagem"}</Button>
            {valor && <Button size="small" color="error" onClick={() => onChange("")}>Remover</Button>}
          </Stack>
          <Typography variant="caption" color="text.secondary">PNG, JPG, WebP ou GIF até 5 MB.</Typography>
          {erro && <Alert severity="error" sx={{ py: 0 }}>{erro}</Alert>}
        </Stack>
        <input ref={entrada} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={(e) => enviar(e.target.files[0])} />
      </Stack>
    </Box>
  );
}

function CampoLista({ campo, valor = [], onChange }) {
  const atualizar = (i, item) => onChange(valor.map((v, j) => (j === i ? item : v)));
  const mover = (i, d) => {
    const n = [...valor];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  const novo = Object.fromEntries(campo.campos.map((c) => [c.nome, c.tipo === "booleano" ? false : ""]));

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{campo.rotulo} <Typography component="span" variant="caption" color="text.secondary">({valor.length} de até {campo.max})</Typography></Typography>
      <Stack spacing={1.5}>
        {valor.map((item, i) => (
          <Paper key={i} sx={{ p: 2, bgcolor: "#faf8f3" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="overline" color="text.secondary">Item {i + 1}</Typography>
              <Stack direction="row">
                <Tooltip title="Mover para cima"><span><IconButton size="small" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Mover para baixo"><span><IconButton size="small" disabled={i === valor.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Remover"><IconButton size="small" color="error" onClick={() => onChange(valor.filter((_v, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            </Stack>
            <Stack spacing={2}>
              {campo.campos.map((c) => <CampoConteudo key={c.nome} campo={c} valor={item[c.nome]} onChange={(v) => atualizar(i, { ...item, [c.nome]: v })} />)}
            </Stack>
          </Paper>
        ))}
        <Button startIcon={<AddIcon />} variant="outlined" onClick={() => onChange([...valor, novo])} disabled={valor.length >= campo.max} sx={{ alignSelf: "flex-start" }}>
          Adicionar
        </Button>
      </Stack>
    </Box>
  );
}

function CampoConteudo({ campo, valor, onChange }) {
  switch (campo.tipo) {
    case "booleano":
      return <FormControlLabel control={<Switch checked={!!valor} onChange={(e) => onChange(e.target.checked)} />} label={campo.rotulo} />;
    case "imagem":
      return <CampoImagem campo={campo} valor={valor} onChange={onChange} />;
    case "lista":
      return <CampoLista campo={campo} valor={valor} onChange={onChange} />;
    case "markdown":
      return (
        <TextField
          label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} multiline minRows={10} fullWidth
          helperText={`Formatação: ## Título, **negrito**, *itálico*, - lista, [texto](https://link) · ${(valor || "").length}/${campo.max}`}
          slotProps={{ htmlInput: { maxLength: campo.max, style: { fontFamily: "JetBrains Mono, monospace", fontSize: 13 } } }}
        />
      );
    case "textarea":
      return <TextField label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} multiline minRows={3} fullWidth slotProps={{ htmlInput: { maxLength: campo.max } }} helperText={`${(valor || "").length}/${campo.max}`} />;
    case "url":
      return <TextField label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} fullWidth placeholder="https://" />;
    default:
      return <TextField label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} fullWidth slotProps={{ htmlInput: { maxLength: campo.max } }} />;
  }
}

function Historico({ chave, aberto, onFechar, onRestaurado }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!aberto) return;
    setItens(null);
    get(`/conteudo/${chave}/historico`).then((r) => setItens(r.itens)).catch((e) => setErro(e.message));
  }, [aberto, chave]);

  const restaurar = async (id) => {
    try {
      const r = await post(`/conteudo/${chave}/restaurar`, { historicoId: id });
      onRestaurado(r.valor);
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle>Histórico de versões</DialogTitle>
      <DialogContent>
        {erro && <Alert severity="error">{erro}</Alert>}
        {!itens ? <Carregando /> : !itens.length ? <Typography color="text.secondary">Nenhuma versão salva ainda.</Typography> : (
          <List dense>
            {itens.map((h, i) => (
              <ListItemButton key={h.id} onClick={() => i > 0 && restaurar(h.id)} disabled={i === 0}>
                <ListItemText primary={dataHora(h.criado_em)} secondary={i === 0 ? `${h.autor} · versão atual` : `${h.autor} · clique para restaurar`} />
              </ListItemButton>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions><Button onClick={onFechar}>Fechar</Button></DialogActions>
    </Dialog>
  );
}

export default function ConteudoEditor() {
  const { chave } = useParams();
  const [aviso, avisar] = useAviso();
  const [valor, setValor] = useState(null);
  const [original, setOriginal] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [historico, setHistorico] = useState(false);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/conteudo/${chave}`), [chave]);

  useEffect(() => {
    if (dados) {
      setValor(dados.valor);
      setOriginal(JSON.stringify(dados.valor));
    }
  }, [dados]);

  const alterado = valor && JSON.stringify(valor) !== original;
  useEffect(() => {
    const aviso = (e) => { if (alterado) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  if (carregando || (dados && !valor)) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;
  const email = chave.startsWith("email.");

  const salvar = async () => {
    setErroSalvar("");
    setSalvando(true);
    try {
      const r = await put(`/conteudo/${chave}`, { valor });
      setValor(r.valor);
      setOriginal(JSON.stringify(r.valor));
      avisar("Publicado.");
    } catch (e) {
      setErroSalvar(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const testar = async () => {
    try {
      if (alterado) await salvar();
      const r = await post(`/conteudo/${chave}/email-teste`);
      avisar(r.simulado ? "SMTP não configurado: e-mail apenas simulado (veja o log do servidor)." : "E-mail de teste enviado para você.", r.simulado ? "warning" : "success");
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  return (
    <>
      <Cabecalho
        voltar={<Button component={RouterLink} to="/conteudo" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1, ml: -1 }}>Textos e e-mails</Button>}
        titulo={dados.titulo}
        subtitulo={dados.ajuda || (email ? null : "Salvar publica imediatamente no site.")}
        acoes={<>
          <Button startIcon={<HistoryIcon />} onClick={() => setHistorico(true)}>Histórico</Button>
          {email ? <Button variant="outlined" onClick={testar}>Enviar teste para mim</Button> : <Button variant="outlined" href={chave === "pagina.termos" ? "/termos" : chave === "pagina.privacidade" ? "/privacidade" : "/"} target="_blank">Ver no site</Button>}
          <Button variant="contained" onClick={salvar} disabled={!alterado || salvando}>{salvando ? "Salvando…" : alterado ? "Salvar e publicar" : "Salvo"}</Button>
        </>}
      />
      {erroSalvar && <Alert severity="error" sx={{ mb: 2 }}>{erroSalvar}</Alert>}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 9 }}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack spacing={2.5} divider={<Divider flexItem />}>
              {dados.campos.map((c) => <CampoConteudo key={c.nome} campo={c} valor={valor[c.nome]} onChange={(v) => setValor({ ...valor, [c.nome]: v })} />)}
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 3 }}>
          <Paper sx={{ p: 2.5, position: { lg: "sticky" }, top: 88 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Dicas</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Frases curtas e concretas vendem mais do que adjetivos.</Typography>
            {email && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Mantenha as variáveis entre chaves duplas exatamente como estão, por exemplo {"{{chave}}"}.</Typography>}
            <Button size="small" color="warning" onClick={() => setValor(dados.padrao)} sx={{ mt: 1, ml: -1 }}>Restaurar texto padrão</Button>
          </Paper>
        </Grid>
      </Grid>
      <Historico chave={chave} aberto={historico} onFechar={() => setHistorico(false)} onRestaurado={(v) => { setHistorico(false); setValor(v); setOriginal(JSON.stringify(v)); avisar("Versão restaurada e publicada."); }} />
      {aviso}
    </>
  );
}
