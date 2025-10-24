import React from 'react'; // Import React explicitamente
import {
  Paper, Typography, Stack, TextField, Box, CircularProgress
} from '@mui/material';
import { Bar } from 'react-chartjs-2';
// Importa ChartJS e os elementos necessários, MESMO QUE NÃO USADOS DIRETAMENTE AQUI,
// pois o componente <Bar> depende deles estarem registrados globalmente (feito no FinancialDashboard).
// Alternativamente, poderíamos registrar aqui também se este fosse um componente mais independente.
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js';

// Define os meses (pode vir de constantes globais)
const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

// Função formatCurrency (pode vir de utils)
const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);
};

// Define as props que o componente receberá
function MonthlyChart({
    selectedYear,       // Ano atual selecionado (string)
    onYearChange,       // Função para atualizar o ano no pai
    monthlyData,        // Array com dados mensais (do backend)
    loadingChart        // Boolean indicando se está carregando
}) {

  // Configuração do Gráfico (opções e dados dependem das props)
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' },
      title: { display: true, text: `Resumo Mensal - ${selectedYear}` }, // Usa selectedYear
      tooltip: { callbacks: { label: context => `${context.dataset.label || ''}: ${formatCurrency(context.parsed.y)}` } }
    },
    scales: { y: { ticks: { callback: value => formatCurrency(value) } } }
  };

  const chartData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: 'Receita Total',
        // Usa monthlyData vindo das props
        data: monthlyData.map((d) => d?.totalRevenue || 0),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgb(75, 192, 192)',
        borderWidth: 1,
      },
      {
        label: 'Despesa Total',
        // Usa monthlyData vindo das props
        data: monthlyData.map((d) => d?.totalExpenses || 0),
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center" mb={2}>
        <Typography variant="h6">Comparativo Mensal</Typography>
        <TextField
          label="Ano"
          type="number"
          size="small"
          value={selectedYear}
          // Chama a função passada via prop
          onChange={(e) => onYearChange(e.target.value)}
          inputProps={{ min: 2000, max: 2100 }}
          sx={{ width: 120 }}
          disabled={loadingChart} // Desabilita durante o load
        />
      </Stack>
      <Box sx={{ height: 350, position: 'relative' }}>
        {loadingChart && (
          <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <CircularProgress />
          </Box>
        )}
        {/* Renderiza condicionalmente baseado em loading e dados */}
        {!loadingChart && monthlyData.length > 0 && (
          <Bar options={chartOptions} data={chartData} />
        )}
        {!loadingChart && monthlyData.length === 0 && (
          <Typography sx={{ textAlign: 'center', mt: 4 }}>
            Nenhum dado encontrado para {selectedYear}.
          </Typography>
        )}
      </Box>
    </Paper>
  );
}

export default MonthlyChart;