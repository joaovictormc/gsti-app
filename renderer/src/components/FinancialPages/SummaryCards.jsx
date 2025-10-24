import React from "react";
import {
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Tooltip as MuiTooltip,
} from "@mui/material";

// Função auxiliar para formatar moeda (pode vir de um arquivo utils no futuro)
const formatCurrency = (value) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

// Define as props que o componente receberá
function SummaryCards({
  summary, // Objeto com os totais (totalRevenue, totalExpenses, etc.)
  loadingSummary, // Boolean indicando se o resumo principal está carregando
  averageProfit, // Valor do lucro médio
  loadingAverageProfit, // Boolean indicando se a média está carregando
  averageProfitMonths, // Número de meses usados na média (para o tooltip)
}) {
  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {/* Receita Total */}
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#e3f2fd" }}>
          <Typography variant="subtitle1" color="textSecondary">
            Receita Total
          </Typography>
          {loadingSummary ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant="h5" color="primary">
              {formatCurrency(summary.totalRevenue)}
            </Typography>
          )}
        </Paper>
      </Grid>

      {/* Despesa Total */}
      <Grid item xs={12} sm={6} md={3}>
        <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#ffebee" }}>
          <Typography variant="subtitle1" color="textSecondary">
            Despesa Total
          </Typography>
          {loadingSummary ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant="h5" color="error">
              {formatCurrency(summary.totalExpenses)}
            </Typography>
          )}
        </Paper>
      </Grid>

      {/* Lucro Líquido */}
      <Grid item xs={12} sm={6} md={3}>
        <Paper
          sx={{
            p: 2,
            textAlign: "center",
            backgroundColor: summary.netProfit >= 0 ? "#e8f5e9" : "#ffebee",
          }}
        >
          <Typography variant="subtitle1" color="textSecondary">
            Lucro Líquido
          </Typography>
          {loadingSummary ? (
            <CircularProgress size={24} />
          ) : (
            <Typography
              variant="h5"
              color={summary.netProfit >= 0 ? "success.main" : "error.main"}
            >
              {formatCurrency(summary.netProfit)}
            </Typography>
          )}
        </Paper>
      </Grid>

      {/* Lucro Médio Mensal */}
      <Grid item xs={12} sm={6} md={3}>
        <MuiTooltip
          title={`Média dos últimos ${averageProfitMonths} meses com movimentação.`}
        >
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#f3e5f5" }}>
            <Typography variant="subtitle1" color="textSecondary">
              Lucro Médio Mensal
            </Typography>
            {loadingAverageProfit ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h5" color="secondary.dark">
                {formatCurrency(averageProfit)}
              </Typography>
            )}
          </Paper>
        </MuiTooltip>
      </Grid>

      {/* Despesas Fixas (Período) */}
      <Grid item xs={6} md={3}>
        <Paper sx={{ p: 1.5, textAlign: "center", backgroundColor: "#fff3e0" }}>
          <Typography variant="caption" color="textSecondary">
            Despesas Fixas (Período)
          </Typography>
          {loadingSummary ? (
            <CircularProgress size={20} />
          ) : (
            <Typography variant="h6" color="warning.dark">
              {formatCurrency(summary.totalFixedExpenses)}
            </Typography>
          )}
        </Paper>
      </Grid>

      {/* Despesas Variáveis (Período) */}
      <Grid item xs={6} md={9}>
        {" "}
        {/* Ocupa o resto da linha */}
        <Paper sx={{ p: 1.5, textAlign: "center", backgroundColor: "#ffcdd2" }}>
          <Typography variant="caption" color="textSecondary">
            Despesas Variáveis (Período)
          </Typography>
          {loadingSummary ? (
            <CircularProgress size={20} />
          ) : (
            <Typography variant="h6" color="error.dark">
              {formatCurrency(summary.totalVariableExpenses)}
            </Typography>
          )}
        </Paper>
      </Grid>
    </Grid>
  );
}

export default SummaryCards;
