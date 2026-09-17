import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import SystemUpdateAltIcon from "@mui/icons-material/SystemUpdateAlt";

// Estado da atualização automática (vem do processo principal, ver atualizacoes.js)
export function useAtualizacao() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    let ativo = true;
    window.api.getUpdateStatus?.().then((r) => ativo && r?.success && setEstado(r.estado)).catch(() => {});
    const parar = window.api.onUpdateStatus?.((novo) => ativo && setEstado(novo));
    return () => {
      ativo = false;
      parar?.();
    };
  }, []);
  return estado;
}

function Notas({ texto }) {
  if (!texto) return null;
  return (
    <Box
      sx={{
        mt: 1,
        maxHeight: 220,
        overflowY: "auto",
        whiteSpace: "pre-wrap",
        fontSize: 13,
        color: "text.secondary",
        bgcolor: "action.hover",
        borderRadius: 1,
        p: 1.5,
      }}
    >
      {/* Markdown simples do CHANGELOG: sem negrito/títulos para ficar legível em texto puro */}
      {texto.replace(/\*\*/g, "").replace(/^#+\s*/gm, "")}
    </Box>
  );
}

// Aviso no topo da tela quando a nova versão já foi baixada
export function AvisoAtualizacao() {
  const estado = useAtualizacao();
  const [fechado, setFechado] = useState(null);
  const [verNotas, setVerNotas] = useState(false);
  const [instalando, setInstalando] = useState(false);

  if (estado?.fase !== "pronta" || fechado === estado.versaoNova) return null;

  const instalar = async () => {
    setInstalando(true);
    const r = await window.api.installUpdate();
    if (!r?.success) setInstalando(false);
  };

  return (
    <Alert
      severity="info"
      icon={<SystemUpdateAltIcon />}
      onClose={() => setFechado(estado.versaoNova)}
      sx={{ mb: 2, "& .MuiAlert-message": { flexGrow: 1 } }}
      action={
        <Button color="inherit" size="small" variant="outlined" onClick={instalar} disabled={instalando} sx={{ whiteSpace: "nowrap", mr: 1 }}>
          {instalando ? "Reiniciando…" : "Reiniciar e atualizar"}
        </Button>
      }
    >
      <strong>Versão {estado.versaoNova} pronta para instalar.</strong> Ela também será instalada
      automaticamente quando o sistema for fechado.
      {estado.notas && (
        <>
          {" "}
          <Button size="small" color="inherit" onClick={() => setVerNotas((v) => !v)} sx={{ p: 0, minWidth: 0, textDecoration: "underline" }}>
            {verNotas ? "Ocultar novidades" : "Ver novidades"}
          </Button>
          <Collapse in={verNotas}>
            <Notas texto={estado.notas} />
          </Collapse>
        </>
      )}
    </Alert>
  );
}

const FASES = {
  ocioso: { rotulo: "Aguardando verificação", cor: "default" },
  verificando: { rotulo: "Verificando…", cor: "info" },
  baixando: { rotulo: "Baixando atualização", cor: "info" },
  pronta: { rotulo: "Atualização pronta", cor: "success" },
  atualizado: { rotulo: "Sistema atualizado", cor: "success" },
  erro: { rotulo: "Falha na verificação", cor: "warning" },
  indisponivel: { rotulo: "Indisponível", cor: "default" },
};

// Seção "Atualizações" nas Configurações
export function SecaoAtualizacoes() {
  const estado = useAtualizacao();
  const [verificando, setVerificando] = useState(false);

  const verificar = async () => {
    setVerificando(true);
    try {
      await window.api.checkForUpdates();
    } finally {
      setVerificando(false);
    }
  };

  const fase = FASES[estado?.fase] || FASES.ocioso;
  const ocupado = verificando || estado?.fase === "verificando" || estado?.fase === "baixando";

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
        <SystemUpdateAltIcon color="primary" />
        <Typography variant="h6">Atualizações</Typography>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        O sistema procura novas versões ao abrir e a cada 6 horas, baixa em segundo plano e instala ao
        reiniciar. Seus dados e configurações são mantidos. É preciso ter uma licença válida.
      </Typography>

      <Stack direction="row" spacing={1.5} sx={{ mb: 2, alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        <Typography variant="body2">
          Versão instalada: <strong>{estado?.versaoAtual || "—"}</strong>
        </Typography>
        <Chip size="small" label={fase.rotulo} color={fase.cor} />
        {estado?.verificadoEm && (
          <Typography variant="caption" color="text.secondary">
            Última verificação: {new Date(estado.verificadoEm).toLocaleString("pt-BR")}
          </Typography>
        )}
      </Stack>

      {estado?.fase === "baixando" && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.5 }}>
            Baixando a versão {estado.versaoNova} ({estado.progresso || 0}%)
          </Typography>
          <LinearProgress variant="determinate" value={estado.progresso || 0} />
        </Box>
      )}

      {estado?.fase === "pronta" && (
        <Alert severity="success" sx={{ mb: 2 }}>
          A versão <strong>{estado.versaoNova}</strong> foi baixada. Use "Reiniciar e atualizar" ou apenas feche o
          sistema quando terminar o expediente.
          <Notas texto={estado.notas} />
        </Alert>
      )}

      {estado?.erro && estado.fase !== "pronta" && (
        <Alert severity={estado.fase === "indisponivel" ? "info" : "warning"} sx={{ mb: 2 }}>
          {estado.erro}
        </Alert>
      )}

      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <Button
          variant="outlined"
          onClick={verificar}
          disabled={ocupado || estado?.fase === "pronta"}
          startIcon={ocupado ? <CircularProgress size={18} color="inherit" /> : null}
        >
          Verificar atualizações
        </Button>
        {estado?.fase === "pronta" && (
          <Button variant="contained" onClick={() => window.api.installUpdate()}>
            Reiniciar e atualizar
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
