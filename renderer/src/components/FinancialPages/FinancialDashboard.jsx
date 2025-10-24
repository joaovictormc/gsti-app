import { useState, useEffect, useCallback } from "react";
import {
  Typography,
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
import PeriodSelector from "./PeriodSelector";
import SummaryCards from "./SummaryCards";
import InvestmentGoal from "./InvestmentGoal";
import MonthlyChart from "./MonthlyChart";
import AnnualChart from "./AnnualChart";

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

function FinancialDashboard() {
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthRange = getMonthDateRange(today);

  // Estados (mantidos aqui)
  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);
  const [summary, setSummary] = useState(INITIAL_SUMMARY);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [monthlyData, setMonthlyData] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [annualData, setAnnualData] = useState([]); // Dados anuais
  const [loadingAnnualChart, setLoadingAnnualChart] = useState(false); // Loading anual
  const [exporting, setExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState({ type: "", text: "" });
  const [averageProfit, setAverageProfit] = useState(0);
  const [loadingAverageProfit, setLoadingAverageProfit] = useState(false);
  const averageProfitMonths = 6;
  const [investmentGoal, setInvestmentGoal] = useState("");
  const [timeToGoal, setTimeToGoal] = useState(null);

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
        setLoadingChart(true);
        try {
          const result = await window.api.getMonthlySummary({
            year: selectedYear,
          });
          if (result.success) setMonthlyData(result.monthlyData);
          else {
            console.error("Erro dados mensais:", result.error);
            setMonthlyData([]);
          }
        } catch (apiError) {
          console.error("Erro API (Monthly):", apiError);
          setMonthlyData([]);
        } finally {
          setLoadingChart(false);
        }
      } else {
        setMonthlyData([]);
      }
    };
    fetchMonthlyData();
  }, [selectedYear]);

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

  // --- Funções Auxiliares e Handlers (Mantidos no componente pai) ---
  // Usamos useCallback para otimizar e evitar re-renderizações desnecessárias do PeriodSelector
  const handleStartDateChange = useCallback(
    (newDate) => setStartDate(newDate),
    []
  );
  const handleEndDateChange = useCallback((newDate) => setEndDate(newDate), []);

  // Funções para definir períodos pré-definidos
  const setPeriodThisMonth = useCallback(() => {
    const range = getMonthDateRange(new Date());
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, []);

  const setPeriodLastMonth = useCallback(() => {
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const range = getMonthDateRange(lastMonth);
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, []);

  const setPeriodThisYear = useCallback(() => {
    const range = getYearDateRange(new Date());
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }, []);

  // Função para formatar moeda
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value || 0);
  };

  // --- NOVA FUNÇÃO PARA EXPORTAR ---
  const handleExportExcel = useCallback(async () => {
    if (!startDate || !endDate) {
      setExportMessage({
        type: "error",
        text: "Por favor, selecione um período válido.",
      });
      return;
    }
    setExporting(true);
    setExportMessage({ type: "", text: "" });
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
  }, [startDate, endDate]);
  // --- FIM NOVA FUNÇÃO ---

  const handleClearExportMessage = useCallback(() => {
    setExportMessage({ type: "", text: "" });
  }, []);

  const handleYearChange = useCallback(
    (newYear) => setSelectedYear(newYear),
    []
  );

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Resumo Financeiro
      </Typography>

      {/* --- RENDERIZA O NOVO COMPONENTE --- */}
      <PeriodSelector
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={handleStartDateChange}
        onEndDateChange={handleEndDateChange}
        onSetPeriodThisMonth={setPeriodThisMonth}
        onSetPeriodLastMonth={setPeriodLastMonth}
        onSetPeriodThisYear={setPeriodThisYear}
        onExportExcel={handleExportExcel}
        isExporting={exporting}
        exportMessage={exportMessage}
        onClearExportMessage={handleClearExportMessage} // Passa a função para limpar
      />
      {/* --- FIM DA RENDERIZAÇÃO --- */}

      {/* --- RENDERIZA O NOVO COMPONENTE DE CARDS --- */}
      <SummaryCards
        summary={summary}
        loadingSummary={loadingSummary}
        averageProfit={averageProfit}
        loadingAverageProfit={loadingAverageProfit}
        averageProfitMonths={averageProfitMonths}
      />
      {/* --- FIM DA RENDERIZAÇÃO DOS CARDS --- */}

      {/* --- RENDERIZA O NOVO COMPONENTE DE META --- */}
      <InvestmentGoal
        investmentGoal={investmentGoal}
        // Passa a função set do estado diretamente
        onInvestmentGoalChange={setInvestmentGoal}
        timeToGoal={timeToGoal}
        averageProfit={averageProfit}
      />
      {/* --- FIM DA RENDERIZAÇÃO DA META --- */}

      {/* --- RENDERIZA O NOVO COMPONENTE DE GRÁFICO MENSAL --- */}
      <MonthlyChart
        selectedYear={selectedYear}
        onYearChange={handleYearChange} // Passa a função para mudar o ano
        monthlyData={monthlyData}
        loadingChart={loadingChart}
      />
      {/* --- FIM DA RENDERIZAÇÃO DO GRÁFICO MENSAL --- */}

      {/* --- RENDERIZA O NOVO COMPONENTE DE GRÁFICO ANUAL --- */}
      <AnnualChart
        annualData={annualData}
        loadingAnnualChart={loadingAnnualChart}
      />
      {/* --- FIM DA RENDERIZAÇÃO DO GRÁFICO ANUAL --- */}
    </>
  );
}

export default FinancialDashboard;
