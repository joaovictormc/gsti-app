import React from "react";
import { Paper, Typography, Stack, TextField, Box, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const MONTH_LABELS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

function MonthlyChart({ selectedYear, onYearChange, monthlyData, loadingChart }) {
  const theme = useTheme();
  const textColor = theme.palette.text.primary;
  const subTextColor = theme.palette.text.secondary;
  const gridColor = theme.palette.divider;

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: { color: textColor, padding: 16, usePointStyle: true, pointStyleWidth: 10 },
      },
      title: { display: false },
      tooltip: {
        callbacks: {
          label: (context) => `${context.dataset.label || ""}: ${formatCurrency(context.parsed.y)}`,
        },
      },
    },
    scales: {
      x: {
        ticks: { color: subTextColor },
        grid: { color: gridColor },
        border: { color: gridColor },
      },
      y: {
        ticks: { callback: (value) => formatCurrency(value), color: subTextColor },
        grid: { color: gridColor },
        border: { color: gridColor },
      },
    },
  };

  const chartData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: "Receita Total",
        data: monthlyData.map((d) => d?.totalRevenue || 0),
        backgroundColor: "rgba(99,102,241,0.75)",
        borderColor: "#6366f1",
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
      {
        label: "Despesa Total",
        data: monthlyData.map((d) => d?.totalExpenses || 0),
        backgroundColor: "rgba(239,68,68,0.75)",
        borderColor: "#ef4444",
        borderWidth: 1,
        borderRadius: 4,
        borderSkipped: false,
      },
    ],
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={2.5}>
        <Typography variant="h6" fontWeight={600}>
          Comparativo Mensal
        </Typography>
        <TextField
          label="Ano"
          type="number"
          size="small"
          value={selectedYear}
          onChange={(e) => onYearChange(e.target.value)}
          inputProps={{ min: 2000, max: 2100 }}
          sx={{ width: 110, ml: "auto" }}
          disabled={loadingChart}
        />
      </Stack>
      <Box sx={{ height: 340, position: "relative" }}>
        {loadingChart && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {!loadingChart && monthlyData.length > 0 && (
          <Bar options={chartOptions} data={chartData} />
        )}
        {!loadingChart && monthlyData.length === 0 && (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              Nenhum dado encontrado para {selectedYear}.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default MonthlyChart;
