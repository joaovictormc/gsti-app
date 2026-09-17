import { useEffect, useState } from "react";
import {
  Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle,
  FormControlLabel, Stack, Typography,
} from "@mui/material";

// Venda por módulos: seleção dos módulos avançados (a base está sempre incluída).

export function SeletorModulos({ catalogo, valor, onChange, disabled }) {
  const marcados = new Set(valor || []);
  const alternar = (chave) => {
    const novo = new Set(marcados);
    if (novo.has(chave)) novo.delete(chave);
    else novo.add(chave);
    onChange(catalogo.map((m) => m.chave).filter((c) => novo.has(c)));
  };
  return (
    <Stack spacing={0.5}>
      <Typography variant="body2" color="text.secondary">
        A base (clientes, equipamentos, produtos, OS, agenda, garantias, usuários e registro manual de nota) está
        sempre incluída.
      </Typography>
      {catalogo.map((m) => (
        <FormControlLabel
          key={m.chave}
          disabled={disabled}
          control={<Checkbox checked={marcados.has(m.chave)} onChange={() => alternar(m.chave)} />}
          label={
            <Box>
              <Typography variant="body2" fontWeight={600}>{m.nome}</Typography>
              <Typography variant="caption" color="text.secondary">{m.descricao}</Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", "& .MuiCheckbox-root": { pt: 0.5 } }}
        />
      ))}
    </Stack>
  );
}

export function ChipsModulos({ catalogo, valor }) {
  if (!valor?.length) return <Chip size="small" variant="outlined" label="Só a base" />;
  if (valor.length === catalogo.length) return <Chip size="small" color="primary" label="Todos os módulos" />;
  return (
    <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5 }}>
      {valor.map((c) => (
        <Chip key={c} size="small" label={catalogo.find((m) => m.chave === c)?.nome || c} />
      ))}
    </Stack>
  );
}

export function DialogoModulos({ aberto, titulo, texto, catalogo, inicial, onFechar, onSalvar }) {
  const [valor, setValor] = useState(inicial || []);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (aberto) {
      setValor(inicial || []);
      setErro("");
    }
  }, [aberto]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async () => {
    setOcupado(true);
    setErro("");
    try {
      await onSalvar(valor);
      onFechar();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={aberto} onClose={() => !ocupado && onFechar()} maxWidth="sm" fullWidth>
      <DialogTitle>{titulo}</DialogTitle>
      <DialogContent>
        {texto && <DialogContentText sx={{ mb: 2 }}>{texto}</DialogContentText>}
        <SeletorModulos catalogo={catalogo} valor={valor} onChange={setValor} disabled={ocupado} />
        {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</Button>
      </DialogActions>
    </Dialog>
  );
}
