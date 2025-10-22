import { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Grid,
  Stack,
  CircularProgress,
  Alert, 
} from "@mui/material";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
} from "chart.js";

// Registra os componentes necessários do Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement
);

// Função auxiliar para formatar data para YYYY-MM-DD (MAIS ROBUSTA)
const toInputDateString = (date) => {
  try {
    if (!date) return "";
    const d = new Date(date);
    // Verifica se a data é válida
    if (isNaN(d.getTime())) {
      console.error("Data inválida recebida:", date);
      return ""; // Retorna string vazia se inválida
    }
    // Formata corretamente para YYYY-MM-DD
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0"); // Mês é 0-indexado
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Erro ao formatar data:", date, error);
    return "";
  }
};

// Funções auxiliares para obter períodos comuns (MAIS ROBUSTAS)
const getMonthDateRange = (date) => {
  try {
    const validDate = new Date(date);
    if (isNaN(validDate.getTime()))
      throw new Error("Data inválida para getMonthDateRange");
    const startOfMonth = new Date(
      validDate.getFullYear(),
      validDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      validDate.getFullYear(),
      validDate.getMonth() + 1,
      0
    );
    return {
      startDate: toInputDateString(startOfMonth),
      endDate: toInputDateString(endOfMonth),
    };
  } catch (error) {
    console.error(error);
    const today = new Date();
    return {
      // Retorna o mês atual como fallback seguro
      startDate: toInputDateString(
        new Date(today.getFullYear(), today.getMonth(), 1)
      ),
      endDate: toInputDateString(
        new Date(today.getFullYear(), today.getMonth() + 1, 0)
      ),
    };
  }
};

const getYearDateRange = (date) => {
  try {
    const validDate = new Date(date);
    if (isNaN(validDate.getTime()))
      throw new Error("Data inválida para getYearDateRange");
    const startOfYear = new Date(validDate.getFullYear(), 0, 1);
    const endOfYear = new Date(validDate.getFullYear(), 11, 31);
    return {
      startDate: toInputDateString(startOfYear),
      endDate: toInputDateString(endOfYear),
    };
  } catch (error) {
    console.error(error);
    const today = new Date();
    return {
      // Retorna o ano atual como fallback seguro
      startDate: toInputDateString(new Date(today.getFullYear(), 0, 1)),
      endDate: toInputDateString(new Date(today.getFullYear(), 11, 31)),
    };
  }
};

const INITIAL_SUMMARY = {
  totalRevenue: 0,
  totalExpenses: 0,
  netProfit: 0,
  totalFixedExpenses: 0,
  totalVariableExpenses: 0,
};

// Meses para usar nos labels do gráfico
const MONTH_LABELS = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function FinancialDashboard() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthRange = getMonthDateRange(today);

  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(false);

  // --- ESTADOS PARA O GRÁFICO ---
  const [selectedYear, setSelectedYear] = useState(String(currentYear)); // Ano atual como string
  const [monthlyData, setMonthlyData] = useState([]); // Dados mensais do backend
  const [loadingChart, setLoadingChart] = useState(false);
  // --- FIM ESTADOS GRÁFICO ---

  // --- NOVO ESTADO PARA EXPORTAÇÃO ---
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState({ type: "", text: "" }); // Para feedback
  // --- FIM NOVO ESTADO ---

  // Efeito para buscar o resumo do período selecionado
  useEffect(() => {
    const fetchSummary = async () => {
      if (
        startDate &&
        endDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
        /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        setLoadingSummary(true); // Usa o loading específico
        try {
          const result = await window.api.getFinancialSummary({
            startDate,
            endDate,
          });
          if (result.success && result.summary) {
            const cleanSummary = Object.keys(INITIAL_SUMMARY).reduce(
              (acc, key) => {
                acc[key] = Number(result.summary[key]) || 0;
                return acc;
              },
              {}
            );
            setSummary(cleanSummary);
          } else {
            console.error(
              "Erro ao buscar resumo:",
              result?.error || "Resultado inesperado"
            );
            setSummary(INITIAL_SUMMARY);
          }
        } catch (apiError) {
          console.error("Erro API (Summary):", apiError);
          setSummary(INITIAL_SUMMARY);
        } finally {
          setLoadingSummary(false);
        } // Usa o loading específico
      } else {
        setSummary(INITIAL_SUMMARY);
      }
    };
    fetchSummary();
  }, [startDate, endDate]);

  // --- EFEITO PARA BUSCAR DADOS MENSAIS PARA O GRÁFICO ---
  useEffect(() => {
    const fetchMonthlyData = async () => {
      const yearNum = parseInt(selectedYear, 10);
      if (!isNaN(yearNum) && selectedYear.length === 4) {
        // Validação simples do ano
        setLoadingChart(true);
        try {
          const result = await window.api.getMonthlySummary({
            year: selectedYear,
          });
          if (result.success) {
            setMonthlyData(result.monthlyData);
          } else {
            console.error("Erro ao buscar dados mensais:", result.error);
            setMonthlyData([]); // Limpa em caso de erro
          }
        } catch (apiError) {
          console.error("Erro API (Monthly):", apiError);
          setMonthlyData([]);
        } finally {
          setLoadingChart(false);
        }
      } else {
        setMonthlyData([]); // Limpa se o ano for inválido
      }
    };
    fetchMonthlyData();
  }, [selectedYear]); // Re-executa quando o ano mudar
  // --- FIM EFEITO GRÁFICO ---

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
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  // --- NOVA FUNÇÃO PARA EXPORTAR ---
  const handleExportExcel = async () => {
    if (!startDate || !endDate) {
      setExportMessage({
        type: "error",
        text: "Por favor, selecione um período válido.",
      });
      return;
    }
    setExporting(true);
    setExportMessage({ type: "", text: "" }); // Limpa mensagens antigas
    try {
      const result = await window.api.exportFinancialReport({
        startDate,
        endDate,
      });
      if (result.success) {
        setExportMessage({
          type: "success",
          text: `Relatório salvo em: ${result.path}`,
        });
      } else {
        setExportMessage({
          type: "error",
          text: `Erro ao exportar: ${result.error}`,
        });
      }
    } catch (error) {
      setExportMessage({
        type: "error",
        text: `Erro inesperado: ${error.message}`,
      });
    } finally {
      setExporting(false);
    }
  };
  // --- FIM NOVA FUNÇÃO ---

  // --- CONFIGURAÇÃO DO GRÁFICO ---
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false, // Permite controlar altura
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: `Resumo Mensal - ${selectedYear}` },
      tooltip: {
        callbacks: {
          // Formata o tooltip para mostrar moeda
          label: function (context) {
            let label = context.dataset.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed.y !== null) {
              label += formatCurrency(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: {
      // Formata o eixo Y para mostrar moeda
      y: { ticks: { callback: (value) => formatCurrency(value) } },
    },
  };

  const chartData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: "Receita Total",
        data: monthlyData.map((d) => d.totalRevenue),
        backgroundColor: "rgba(75, 192, 192, 0.6)", // Verde/Azul claro
        borderColor: "rgb(75, 192, 192)",
        borderWidth: 1,
      },
      {
        label: "Despesa Total",
        data: monthlyData.map((d) => d.totalExpenses),
        backgroundColor: "rgba(255, 99, 132, 0.6)", // Vermelho claro
        borderColor: "rgb(255, 99, 132)",
        borderWidth: 1,
      },
    ],
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Resumo Financeiro
      </Typography>

      {/* Seleção de Período */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Selecionar Período (Resumo)
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
          mb={2}
        >
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
        <Stack
          direction="row"
          spacing={1}
          justifyContent="flex-start"
          flexWrap="wrap"
        >
          <Button size="small" variant="outlined" onClick={setPeriodThisMonth}>
            Este Mês
          </Button>
          <Button size="small" variant="outlined" onClick={setPeriodLastMonth}>
            Mês Passado
          </Button>
          <Button size="small" variant="outlined" onClick={setPeriodThisYear}>
            Este Ano
          </Button>

          {/* --- NOVO BOTÃO DE EXPORTAÇÃO --- */}
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={handleExportExcel}
            disabled={exporting || !startDate || !endDate} // Desabilita durante exportação ou sem data
            sx={{ ml: "auto" }} // Joga para a direita
          >
            {exporting ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Exportar Excel"
            )}
          </Button>
          {/* --- FIM NOVO BOTÃO --- */}
        </Stack>
        {/* --- FEEDBACK DA EXPORTAÇÃO --- */}
        {exportMessage.text && (
          <Alert severity={exportMessage.type || "info"} sx={{ mt: 2 }}>
            {exportMessage.text}
          </Alert>
        )}
      </Paper>

      {/* Exibição do Resumo em Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {" "}
        {/* Adiciona margem inferior */}
        {/* Receita */}
        <Grid item xs={12} sm={6} md={4}>
          {" "}
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#e3f2fd" }}>
            {" "}
            <Typography variant="subtitle1" color="textSecondary">
              Receita Total
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h5" color="primary">
                {formatCurrency(summary.totalRevenue)}
              </Typography>
            )}{" "}
          </Paper>{" "}
        </Grid>
        {/* Desp Fixas */}
        <Grid item xs={6} sm={3} md={2}>
          {" "}
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#fff3e0" }}>
            {" "}
            <Typography variant="caption" color="textSecondary">
              Despesas Fixas
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h6" color="warning.dark">
                {formatCurrency(summary.totalFixedExpenses)}
              </Typography>
            )}{" "}
          </Paper>{" "}
        </Grid>
        {/* Desp Variáveis */}
        <Grid item xs={6} sm={3} md={2}>
          {" "}
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#ffcdd2" }}>
            {" "}
            <Typography variant="caption" color="textSecondary">
              Despesas Variáveis
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h6" color="error.dark">
                {formatCurrency(summary.totalVariableExpenses)}
              </Typography>
            )}{" "}
          </Paper>{" "}
        </Grid>
        {/* Desp Total */}
        <Grid item xs={12} sm={6} md={4}>
          {" "}
          <Paper sx={{ p: 2, textAlign: "center", backgroundColor: "#ffebee" }}>
            {" "}
            <Typography variant="subtitle1" color="textSecondary">
              Despesa Total
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={24} />
            ) : (
              <Typography variant="h5" color="error">
                {formatCurrency(summary.totalExpenses)}
              </Typography>
            )}{" "}
          </Paper>{" "}
        </Grid>
        {/* Lucro Líquido */}
        <Grid item xs={12}>
          {" "}
          <Paper
            sx={{
              p: 2,
              mt: 1,
              textAlign: "center",
              backgroundColor: summary.netProfit >= 0 ? "#e8f5e9" : "#ffebee",
            }}
          >
            {" "}
            <Typography variant="subtitle1" color="textSecondary">
              Lucro Líquido
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={24} />
            ) : (
              <Typography
                variant="h4"
                color={summary.netProfit >= 0 ? "success.main" : "error.main"}
              >
                {formatCurrency(summary.netProfit)}
              </Typography>
            )}{" "}
          </Paper>{" "}
        </Grid>
      </Grid>

      {/* --- SEÇÃO DO GRÁFICO MENSAL --- */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          <Typography variant="h6">Comparativo Mensal</Typography>
          <TextField
            label="Ano"
            type="number"
            size="small"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            inputProps={{ min: 2000, max: 2100 }} // Define limites razoáveis
            sx={{ width: 120 }}
          />
        </Stack>
        <Box sx={{ height: 350, position: "relative" }}>
          {" "}
          {/* Define altura e permite overlay */}
          {loadingChart && (
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
          {!loadingChart && monthlyData.length > 0 && (
            <Bar options={chartOptions} data={chartData} />
          )}
          {!loadingChart && monthlyData.length === 0 && (
            <Typography sx={{ textAlign: "center", mt: 4 }}>
              Nenhum dado encontrado para o ano {selectedYear}.
            </Typography>
          )}
        </Box>
      </Paper>
      {/* --- FIM SEÇÃO GRÁFICO --- */}
    </>
  );
}

export default FinancialDashboard;
