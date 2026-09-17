import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, CircularProgress, Collapse, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, List, ListItemButton, ListItemText, MenuItem, Stack, Tab, Tabs, TextField, Typography,
} from "@mui/material";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// Mesmas categorias do servidor (license-server/lib/suporte.js)
const CATEGORIAS = [
  ["erro", "Erro ou problema"],
  ["duvida", "Dúvida"],
  ["sugestao", "Sugestão"],
  ["financeiro", "Pagamento e licença"],
  ["outro", "Outro"],
];

const COR_STATUS = { aberto: "info", em_andamento: "info", aguardando_cliente: "warning", resolvido: "success", fechado: "default" };
const vazio = { categoria: "erro", assunto: "", mensagem: "", email: "" };

export default function SuporteDialog({ aberto, onFechar, captura, tela }) {
  const [aba, setAba] = useState(0);
  const [ctx, setCtx] = useState(null);
  const [form, setForm] = useState(vazio);
  const [incluirDados, setIncluirDados] = useState(true);
  const [verDados, setVerDados] = useState(false);
  const [incluirCaptura, setIncluirCaptura] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [resultado, setResultado] = useState(null);
  const [chamados, setChamados] = useState(null);

  useEffect(() => {
    if (!aberto) return;
    setAba(0);
    setErro("");
    setResultado(null);
    setChamados(null);
    setVerDados(false);
    setIncluirCaptura(!!captura);
    window.api.getSupportContext({ tela }).then((r) => {
      setCtx(r);
      setForm((f) => ({ ...vazio, email: f.email || r?.email || "" }));
    }).catch(() => setCtx({ temLicenca: false }));
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (aberto && aba === 1 && chamados === null) {
      window.api.listSupportTickets().then(setChamados).catch(() => setChamados({ success: false, itens: [], error: "Não foi possível carregar." }));
    }
  }, [aberto, aba, chamados]);

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const valido = form.assunto.trim().length >= 5 && form.mensagem.trim().length >= 10 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim());

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const r = await window.api.openSupportTicket({ ...form, email: form.email.trim(), incluirDados, incluirCaptura: incluirCaptura && !!captura, tela });
      if (r?.success) {
        setResultado(r);
        setChamados(null);
      } else {
        setErro(r?.error || "Não foi possível abrir o chamado.");
      }
    } finally {
      setEnviando(false);
    }
  };

  const fechar = () => !enviando && onFechar();
  const semLicenca = ctx && !ctx.temLicenca;

  return (
    <Dialog open={aberto} onClose={fechar} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <SupportAgentIcon color="primary" /> Suporte
      </DialogTitle>
      <Tabs value={aba} onChange={(_e, v) => setAba(v)} sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}>
        <Tab label="Abrir chamado" />
        <Tab label="Meus chamados" disabled={semLicenca} />
      </Tabs>
      <DialogContent sx={{ pt: 2.5 }}>
        {!ctx && <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress size={28} /></Box>}

        {ctx && semLicenca && (
          <Alert severity="info" action={ctx.urlSite && <Button color="inherit" size="small" onClick={() => window.api.openSupportLink()}>Abrir o site</Button>}>
            Ative a licença para abrir chamados pelo sistema. Você também pode abrir um chamado pelo site.
          </Alert>
        )}

        {ctx && !semLicenca && aba === 0 && resultado && (
          <Stack spacing={2} alignItems="center" sx={{ textAlign: "center", py: 2 }}>
            <CheckCircleIcon color="success" sx={{ fontSize: 56 }} />
            <Typography variant="h6">Chamado #{resultado.numero} aberto</Typography>
            <Typography color="text.secondary">
              Enviamos a confirmação para <strong>{form.email}</strong>. As respostas da equipe chegam por e-mail e ficam na página do chamado.
            </Typography>
            {resultado.avisoCaptura && <Alert severity="warning" sx={{ textAlign: "left" }}>{resultado.avisoCaptura}</Alert>}
            <Button variant="outlined" startIcon={<OpenInNewIcon />} onClick={() => window.api.openSupportLink(resultado.link)}>Acompanhar no navegador</Button>
          </Stack>
        )}

        {ctx && !semLicenca && aba === 0 && !resultado && (
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField select label="Tipo" value={form.categoria} onChange={alterar("categoria")} sx={{ minWidth: 200 }}>
                {CATEGORIAS.map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
              <TextField label="E-mail para resposta" value={form.email} onChange={alterar("email")} fullWidth />
            </Stack>
            <TextField label="Assunto" value={form.assunto} onChange={alterar("assunto")} inputProps={{ maxLength: 150 }} placeholder="Ex.: Erro ao imprimir a OS" />
            <TextField
              label="Descreva o que aconteceu" value={form.mensagem} onChange={alterar("mensagem")} multiline minRows={5}
              inputProps={{ maxLength: 5000 }} placeholder="O que você estava fazendo, o que aconteceu e a mensagem de erro, se houver."
            />
            <Box>
              <FormControlLabel control={<Checkbox checked={incluirDados} onChange={(e) => setIncluirDados(e.target.checked)} />} label="Incluir dados técnicos (versão, sistema, licença e erros recentes)" />
              {incluirDados && (
                <Button size="small" onClick={() => setVerDados((v) => !v)} sx={{ ml: 4 }}>{verDados ? "Ocultar" : "Ver o que será enviado"}</Button>
              )}
              <Collapse in={incluirDados && verDados}>
                <Box component="pre" sx={{ m: 0, mt: 1, p: 1.5, maxHeight: 220, overflow: "auto", fontSize: 12, bgcolor: "action.hover", borderRadius: 1, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(ctx.dadosTecnicos, null, 2)}
                </Box>
              </Collapse>
              {captura && (
                <Stack direction="row" spacing={2} alignItems="center" sx={{ mt: 1 }}>
                  <FormControlLabel control={<Checkbox checked={incluirCaptura} onChange={(e) => setIncluirCaptura(e.target.checked)} />} label="Anexar captura da tela atual" />
                  <Box component="img" src={captura} alt="Captura da tela" sx={{ height: 64, borderRadius: 1, border: 1, borderColor: "divider", opacity: incluirCaptura ? 1 : 0.4 }} />
                </Stack>
              )}
            </Box>
            {erro && <Alert severity="error">{erro}</Alert>}
          </Stack>
        )}

        {ctx && !semLicenca && aba === 1 && (
          chamados === null ? <Box sx={{ display: "grid", placeItems: "center", py: 4 }}><CircularProgress size={28} /></Box>
            : !chamados.success ? <Alert severity="warning">{chamados.error}</Alert>
              : !chamados.itens.length ? <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>Nenhum chamado ainda.</Typography>
                : (
                  <List disablePadding>
                    {chamados.itens.map((c) => (
                      <ListItemButton key={c.numero} onClick={() => window.api.openSupportLink(c.link)} sx={{ borderRadius: 1 }}>
                        <ListItemText
                          primary={`#${c.numero} · ${c.assunto}`}
                          secondary={`Atualizado em ${new Date(c.atualizadoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`}
                        />
                        <Chip size="small" label={c.statusRotulo || c.status} color={COR_STATUS[c.status] || "default"} sx={{ ml: 1 }} />
                        <OpenInNewIcon fontSize="small" sx={{ ml: 1, color: "text.secondary" }} />
                      </ListItemButton>
                    ))}
                  </List>
                )
        )}
      </DialogContent>
      <DialogActions>
        {resultado || aba === 1 || semLicenca ? (
          <Button onClick={fechar}>Fechar</Button>
        ) : (
          <>
            <Button onClick={fechar} disabled={enviando}>Cancelar</Button>
            <Button variant="contained" onClick={enviar} disabled={!ctx || enviando || !valido} startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}>
              {enviando ? "Enviando…" : "Enviar chamado"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
