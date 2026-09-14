import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import KeyIcon from "@mui/icons-material/VpnKey";
import TimerIcon from "@mui/icons-material/Timer";

// Formata a digitação/colagem como GSTI-XXXX-XXXX-XXXX-XXXX.
function formatLicenseKey(value) {
  let s = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.startsWith("GSTI")) s = s.slice(4);
  s = s.slice(0, 16);
  const grupos = s.match(/.{1,4}/g) || [];
  return grupos.length ? `GSTI-${grupos.join("-")}` : "";
}

const chaveCompleta = (v) => /^GSTI(-[A-Z0-9]{4}){4}$/.test(v);
const emailValido = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * Formulário de ativação: chave de licença (compra) ou teste grátis (e-mail).
 * onActivated(license) é chamado após sucesso.
 */
function LicenseActivationForm({ onActivated, trialDays = 7 }) {
  const [mode, setMode] = useState("key");
  const [chave, setChave] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ loading: false, error: "", success: false });

  const podeEnviar = mode === "key" ? chaveCompleta(chave) : emailValido(email);

  const enviar = async (e) => {
    e?.preventDefault();
    if (!podeEnviar || status.loading) return;
    setStatus({ loading: true, error: "", success: false });
    try {
      const result =
        mode === "key"
          ? await window.api.activateLicense({ chave })
          : await window.api.startTrial({ email: email.trim() });
      if (result?.success) {
        setStatus({ loading: false, error: "", success: true });
        onActivated?.(result.license);
      } else {
        setStatus({ loading: false, error: result?.error || "Falha na ativação.", success: false });
      }
    } catch {
      setStatus({
        loading: false,
        error: "Erro ao contatar o servidor de licenças. Tente novamente.",
        success: false,
      });
    }
  };

  const trocarModo = (_e, novo) => {
    if (!novo) return;
    setMode(novo);
    setStatus({ loading: false, error: "", success: false });
  };

  return (
    <Box component="form" onSubmit={enviar} noValidate>
      <ToggleButtonGroup
        value={mode}
        exclusive
        onChange={trocarModo}
        fullWidth
        size="small"
        color="primary"
        disabled={status.loading}
        sx={{ mb: 2 }}
      >
        <ToggleButton value="key">
          <KeyIcon fontSize="small" sx={{ mr: 1 }} /> Tenho uma chave
        </ToggleButton>
        <ToggleButton value="trial">
          <TimerIcon fontSize="small" sx={{ mr: 1 }} /> Testar {trialDays} dias grátis
        </ToggleButton>
      </ToggleButtonGroup>

      {mode === "key" ? (
        <TextField
          label="Chave de licença"
          placeholder="GSTI-XXXX-XXXX-XXXX-XXXX"
          value={chave}
          onChange={(e) => {
            setChave(formatLicenseKey(e.target.value));
            setStatus({ loading: false, error: "", success: false });
          }}
          helperText="Enviada para o seu e-mail após a compra."
          fullWidth
          autoFocus
          disabled={status.loading}
          slotProps={{
            htmlInput: {
              spellCheck: false,
              autoComplete: "off",
              style: { fontFamily: "monospace", letterSpacing: 1 },
            },
          }}
        />
      ) : (
        <TextField
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setStatus({ loading: false, error: "", success: false });
          }}
          helperText="O teste pode ser usado uma vez por e-mail e por computador."
          fullWidth
          autoFocus
          disabled={status.loading}
        />
      )}

      {status.error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {status.error}
        </Alert>
      )}
      {status.success && (
        <Alert severity="success" sx={{ mt: 2 }}>
          {mode === "key" ? "Licença ativada com sucesso!" : "Período de teste iniciado!"}
        </Alert>
      )}

      <Button
        type="submit"
        variant="contained"
        fullWidth
        sx={{ mt: 2 }}
        disabled={!podeEnviar || status.loading || status.success}
        startIcon={status.loading ? <CircularProgress size={20} color="inherit" /> : null}
      >
        {mode === "key" ? "Ativar licença" : "Iniciar teste grátis"}
      </Button>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
        É necessário estar conectado à internet para ativar.
        {mode === "key" && (
          <>
            {" "}Não tem uma chave?{" "}
            <Link component="button" type="button" variant="caption" onClick={() => window.api.openLicenseSite?.("planos")}>
              Ver planos
            </Link>
          </>
        )}
      </Typography>
    </Box>
  );
}

export default LicenseActivationForm;
