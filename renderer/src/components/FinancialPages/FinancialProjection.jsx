import { useState, useEffect, useCallback } from "react";
import {
  Paper,
  Typography,
  Stack,
  Box,
  TextField,
  InputAdornment,
  Button,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

// Linha de indicador (rótulo à esquerda, valor à direita)
function Row({ label, value, color, bold }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary" fontWeight={bold ? 700 : 400}>
        {label}
      </Typography>
      <Typography
        variant={bold ? "h6" : "body1"}
        fontWeight={bold ? 700 : 500}
        color={color || "text.primary"}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function FinancialProjection({ months = 6 }) {
  const [loading, setLoading] = useState(true);
  const [avgRevenue, setAvgRevenue] = useState(0);
  const [avgVariableExpense, setAvgVariableExpense] = useState(0);
  const [monthsWithData, setMonthsWithData] = useState(0);
  const [fixedExpense, setFixedExpense] = useState("");
  const [savedFixedExpense, setSavedFixedExpense] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  // Carrega projeção + despesa fixa estimada
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [proj, cfg] = await Promise.all([
          window.api.getFinancialProjection({ months }),
          window.api.getFinancialConfig(),
        ]);
        if (!mounted) return;
        if (proj?.success) {
          setAvgRevenue(Number(proj.avgRevenue) || 0);
          setAvgVariableExpense(Number(proj.avgVariableExpense) || 0);
          setMonthsWithData(Number(proj.monthsWithData) || 0);
        }
        const fixed = Number(cfg?.financeiro?.despesaFixaEstimada) || 0;
        setSavedFixedExpense(fixed);
        setFixedExpense(fixed > 0 ? String(fixed) : "");
      } catch (_) {
        /* silencioso — mostra zeros */
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [months]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setStatus({ type: "", text: "" });
    try {
      const value = Number(fixedExpense) || 0;
      const result = await window.api.saveFinancialConfig({
        despesaFixaEstimada: value,
      });
      if (result.success) {
        setSavedFixedExpense(value);
        setStatus({ type: "success", text: "Despesa fixa estimada salva." });
      } else {
        setStatus({ type: "error", text: result.error || "Erro ao salvar." });
      }
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setSaving(false);
    }
  }, [fixedExpense]);

  const fixedValue = Number(fixedExpense) || 0;
  const projectedProfit = avgRevenue - avgVariableExpense - fixedValue;
  const isDirty = fixedValue !== savedFixedExpense;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={1}>
        <TrendingUpIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Projeção Financeira (Lucro Líquido Mensal Projetado)
        </Typography>
        <Tooltip
          title={`Médias calculadas sobre os últimos ${months} meses (${monthsWithData} com movimento). Fórmula: Receita Média − Despesa Variável Média − Despesa Fixa Estimada.`}
        >
          <InfoOutlinedIcon fontSize="small" color="disabled" sx={{ cursor: "help" }} />
        </Tooltip>
      </Stack>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Stack
          direction={{ xs: "column", md: "row" }}
          spacing={3}
          divider={<Divider orientation="vertical" flexItem />}
        >
          {/* Coluna 1: input da despesa fixa estimada */}
          <Box sx={{ minWidth: 260 }}>
            <Typography variant="body2" color="text.secondary" mb={1}>
              Informe sua despesa fixa mensal estimada (aluguel, salários,
              internet, etc.):
            </Typography>
            <TextField
              label="Despesa Fixa Estimada"
              type="number"
              value={fixedExpense}
              onChange={(e) => setFixedExpense(e.target.value)}
              fullWidth
              size="small"
              InputProps={{
                startAdornment: <InputAdornment position="start">R$</InputAdornment>,
                inputProps: { min: 0, step: "0.01" },
              }}
            />
            <Button
              variant="contained"
              size="small"
              onClick={handleSave}
              disabled={saving || !isDirty}
              sx={{ mt: 1.5 }}
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}
            >
              Salvar
            </Button>
            {status.text && (
              <Alert severity={status.type || "info"} sx={{ mt: 1.5 }}>
                {status.text}
              </Alert>
            )}
          </Box>

          {/* Coluna 2: composição da projeção */}
          <Box sx={{ flex: 1 }}>
            <Stack spacing={1.5}>
              <Row label="Receita Média Mensal" value={formatCurrency(avgRevenue)} color="success.main" />
              <Row
                label="(−) Despesa Variável Média"
                value={formatCurrency(avgVariableExpense)}
                color="error.main"
              />
              <Row
                label="(−) Despesa Fixa Estimada"
                value={formatCurrency(fixedValue)}
                color="error.main"
              />
              <Divider />
              <Row
                label="= Lucro Líquido Projetado"
                value={formatCurrency(projectedProfit)}
                color={projectedProfit >= 0 ? "success.main" : "error.main"}
                bold
              />
            </Stack>
            {monthsWithData === 0 && (
              <Typography variant="caption" color="text.disabled" sx={{ mt: 1, display: "block" }}>
                Sem movimento registrado nos últimos {months} meses — as médias
                estão zeradas.
              </Typography>
            )}
          </Box>
        </Stack>
      )}
    </Paper>
  );
}

export default FinancialProjection;
