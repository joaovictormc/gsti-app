import { useState, useEffect } from "react";
import {
  Box, Button, TextField, Typography, Paper, Grid, Stack, CircularProgress
} from "@mui/material";

// Função auxiliar para formatar data para YYYY-MM-DD
const toInputDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split('T')[0];
};

// Funções auxiliares para obter períodos comuns
const getMonthDateRange = (date) => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0); // O dia 0 do próximo mês é o último dia do mês atual
  return {
    startDate: toInputDateString(startOfMonth),
    endDate: toInputDateString(endOfMonth),
  };
};

const getYearDateRange = (date) => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const endOfYear = new Date(date.getFullYear(), 11, 31);
  return {
    startDate: toInputDateString(startOfYear),
    endDate: toInputDateString(endOfYear),
  };
};

function FinancialDashboard() {
  const today = new Date();
  const currentMonthRange = getMonthDateRange(today);

  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 });
  const [loading, setLoading] = useState(false);

  // Efeito para buscar o resumo quando as datas mudam
  useEffect(() => {
    const fetchSummary = async () => {
      if (startDate && endDate) {
        setLoading(true);
        const result = await window.api.getFinancialSummary({ startDate, endDate });
        if (result.success) {
          setSummary(result.summary);
        } else {
          console.error("Erro ao buscar resumo financeiro:", result.error);
          // Opcional: Mostrar um alerta para o usuário
          // alert(`Erro ao buscar resumo: ${result.error}`);
          setSummary({ totalRevenue: 0, totalExpenses: 0, netProfit: 0 }); // Reseta em caso de erro
        }
        setLoading(false);
      }
    };

    fetchSummary();
  }, [startDate, endDate]); // Re-executa sempre que startDate ou endDate mudar

  // Funções para definir períodos pré-definidos
  const setPeriodThisMonth = () => {
    const range = getMonthDateRange(new Date());
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const setPeriodLastMonth = () => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const range = getMonthDateRange(lastMonth);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  const setPeriodThisYear = () => {
    const range = getYearDateRange(new Date());
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  };

  // Função para formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Resumo Financeiro
      </Typography>

      {/* Seleção de Período */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>Selecionar Período</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" mb={2}>
          <TextField
            label="Data Início"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
          <TextField
            label="Data Fim"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
          />
        </Stack>
        <Stack direction="row" spacing={1} justifyContent="flex-start" flexWrap="wrap">
          <Button size="small" variant="outlined" onClick={setPeriodThisMonth}>Este Mês</Button>
          <Button size="small" variant="outlined" onClick={setPeriodLastMonth}>Mês Passado</Button>
          <Button size="small" variant="outlined" onClick={setPeriodThisYear}>Este Ano</Button>
        </Stack>
      </Paper>

      {/* Exibição do Resumo */}
      <Grid container spacing={3}>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#e3f2fd' }}>
            <Typography variant="subtitle1" color="textSecondary">Receita Total</Typography>
            {loading ? <CircularProgress size={24} /> : (
              <Typography variant="h5" color="primary">{formatCurrency(summary.totalRevenue)}</Typography>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: '#ffebee' }}>
            <Typography variant="subtitle1" color="textSecondary">Despesa Total</Typography>
             {loading ? <CircularProgress size={24} /> : (
               <Typography variant="h5" color="error">{formatCurrency(summary.totalExpenses)}</Typography>
             )}
          </Paper>
        </Grid>
        <Grid item xs={12} sm={4}>
          <Paper sx={{ p: 2, textAlign: 'center', backgroundColor: summary.netProfit >= 0 ? '#e8f5e9' : '#ffebee' }}>
            <Typography variant="subtitle1" color="textSecondary">Lucro Líquido</Typography>
             {loading ? <CircularProgress size={24} /> : (
               <Typography variant="h5" color={summary.netProfit >= 0 ? 'success.main' : 'error.main'}>{formatCurrency(summary.netProfit)}</Typography>
             )}
          </Paper>
        </Grid>
      </Grid>
    </>
  );
}

export default FinancialDashboard;