import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, List, ListItemButton,
  ListItemText, Paper, Stack, Typography,
} from "@mui/material";
import HistoryIcon from "@mui/icons-material/History";
import SendIcon from "@mui/icons-material/SendOutlined";
import RestoreIcon from "@mui/icons-material/SettingsBackupRestoreOutlined";
import { get, post, put } from "../../api";
import { dataHora } from "../../format";
import { Carregando, Erro, useCarregar } from "../../components/comum";
import Campo from "./Campos";

function Historico({ chave, aberto, onFechar, onRestaurado }) {
  const [itens, setItens] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (!aberto) return;
    setItens(null);
    get(`/conteudo/${chave}/historico`).then((r) => setItens(r.itens)).catch((e) => setErro(e.message));
  }, [aberto, chave]);

  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="xs" fullWidth>
      <DialogTitle>Histórico de versões</DialogTitle>
      <DialogContent>
        {erro && <Alert severity="error">{erro}</Alert>}
        {!itens ? <Carregando /> : !itens.length ? (
          <Typography color="text.secondary">Nenhuma versão salva ainda.</Typography>
        ) : (
          <List dense>
            {itens.map((h, i) => (
              <ListItemButton
                key={h.id}
                disabled={i === 0}
                onClick={async () => {
                  try {
                    const r = await post(`/conteudo/${chave}/restaurar`, { historicoId: h.id });
                    onRestaurado(r.valor);
                  } catch (e) {
                    setErro(e.message);
                  }
                }}
              >
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

/**
 * Formulário de uma seção. Avisa o pai a cada alteração (para a prévia ao vivo).
 */
export default function EditorSecao({ chave, onValores, onPublicado, avisar }) {
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
      setErroSalvar("");
    }
  }, [dados]);

  useEffect(() => { if (valor) onValores?.(valor); }, [valor, onValores]);

  const alterado = valor && JSON.stringify(valor) !== original;
  useEffect(() => {
    const aviso = (e) => { if (alterado) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [alterado]);

  if (carregando || (dados && !valor)) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;
  const email = chave.startsWith("email.");

  const publicar = async () => {
    setErroSalvar("");
    setSalvando(true);
    try {
      const r = await put(`/conteudo/${chave}`, { valor });
      setValor(r.valor);
      setOriginal(JSON.stringify(r.valor));
      avisar?.("Publicado no site.");
      onPublicado?.();
    } catch (e) {
      setErroSalvar(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const enviarTeste = async () => {
    try {
      if (alterado) await publicar();
      const r = await post(`/conteudo/${chave}/email-teste`);
      avisar?.(r.simulado ? "SMTP não configurado: e-mail apenas simulado (veja o log do servidor)." : "E-mail de teste enviado para você.", r.simulado ? "warning" : "success");
    } catch (e) {
      avisar?.(e.message, "error");
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5">{dados.titulo}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {dados.ajuda || (alterado ? "Alterações não publicadas — a prévia já mostra como vai ficar." : "Tudo publicado.")}
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Button size="small" startIcon={<HistoryIcon />} onClick={() => setHistorico(true)}>Histórico</Button>
          {email && <Button size="small" startIcon={<SendIcon />} onClick={enviarTeste}>Enviar teste</Button>}
          <Button size="small" startIcon={<RestoreIcon />} color="warning" onClick={() => setValor(dados.padrao)}>Texto padrão</Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={publicar} disabled={!alterado || salvando}>
            {salvando ? "Publicando…" : alterado ? "Publicar" : "Publicado"}
          </Button>
        </Stack>
      </Box>
      {erroSalvar && <Alert severity="error" sx={{ mb: 2 }}>{erroSalvar}</Alert>}
      <Paper sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2.5} divider={<Divider flexItem />}>
          {dados.campos.map((c) => (
            <Campo key={c.nome} campo={c} valor={valor[c.nome]} onChange={(v) => setValor({ ...valor, [c.nome]: v })} />
          ))}
        </Stack>
      </Paper>
      <Historico
        chave={chave}
        aberto={historico}
        onFechar={() => setHistorico(false)}
        onRestaurado={(v) => { setHistorico(false); setValor(v); setOriginal(JSON.stringify(v)); avisar?.("Versão restaurada e publicada."); onPublicado?.(); }}
      />
    </Box>
  );
}
