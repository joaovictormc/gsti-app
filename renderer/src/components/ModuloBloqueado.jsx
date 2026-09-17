import { Alert, Box, Button, Paper, Stack, Typography } from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { moduloPorChave } from "../constants/modulos";

// Tela e aviso para módulos avançados que não estão incluídos no plano.

export function ModuloBloqueado({ modulo }) {
  const m = moduloPorChave(modulo);
  return (
    <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
      <Paper sx={{ p: 4, maxWidth: 520, textAlign: "center" }}>
        <LockOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>{m.nome}</Typography>
        <Typography color="text.secondary" sx={{ mb: 1 }}>{m.descricao}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Este módulo não está incluído no seu plano. Veja os planos disponíveis ou fale com o suporte para incluí-lo.
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} justifyContent="center">
          <Button variant="contained" onClick={() => window.api.openLicenseSite?.("planos")}>Ver planos</Button>
          <Button variant="outlined" onClick={() => window.api.openLicenseSite?.("cliente")}>Área do cliente</Button>
        </Stack>
      </Paper>
    </Box>
  );
}

// Aviso compacto dentro de uma tela (ex.: seções de Configurações)
export function AvisoModulo({ modulo, sx }) {
  const m = moduloPorChave(modulo);
  return (
    <Alert
      severity="info"
      icon={<LockOutlinedIcon fontSize="inherit" />}
      sx={sx}
      action={
        <Button color="inherit" size="small" onClick={() => window.api.openLicenseSite?.("planos")}>
          Ver planos
        </Button>
      }
    >
      <strong>{m.nome}</strong> — {m.descricao} Não incluído no seu plano.
    </Alert>
  );
}
