import { useEffect, useState } from "react";
import {
  Alert, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup,
  Stack, TextField, Typography,
} from "@mui/material";

const TIPOS = [["NFS-e", "NFS-e (serviço)"], ["NF-e", "NF-e (produto)"], ["NFC-e", "NFC-e (consumidor)"]];
const vazio = { nome: "", site: "", documentos: ["NFS-e"], municipio: "", uf: "", observacao: "" };

// Pedido de integração com um emissor de nota que ainda não está no catálogo
export default function PedirEmissorDialog({ aberto, onFechar }) {
  const [form, setForm] = useState(vazio);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(null);

  useEffect(() => {
    if (aberto) {
      setForm(vazio);
      setErro("");
      setEnviado(null);
    }
  }, [aberto]);

  const alterar = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));
  const alternarTipo = (tipo) =>
    setForm((f) => ({ ...f, documentos: f.documentos.includes(tipo) ? f.documentos.filter((d) => d !== tipo) : [...f.documentos, tipo] }));

  const enviar = async () => {
    setEnviando(true);
    setErro("");
    try {
      const r = await window.api.requestFiscalEmitter({ ...form, nome: form.nome.trim(), uf: form.uf.trim().toUpperCase() });
      if (r?.success) setEnviado(form.nome.trim());
      else setErro(r?.error || "Não foi possível registrar o pedido.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Dialog open={aberto} onClose={() => !enviando && onFechar()} maxWidth="sm" fullWidth>
      <DialogTitle>Pedir outro emissor</DialogTitle>
      <DialogContent>
        {enviado ? (
          <Alert severity="success" sx={{ mt: 1 }}>
            Pedido de <strong>{enviado}</strong> registrado. Os emissores mais pedidos entram primeiro; você recebe um e-mail quando
            estiver disponível e acompanha na área do cliente.
          </Alert>
        ) : (
          <Stack spacing={2} sx={{ pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Usa um emissor que ainda não está no GSTI App (outra plataforma ou o portal da sua prefeitura)? Conte qual é.
            </Typography>
            <TextField label="Nome do emissor" value={form.nome} onChange={alterar("nome")} placeholder="Ex.: Focus NFe, eNotas, portal da prefeitura" inputProps={{ maxLength: 80 }} autoFocus />
            <Typography variant="body2" fontWeight={600}>Notas que você emite</Typography>
            <FormGroup row>
              {TIPOS.map(([valor, rotulo]) => (
                <FormControlLabel key={valor} control={<Checkbox checked={form.documentos.includes(valor)} onChange={() => alternarTipo(valor)} />} label={rotulo} />
              ))}
            </FormGroup>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Município (opcional)" value={form.municipio} onChange={alterar("municipio")} sx={{ flex: 1 }} inputProps={{ maxLength: 80 }} />
              <TextField label="UF" value={form.uf} onChange={alterar("uf")} sx={{ width: { sm: 90 } }} inputProps={{ maxLength: 2 }} />
            </Stack>
            <TextField label="Site do emissor (opcional)" value={form.site} onChange={alterar("site")} placeholder="https://" inputProps={{ maxLength: 200 }} />
            <TextField label="Observação (opcional)" value={form.observacao} onChange={alterar("observacao")} multiline minRows={2} inputProps={{ maxLength: 500 }} />
            {erro && <Alert severity="error">{erro}</Alert>}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {enviado ? (
          <Button onClick={onFechar}>Fechar</Button>
        ) : (
          <>
            <Button onClick={onFechar} disabled={enviando}>Cancelar</Button>
            <Button
              variant="contained" onClick={enviar}
              disabled={enviando || form.nome.trim().length < 3 || !form.documentos.length}
              startIcon={enviando ? <CircularProgress size={16} color="inherit" /> : null}
            >
              {enviando ? "Enviando…" : "Enviar pedido"}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
