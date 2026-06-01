import { useState, useEffect, useCallback } from "react";
import {
  Paper,
  Typography,
  Stack,
  Box,
  TextField,
  InputAdornment,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
  Tooltip,
  LinearProgress,
} from "@mui/material";
import SavingsIcon from "@mui/icons-material/Savings";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    value || 0
  );

const formatMonthsToYears = (totalMonths) => {
  if (!totalMonths || totalMonths <= 0) return null;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ano${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} ${months > 1 ? "meses" : "mês"}`);
  return parts.join(" e ") || `${totalMonths} mês`;
};

function FinancialGoals({ averageProfit = 0 }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [adding, setAdding] = useState(false);
  const [status, setStatus] = useState({ type: "", text: "" });

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.getFinancialGoals();
      setGoals(result?.success ? result.data : []);
    } catch (_) {
      setGoals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleAdd = useCallback(async () => {
    setStatus({ type: "", text: "" });
    const desc = descricao.trim();
    const value = parseFloat(valor);
    if (!desc) {
      setStatus({ type: "error", text: "Informe uma descrição para a meta." });
      return;
    }
    if (!isFinite(value) || value <= 0) {
      setStatus({ type: "error", text: "Informe um valor maior que zero." });
      return;
    }
    setAdding(true);
    try {
      const result = await window.api.addFinancialGoal({ descricao: desc, valor: value });
      if (result.success) {
        setDescricao("");
        setValor("");
        await loadGoals();
      } else {
        setStatus({ type: "error", text: result.error || "Erro ao adicionar meta." });
      }
    } catch (error) {
      setStatus({ type: "error", text: error.message });
    } finally {
      setAdding(false);
    }
  }, [descricao, valor, loadGoals]);

  const handleDelete = useCallback(
    async (id) => {
      try {
        const result = await window.api.deleteFinancialGoal(id);
        if (result.success) {
          setGoals((prev) => prev.filter((g) => g.id !== id));
        }
      } catch (_) {
        /* silencioso */
      }
    },
    []
  );

  const canEstimate = averageProfit > 0;

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2}>
        <SavingsIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Metas Financeiras
        </Typography>
      </Stack>

      {/* Formulário de adição */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", sm: "flex-start" }}
        mb={2}
      >
        <TextField
          label="Descrição da meta"
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          size="small"
          sx={{ flex: 1 }}
          placeholder="Ex: Comprar novo equipamento"
        />
        <TextField
          label="Valor"
          type="number"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          size="small"
          sx={{ minWidth: 160 }}
          InputProps={{
            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            inputProps: { min: 0, step: "0.01" },
          }}
        />
        <Button
          variant="contained"
          onClick={handleAdd}
          disabled={adding}
          startIcon={adding ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
        >
          Adicionar
        </Button>
      </Stack>

      {status.text && (
        <Alert severity={status.type || "info"} sx={{ mb: 2 }} onClose={() => setStatus({ type: "", text: "" })}>
          {status.text}
        </Alert>
      )}

      {!canEstimate && (
        <Typography variant="caption" color="text.disabled" sx={{ display: "block", mb: 1 }}>
          O lucro médio mensal está zero ou negativo — o tempo estimado para
          atingir as metas não pode ser calculado no momento.
        </Typography>
      )}

      <Divider sx={{ mb: 1 }} />

      {/* Lista de metas */}
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress />
        </Box>
      ) : goals.length === 0 ? (
        <Box sx={{ py: 3, textAlign: "center" }}>
          <Typography color="text.secondary" variant="body2">
            Nenhuma meta cadastrada. Adicione uma acima.
          </Typography>
        </Box>
      ) : (
        <List disablePadding>
          {goals.map((goal) => {
            const monthsToGoal = canEstimate
              ? Math.ceil(goal.valor / averageProfit)
              : null;
            const formatted = formatMonthsToYears(monthsToGoal);
            // Progresso de 1 mês de lucro em relação à meta (referência visual)
            const oneMonthPct = canEstimate
              ? Math.min((averageProfit / goal.valor) * 100, 100)
              : 0;
            return (
              <ListItem
                key={goal.id}
                divider
                secondaryAction={
                  <Tooltip title="Excluir meta">
                    <IconButton edge="end" color="error" onClick={() => handleDelete(goal.id)}>
                      <DeleteOutlineIcon />
                    </IconButton>
                  </Tooltip>
                }
                sx={{ alignItems: "flex-start", py: 1.5 }}
              >
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                      <Typography variant="subtitle1" fontWeight={600}>
                        {goal.descricao}
                      </Typography>
                      <Chip label={formatCurrency(goal.valor)} size="small" color="primary" variant="outlined" />
                    </Stack>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      {formatted ? (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <CheckCircleOutlineIcon fontSize="small" color="success" />
                          <Typography variant="body2" color="text.secondary">
                            Tempo estimado: <strong>{formatted}</strong>
                          </Typography>
                        </Stack>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          Tempo estimado indisponível
                        </Typography>
                      )}
                      {canEstimate && (
                        <Box sx={{ mt: 0.75, maxWidth: 320 }}>
                          <LinearProgress
                            variant="determinate"
                            value={oneMonthPct}
                            sx={{ height: 6, borderRadius: 3 }}
                          />
                          <Typography variant="caption" color="text.disabled">
                            ~{oneMonthPct.toFixed(1)}% da meta por mês de lucro médio
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
      )}
    </Paper>
  );
}

export default FinancialGoals;
