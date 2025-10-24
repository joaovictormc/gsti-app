// EM: renderer/src/components/AnnualChart.jsx

import React from "react";
import { Paper, Typography, Box, CircularProgress } from "@mui/material";
import { Line } from "react-chartjs-2";
// Importa ChartJS e elementos necessários (assumindo registro global)
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// Função formatCurrency (pode vir de utils)
const formatCurrency = (value) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
};

// Define as props que o componente receberá
function AnnualChart({
  annualData, // Array com dados anuais (do backend)
  loadingAnnualChart, // Boolean indicando se está carregando
}) {
  // Configuração do Gráfico (opções e dados dependem das props)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: {
        display: true,
        text: `Resumo Anual (Últimos ${annualData.length} Anos)`,
      },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.dataset.label || ""}: ${formatCurrency(
              context.parsed.y
            )}`,
        },
      },
    },
    scales: { y: { ticks: { callback: (value) => formatCurrency(value) } } },
  };

  const chartData = {
    labels: annualData.map((d) => d?.year || ""), // Labels são os anos
    datasets: [
      {
        label: "Receita Total Anual",
        data: annualData.map((d) => d?.totalRevenue || 0),
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        tension: 0.1,
      },
      {
        label: "Despesa Total Anual",
        data: annualData.map((d) => d?.totalExpenses || 0),
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.1,
      },
    ],
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Comparativo Anual
      </Typography>
      <Box sx={{ height: 350, position: "relative" }}>
        {loadingAnnualChart && (
          <Box
            sx={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            <CircularProgress />
          </Box>
        )}
        {/* Renderiza condicionalmente baseado em loading e dados */}
        {!loadingAnnualChart && annualData.length > 0 && (
          <Line options={chartOptions} data={chartData} /> // Usa o componente Line
        )}
        {!loadingAnnualChart && annualData.length === 0 && (
          <Typography sx={{ textAlign: "center", mt: 4 }}>
            Nenhum dado anual encontrado.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default AnnualChart;
