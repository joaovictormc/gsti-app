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
  Tooltip as MuiTooltip,
  InputAdornment,
} from "@mui/material";
import { Bar, Line } from "react-chartjs-2";
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
    if (isNaN(d.getTime())) {
      console.error("Data inválida:", date);
      return "";
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Erro formatar data:", date, error);
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
  totalOSRevenue: 0,
  totalMiscRevenue: 0,
};
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

  // Estados
  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [monthlyData, setMonthlyData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [annualData, setAnnualData] = useState([]);
  const [loadingAnnualChart, setLoadingAnnualChart] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState({ type: "", text: "" });

  // --- NOVO ESTADO PARA LUCRO MÉDIO ---
  const [averageProfit, setAverageProfit] = useState(0);
  const [loadingAverageProfit, setLoadingAverageProfit] = useState(false);
  const averageProfitMonths = 6; // Define quantos meses usar para a média

  // --- NOVO ESTADO PARA META DE INVESTIMENTO ---
  const [investmentGoal, setInvestmentGoal] = useState(""); // Armazena o valor digitado
  const [timeToGoal, setTimeToGoal] = useState(null); // Armazena o resultado do cálculo
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

  // --- EFEITO PARA BUSCAR DADOS ANUAIS (Roda 1x) ---
  useEffect(() => {
    const fetchAnnualData = async () => {
      setLoadingAnnualChart(true);
      try {
        const result = await window.api.getAnnualSummary();
        if (result.success) {
          setAnnualData(result.annualData);
        } else {
          console.error("Erro ao buscar dados anuais:", result.error);
          setAnnualData([]);
        }
      } catch (apiError) {
        console.error("Erro API (Annual):", apiError);
        setAnnualData([]);
      } finally {
        setLoadingAnnualChart(false);
      }
    };
    fetchAnnualData();
  }, []); // Array vazio = roda apenas na montagem inicial
  // --- FIM EFEITO GRÁFICO ANUAL ---

  // --- EFEITO PARA BUSCAR LUCRO MÉDIO (Roda 1x) ---
  useEffect(() => {
    const fetchAverageProfit = async () => {
      setLoadingAverageProfit(true);
      try {
        const result = await window.api.getAverageProfit({
          months: averageProfitMonths,
        });
        if (result.success) {
          setAverageProfit(Number(result.averageProfit) || 0);
        } else {
          console.error("Erro ao buscar lucro médio:", result.error);
          setAverageProfit(0);
        }
      } catch (apiError) {
        console.error("Erro API (Average Profit):", apiError);
        setAverageProfit(0);
      } finally {
        setLoadingAverageProfit(false);
      }
    };
    fetchAverageProfit();
  }, [averageProfitMonths]); // Depende do número de meses (se quiséssemos torná-lo dinâmico)
  // --- FIM EFEITO LUCRO MÉDIO ---

  // --- EFEITO PARA CALCULAR TEMPO PARA META ---
  useEffect(() => {
    const goal = parseFloat(investmentGoal);
    if (averageProfit > 0 && goal > 0) {
      const months = Math.ceil(goal / averageProfit); // Arredonda para cima
      setTimeToGoal(months);
    } else {
      setTimeToGoal(null); // Limpa se o lucro for 0/negativo ou a meta for inválida
    }
  }, [averageProfit, investmentGoal]); // Recalcula quando a média ou a meta mudam
  // --- FIM EFEITO META ---

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

  // Função para formatar meses em anos/meses
  const formatMonthsToYears = (totalMonths) => {
    if (!totalMonths || totalMonths <= 0) return "-";
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    let result = "";
    if (years > 0) result += `${years} ano${years > 1 ? "s" : ""}`;
    if (months > 0)
      result += `${years > 0 ? " e " : ""}${months} mes${
        months > 1 ? "es" : ""
      }`;
    return result || `${totalMonths} meses`; // Caso seja menos de 1 ano
  };

  // Configuração Gráfico Mensal
  const monthlyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" },
      title: { display: true, text: `Resumo Mensal - ${selectedYear}` },
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

  const monthlyChartData = {
    labels: MONTH_LABELS,
    datasets: [
      {
        label: "Receita Total",
        data: monthlyData.map((d) => d?.totalRevenue || 0), // Garante 0 se d for undefined
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgb(75, 192, 192)",
        borderWidth: 1,
      },
      {
        label: "Despesa Total",
        data: monthlyData.map((d) => d?.totalExpenses || 0), // Garante 0 se d for undefined
        backgroundColor: "rgba(255, 99, 132, 0.6)",
        borderColor: "rgb(255, 99, 132)",
        borderWidth: 1,
      },
    ],
  };

  // Configuração Gráfico Anual
  const annualChartOptions = {
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

  const annualChartData = {
    labels: annualData.map((d) => d?.year || ""), // Garante string vazia se d for undefined
    datasets: [
      {
        label: "Receita Total Anual",
        data: annualData.map((d) => d?.totalRevenue || 0), // Garante 0
        borderColor: "rgb(75, 192, 192)",
        backgroundColor: "rgba(75, 192, 192, 0.5)",
        tension: 0.1,
      },
      {
        label: "Despesa Total Anual",
        data: annualData.map((d) => d?.totalExpenses || 0), // Garante 0
        borderColor: "rgb(255, 99, 132)",
        backgroundColor: "rgba(255, 99, 132, 0.5)",
        tension: 0.1,
      },
    ],
  };

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Resumo Financeiro
      </Typography>

      {/* Seleção de Período e Exportação */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Selecionar Período
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
          alignItems="center"
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
          {/* Botão Exportar usa o estado 'exporting' */}
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={handleExportExcel}
            disabled={exporting || !startDate || !endDate}
            sx={{ ml: "auto" }}
          >
            {exporting ? (
              <CircularProgress size={18} color="inherit" />
            ) : (
              "Exportar Excel"
            )}
          </Button>
        </Stack>
        {/* Feedback da Exportação */}
        {exportMessage.text && (
          <Alert
            severity={exportMessage.type || "info"}
            sx={{ mt: 2 }}
            onClose={() => setExportMessage({ type: "", text: "" })}
          >
            {exportMessage.text}
          </Alert>
        )}
      </Paper>

      {/* --- LAYOUT AJUSTADO PARA INCLUIR NOVO CARD --- */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {/* Receita Total */}
        <Grid item xs={12} sm={6} md={3}>
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
          </Paper>
        </Grid>

        {/* Card Lucro Médio com MuiTooltip */}
        <Grid item xs={12} sm={6} md={3}>
          {/* --- CORREÇÃO: Usa MuiTooltip corretamente --- */}
          <MuiTooltip
            title={`Média dos últimos ${averageProfitMonths} meses com movimentação.`}
          >
            <Paper
              sx={{ p: 2, textAlign: "center", backgroundColor: "#f3e5f5" }}
            >
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
        {/* --- FIM CORREÇÃO --- */}

        {/* Lucro Líquido */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            sx={{
              p: 2,
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
                variant="h5"
                color={summary.netProfit >= 0 ? "success.main" : "error.main"}
              >
                {formatCurrency(summary.netProfit)}
              </Typography>
            )}{" "}
          </Paper>
        </Grid>

        {/* Desp Fixas */}
        <Grid item xs={6} md={3}>
          {" "}
          {/* Ajustado para ocupar menos espaço */}
          <Paper
            sx={{ p: 1.5, textAlign: "center", backgroundColor: "#fff3e0" }}
          >
            {" "}
            <Typography variant="caption" color="textSecondary">
              Despesas Fixas (Período)
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={20} />
            ) : (
              <Typography variant="h6" color="warning.dark">
                {formatCurrency(summary.totalFixedExpenses)}
              </Typography>
            )}{" "}
          </Paper>
        </Grid>

        {/* Desp Variáveis */}
        <Grid item xs={6} md={9}>
          {" "}
          {/* Ajustado para ocupar menos espaço */}
          <Paper
            sx={{ p: 1.5, textAlign: "center", backgroundColor: "#ffcdd2" }}
          >
            {" "}
            <Typography variant="caption" color="textSecondary">
              Despesas Variáveis (Período)
            </Typography>{" "}
            {loadingSummary ? (
              <CircularProgress size={20} />
            ) : (
              <Typography variant="h6" color="error.dark">
                {formatCurrency(summary.totalVariableExpenses)}
              </Typography>
            )}{" "}
          </Paper>
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

      {/* --- NOVA SEÇÃO: Meta de Investimento --- */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Meta de Investimento
        </Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={2}
          alignItems="center"
        >
          <TextField
            label="Valor da Meta"
            type="number"
            value={investmentGoal}
            onChange={(e) => setInvestmentGoal(e.target.value)}
            InputProps={{
              // --- CORREÇÃO: InputAdornment agora está definido ---
              startAdornment: (
                <InputAdornment position="start">R$</InputAdornment>
              ),
              inputProps: { min: 0, step: "0.01" },
            }}
            sx={{ minWidth: 200 }}
          />
          <Box
            sx={{
              flexGrow: 1,
              textAlign: { xs: "center", sm: "left" },
              mt: { xs: 2, sm: 0 },
            }}
          >
            <Typography variant="body1">
              Tempo estimado para atingir a meta (com base no lucro médio):
            </Typography>
            <Typography
              variant="h6"
              color={timeToGoal ? "primary" : "textSecondary"}
            >
              {timeToGoal
                ? formatMonthsToYears(timeToGoal)
                : averageProfit <= 0
                ? "Lucro médio zero ou negativo"
                : "Insira uma meta válida"}
            </Typography>
          </Box>
        </Stack>
      </Paper>
      {/* --- FIM NOVA SEÇÃO --- */}

      {/* --- SEÇÃO DO GRÁFICO MENSAL --- */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center" mb={2}>
          {" "}
          <Typography variant="h6">Comparativo Mensal</Typography>{" "}
          <TextField
            label="Ano"
            type="number"
            size="small"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            inputProps={{ min: 2000, max: 2100 }}
            sx={{ width: 120 }}
          />{" "}
        </Stack>
        <Box sx={{ height: 350, position: "relative" }}>
          {" "}
          {loadingChart && (
            <Box
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }}
            >
              {" "}
              <CircularProgress />{" "}
            </Box>
          )}{" "}
          {!loadingChart && monthlyData.length > 0 && (
            <Bar options={monthlyChartOptions} data={monthlyChartData} />
          )}{" "}
          {!loadingChart && monthlyData.length === 0 && (
            <Typography sx={{ textAlign: "center", mt: 4 }}>
              Nenhum dado encontrado para {selectedYear}.
            </Typography>
          )}{" "}
        </Box>
      </Paper>

      {/* --- SEÇÃO DO GRÁFICO ANUAL --- */}
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
              {" "}
              <CircularProgress />{" "}
            </Box>
          )}
          {!loadingAnnualChart && annualData.length > 0 && (
            <Line options={annualChartOptions} data={annualChartData} />
          )}
          {!loadingAnnualChart && annualData.length === 0 && (
            <Typography sx={{ textAlign: "center", mt: 4 }}>
              Nenhum dado anual encontrado.
            </Typography>
          )}
        </Box>
      </Paper>
      {/* --- FIM SEÇÃO GRÁFICO --- */}
    </>
  );
}

export default FinancialDashboard;
