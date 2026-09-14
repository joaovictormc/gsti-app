import { useState } from "react";
import { Box, Button, Typography, Paper, Alert, Stack } from "@mui/material";
import LockClockIcon from "@mui/icons-material/LockClock";
import LicenseActivationForm from "../components/LicenseActivationForm";

// Situações em que basta tentar de novo com internet (sem digitar a chave).
const CODIGOS_REVALIDAVEIS = ["REVALIDAR", "RELOGIO"];

/**
 * Tela exibida quando o setup já foi concluído mas a licença está expirada,
 * revogada, inválida ou sem revalidação. Permite verificar novamente,
 * ativar com a chave de licença ou iniciar um teste.
 */
function ReactivationScreen({ motivo, codigo, onReactivated }) {
  const [verificando, setVerificando] = useState(false);
  const revalidavel = CODIGOS_REVALIDAVEIS.includes(codigo);

  const concluir = () => setTimeout(() => onReactivated?.(), 800);

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
        p: 2,
      }}
    >
      <Paper elevation={8} sx={{ p: 4, width: "100%", maxWidth: 480, borderRadius: 3 }}>
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

        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            revalidavel ? (
              <Button
                color="inherit"
                size="small"
                disabled={verificando}
                onClick={() => {
                  setVerificando(true);
                  onReactivated?.();
                }}
              >
                Verificar
              </Button>
            ) : null
          }
        >
          {motivo || "Sua licença não está mais ativa."}
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Informe sua chave de licença para reativar o sistema. Se o período de
          teste terminou, adquira uma licença para continuar usando — seus dados
          continuam salvos no banco.
        </Typography>

        <LicenseActivationForm onActivated={concluir} />
      </Paper>
    </Box>
  );
}

export default ReactivationScreen;
