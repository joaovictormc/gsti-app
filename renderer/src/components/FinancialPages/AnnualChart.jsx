import React from "react";
import { Paper, Typography, Box, CircularProgress } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

function AnnualChart({ annualData, loadingAnnualChart }) {
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
    labels: annualData.map((d) => d?.year || ""),
    datasets: [
      {
        label: "Receita Total Anual",
        data: annualData.map((d) => d?.totalRevenue || 0),
        borderColor: "#6366f1",
        backgroundColor: "rgba(99,102,241,0.12)",
        tension: 0.3,
        fill: true,
        pointBackgroundColor: "#6366f1",
        pointRadius: 5,
        pointHoverRadius: 7,
      },
      {
        label: "Despesa Total Anual",
        data: annualData.map((d) => d?.totalExpenses || 0),
        borderColor: "#ef4444",
        backgroundColor: "rgba(239,68,68,0.08)",
        tension: 0.3,
        fill: true,
        pointBackgroundColor: "#ef4444",
        pointRadius: 5,
        pointHoverRadius: 7,
      },
    ],
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" fontWeight={600} mb={2.5}>
        Comparativo Anual
      </Typography>
      <Box sx={{ height: 340, position: "relative" }}>
        {loadingAnnualChart && (
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
        {!loadingAnnualChart && annualData.length > 0 && (
          <Line options={chartOptions} data={chartData} />
        )}
        {!loadingAnnualChart && annualData.length === 0 && (
          <Box
            sx={{
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Typography color="text.secondary">
              Nenhum dado anual encontrado.
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

export default AnnualChart;
