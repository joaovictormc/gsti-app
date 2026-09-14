import { useCallback, useEffect, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogContentText,
  DialogTitle, Snackbar, Stack, TextField, Typography,
} from "@mui/material";
import { STATUS } from "../format";

export function Cabecalho({ titulo, subtitulo, acoes, voltar }) {
  return (
    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "flex-end" }} spacing={2} sx={{ mb: 3 }}>
      <Box>
        {voltar}
        <Typography variant="h4" component="h1">{titulo}</Typography>
        {subtitulo && <Typography color="text.secondary" sx={{ mt: 0.5 }}>{subtitulo}</Typography>}
      </Box>
      {acoes && <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>{acoes}</Stack>}
    </Stack>
  );
}

export function StatusChip({ status, rotulo }) {
  const [texto, cor] = STATUS[status] || [status, "default"];
  return <Chip size="small" label={rotulo || texto} color={cor} variant={cor === "default" ? "outlined" : "filled"} sx={{ fontWeight: 600 }} />;
}

export function Carregando() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", py: 8 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export function Erro({ erro, onTentar }) {
  if (!erro) return null;
  return (
    <Alert severity="error" sx={{ mb: 2 }} action={onTentar && <Button color="inherit" size="small" onClick={onTentar}>Tentar de novo</Button>}>
      {erro.message || String(erro)}
    </Alert>
  );
}

export function Vazio({ children }) {
  return <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>{children}</Typography>;
}

// Carrega dados de uma função assíncrona, com recarga manual.
export function useCarregar(fn, deps) {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [carregando, setCarregando] = useState(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const executar = useCallback(fn, deps);
  const recarregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setDados(await executar());
    } catch (e) {
      setErro(e);
    } finally {
      setCarregando(false);
    }
  }, [executar]);
  useEffect(() => { recarregar(); }, [recarregar]);
  return { dados, erro, carregando, recarregar, setDados };
}

/**
 * Diálogo de confirmação com campo opcional (motivo etc.).
 * acao(valorCampo) deve lançar erro para manter o diálogo aberto.
 */
export function Confirmar({ aberto, titulo, texto, rotuloConfirmar = "Confirmar", cor = "primary", campo, onFechar, acao }) {
  const [valor, setValor] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);
  useEffect(() => { if (aberto) { setValor(campo?.inicial != null ? String(campo.inicial) : ""); setErro(null); } }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmar = async () => {
    setOcupado(true);
    setErro(null);
    try {
      await acao(valor);
      onFechar();
    } catch (e) {
      setErro(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={aberto} onClose={() => !ocupado && onFechar()} maxWidth="xs" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        {texto && <DialogContentText sx={{ mb: campo ? 2 : 0 }}>{texto}</DialogContentText>}
        {campo && <TextField fullWidth autoFocus label={campo.rotulo} value={valor} onChange={(e) => setValor(e.target.value)} {...campo.props} />}
        {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro.message}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" color={cor} onClick={confirmar} disabled={ocupado || (campo?.obrigatorio && !valor.trim())}>
          {ocupado ? "Aguarde…" : rotuloConfirmar}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function useAviso() {
  const [aviso, setAviso] = useState(null);
  const elemento = (
    <Snackbar open={!!aviso} autoHideDuration={4000} onClose={() => setAviso(null)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
      {aviso ? <Alert severity={aviso.tipo || "success"} variant="filled" onClose={() => setAviso(null)}>{aviso.texto}</Alert> : <span />}
    </Snackbar>
  );
  return [elemento, (texto, tipo) => setAviso({ texto, tipo })];
}

// Exibe um segredo (chave, senha) uma única vez, com botão de copiar.
export function SegredoUnico({ aberto, titulo, rotulo, valor, aviso, onFechar }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <Dialog open={aberto} onClose={onFechar} maxWidth="sm" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        <Typography variant="overline" color="text.secondary">{rotulo}</Typography>
        <Box sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "1.25rem", fontWeight: 500, bgcolor: "#f4f1ea", border: "1.5px dashed #ff6a2b", borderRadius: 2, p: 2, my: 1, wordBreak: "break-all" }}>
          {valor}
        </Box>
        <Alert severity="warning">{aviso || "Copie agora: este valor não será exibido novamente."}</Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={async () => { await navigator.clipboard?.writeText(valor); setCopiado(true); }}>{copiado ? "Copiado!" : "Copiar"}</Button>
        <Button variant="contained" onClick={() => { setCopiado(false); onFechar(); }}>Fechar</Button>
      </DialogActions>
    </Dialog>
  );
}
