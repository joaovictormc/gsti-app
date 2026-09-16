import { useRef, useState } from "react";
import {
  Alert, Box, Button, FormControlLabel, IconButton, MenuItem, Paper, Stack, Switch, TextField, Tooltip, Typography,
} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import DeleteIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import DragIcon from "@mui/icons-material/DragIndicator";
import { api } from "../../api";

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
        <Box sx={{ width: 150, height: 94, borderRadius: 2, border: "1px dashed", borderColor: "divider", bgcolor: "#faf8f3", display: "grid", placeItems: "center", overflow: "hidden", flex: "none" }}>
          {valor ? <img src={valor} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Typography variant="caption" color="text.secondary">Sem imagem</Typography>}
        </Box>
        <Stack spacing={1} sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => entrada.current.click()} disabled={enviando}>
              {enviando ? "Enviando…" : valor ? "Trocar imagem" : "Enviar imagem"}
            </Button>
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
  const resumo = (item) => {
    const primeiro = campo.campos.find((c) => ["texto", "textarea"].includes(c.tipo));
    return (primeiro && item[primeiro.nome]) || "";
  };

  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
        {campo.rotulo} <Typography component="span" variant="caption" color="text.secondary">({valor.length} de até {campo.max})</Typography>
      </Typography>
      <Stack spacing={1.5}>
        {valor.map((item, i) => (
          <Paper key={i} sx={{ p: 2, bgcolor: "#faf8f3" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
                {i + 1}. {resumo(item) || "(vazio)"}
              </Typography>
              <Stack direction="row">
                <Tooltip title="Mover para cima"><span><IconButton size="small" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Mover para baixo"><span><IconButton size="small" disabled={i === valor.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
                <Tooltip title="Remover"><IconButton size="small" color="error" onClick={() => onChange(valor.filter((_v, j) => j !== i))}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
              </Stack>
            </Stack>
            <Stack spacing={2}>
              {campo.campos.map((c) => (
                <Campo key={c.nome} campo={c} valor={item[c.nome]} onChange={(v) => atualizar(i, { ...item, [c.nome]: v })} />
              ))}
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

// Ordena e mostra/oculta as seções da página inicial.
function CampoOrdem({ campo, valor = [], onChange }) {
  const rotulos = Object.fromEntries(campo.opcoes.map((o) => [o.id, o.rotulo]));
  const mover = (i, d) => {
    const n = [...valor];
    [n[i], n[i + d]] = [n[i + d], n[i]];
    onChange(n);
  };
  return (
    <Box>
      <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>{campo.rotulo}</Typography>
      <Stack spacing={1}>
        {valor.map((item, i) => (
          <Paper key={item.id} sx={{ p: 1, pl: 1.5, display: "flex", alignItems: "center", gap: 1, bgcolor: item.visivel ? "#fff" : "#f4f1ea" }}>
            <DragIcon fontSize="small" sx={{ color: "text.disabled" }} />
            <Typography sx={{ flex: 1, fontWeight: 500, color: item.visivel ? "text.primary" : "text.disabled" }}>
              {rotulos[item.id] || item.id}
            </Typography>
            <FormControlLabel
              control={<Switch size="small" checked={item.visivel !== false} onChange={(e) => onChange(valor.map((v, j) => (j === i ? { ...v, visivel: e.target.checked } : v)))} />}
              label={<Typography variant="caption">{item.visivel !== false ? "Visível" : "Oculta"}</Typography>}
              sx={{ mr: 0 }}
            />
            <Tooltip title="Subir"><span><IconButton size="small" disabled={i === 0} onClick={() => mover(i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Descer"><span><IconButton size="small" disabled={i === valor.length - 1} onClick={() => mover(i, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton></span></Tooltip>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
}

export default function Campo({ campo, valor, onChange }) {
  switch (campo.tipo) {
    case "booleano":
      return <FormControlLabel control={<Switch checked={!!valor} onChange={(e) => onChange(e.target.checked)} />} label={campo.rotulo} />;
    case "escolha":
      return (
        <TextField select label={campo.rotulo} value={valor ?? campo.opcoes[campo.opcoes.length - 1].id} onChange={(e) => onChange(e.target.value)} fullWidth>
          {campo.opcoes.map((o) => <MenuItem key={o.id} value={o.id}>{o.rotulo}</MenuItem>)}
        </TextField>
      );
    case "imagem":
      return <CampoImagem campo={campo} valor={valor} onChange={onChange} />;
    case "lista":
      return <CampoLista campo={campo} valor={valor} onChange={onChange} />;
    case "ordem":
      return <CampoOrdem campo={campo} valor={valor} onChange={onChange} />;
    case "markdown":
      return (
        <TextField
          label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} multiline minRows={10} fullWidth
          helperText={`Formatação: ## Título, **negrito**, *itálico*, - lista, [texto](https://link) · ${(valor || "").length}/${campo.max}`}
          slotProps={{ htmlInput: { maxLength: campo.max, style: { fontFamily: "JetBrains Mono, monospace", fontSize: 13 } } }}
        />
      );
    case "textarea":
      return (
        <TextField
          label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} multiline minRows={3} fullWidth
          slotProps={{ htmlInput: { maxLength: campo.max } }} helperText={campo.ajuda || `${(valor || "").length}/${campo.max}`}
        />
      );
    case "url":
      return <TextField label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} fullWidth placeholder="https://" helperText={campo.ajuda} />;
    default:
      return (
        <TextField
          label={campo.rotulo} value={valor ?? ""} onChange={(e) => onChange(e.target.value)} fullWidth
          slotProps={{ htmlInput: { maxLength: campo.max } }} helperText={campo.ajuda}
        />
      );
  }
}
