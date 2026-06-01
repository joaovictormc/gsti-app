import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Stack,
} from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";

/**
 * Tela exibida quando o setup já foi concluído mas a licença está
 * expirada, revogada ou inválida. Permite reativar (licença definitiva)
 * ou iniciar/retomar um teste.
 */
function ReactivationScreen({ motivo, onReactivated }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const handle = async (mode) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setStatus({ loading: false, error: "Informe um e-mail válido.", success: false });
      return;
    }
    setStatus({ loading: mode, error: "", success: false });
    try {
      const fn = mode === "trial" ? window.api.startTrial : window.api.activateLicense;
      const result = await fn({ email: email.trim() });
      if (result.success) {
        setStatus({ loading: false, error: "", success: true });
        // Pequeno respiro para o usuário ver a confirmação
        setTimeout(() => onReactivated && onReactivated(), 800);
      } else {
        setStatus({ loading: false, error: result.error || "Falha na ativação.", success: false });
      }
    } catch (_) {
      setStatus({
        loading: false,
        error: "Erro ao contatar o servidor de ativação. Verifique sua conexão.",
        success: false,
      });
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
        p: 2,
      }}
    >
      <Paper elevation={8} sx={{ p: 4, width: "100%", maxWidth: 460, borderRadius: 3 }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 2 }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: 2,
              bgcolor: "warning.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <LockClockIcon sx={{ color: "white" }} />
          </Box>
          <Typography variant="h5" fontWeight={700} align="center">
            Ativação necessária
          </Typography>
        </Stack>

        <Alert severity="warning" sx={{ mb: 2 }}>
          {motivo || "Sua licença não está mais ativa."}
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Informe o e-mail da sua licença para reativar o sistema. Se foi um
          período de teste expirado, contrate para continuar usando.
        </Typography>

        <TextField
          label="E-mail"
          type="email"
          fullWidth
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus({ loading: false, error: "", success: false });
          }}
          disabled={!!status.loading}
          sx={{ mb: 2 }}
        />

        {status.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {status.error}
          </Alert>
        )}
        {status.success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            Licença reativada! Carregando…
          </Alert>
        )}

        <Stack direction="row" spacing={2}>
          <Button
            variant="contained"
            fullWidth
            onClick={() => handle("activate")}
            disabled={!!status.loading}
            startIcon={status.loading === "activate" ? <CircularProgress size={20} color="inherit" /> : null}
          >
            Ativar Licença
          </Button>
          <Button
            variant="outlined"
            fullWidth
            onClick={() => handle("trial")}
            disabled={!!status.loading}
            startIcon={status.loading === "trial" ? <CircularProgress size={20} color="inherit" /> : null}
          >
            Testar 7 dias
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}

export default ReactivationScreen;
