import { useState, useEffect, useCallback } from "react";
import {
  Typography, Box, Paper, Chip, CircularProgress, Grid,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableFooter,
  LinearProgress, Stack,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Bar, Line, Doughnut } from "react-chartjs-2";
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
  ArcElement,
} from "chart.js";
import PeriodSelector from "./PeriodSelector";
import SummaryCards from "./SummaryCards";
import InvestmentGoal from "./InvestmentGoal";
import MonthlyChart from "./MonthlyChart";
import AnnualChart from "./AnnualChart";

ChartJS.register(
  CategoryScale, LinearScale, BarElement,
  Title, Tooltip, Legend,
  PointElement, LineElement,
  ArcElement
);

const DONUT_COLORS = [
  "#6366f1", "#06b6d4", "#10b981", "#f59e0b",
  "#ef4444", "#8b5cf6", "#f97316", "#84cc16",
  "#ec4899", "#64748b",
];

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
  const [expensesByCategory, setExpensesByCategory] = useState([]);
  const [loadingExpCat, setLoadingExpCat] = useState(false);
  const [cashflowData, setCashflowData] = useState([]);
  const [loadingCashflow, setLoadingCashflow] = useState(false);
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

  // Despesas por categoria
  useEffect(() => {
    if (!startDate || !endDate) return;
    (async () => {
      setLoadingExpCat(true);
      try {
        const result = await window.api.getExpensesByCategory({ startDate, endDate });
        setExpensesByCategory(result.success ? result.data : []);
      } catch (_) { setExpensesByCategory([]); }
      finally { setLoadingExpCat(false); }
    })();
  }, [startDate, endDate]);

  // Fluxo de caixa detalhado
  useEffect(() => {
    if (!startDate || !endDate) return;
    (async () => {
      setLoadingCashflow(true);
      try {
        const result = await window.api.getDetailedCashflow({ startDate, endDate });
        if (result.success) setCashflowData(result.data);
        else setCashflowData([]);
      } catch (_) { setCashflowData([]); }
      finally { setLoadingCashflow(false); }
    })();
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

      {/* --- GRÁFICOS PIZZA --- */}
      <Grid container spacing={3} sx={{ mt: 1, mb: 1 }}>
        {/* Receitas por Fonte */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Receitas por Fonte
            </Typography>
            {loadingSummary ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress />
              </Box>
            ) : summary.totalOSRevenue + summary.totalMiscRevenue > 0 ? (
              <Box sx={{ maxHeight: 260, display: "flex", justifyContent: "center" }}>
                <Doughnut
                  data={{
                    labels: ["Receita de OS", "Receitas Avulsas"],
                    datasets: [{
                      data: [summary.totalOSRevenue, summary.totalMiscRevenue],
                      backgroundColor: ["#6366f1", "#06b6d4"],
                      borderColor: ["#fff", "#fff"],
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: { position: "right" },
                      tooltip: {
                        callbacks: {
                          label: (ctx) =>
                            ` ${formatCurrency(ctx.raw)}  (${
                              ((ctx.raw / (summary.totalOSRevenue + summary.totalMiscRevenue)) * 100).toFixed(1)
                            }%)`,
                        },
                      },
                    },
                  }}
                />
              </Box>
            ) : (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <Typography color="text.secondary" variant="body2">
                  Sem receitas no período selecionado.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Despesas por Categoria */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Despesas por Categoria
            </Typography>
            {loadingExpCat ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress />
              </Box>
            ) : expensesByCategory.length > 0 ? (
              <Box sx={{ maxHeight: 260, display: "flex", justifyContent: "center" }}>
                <Doughnut
                  data={{
                    labels: expensesByCategory.map((e) => e.categoria),
                    datasets: [{
                      data: expensesByCategory.map((e) => e.total),
                      backgroundColor: DONUT_COLORS.slice(0, expensesByCategory.length),
                      borderColor: "#fff",
                      borderWidth: 2,
                    }],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: { position: "right" },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => {
                            const total = expensesByCategory.reduce((s, e) => s + e.total, 0);
                            return ` ${formatCurrency(ctx.raw)}  (${
                              total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0
                            }%)`;
                          },
                        },
                      },
                    },
                  }}
                />
              </Box>
            ) : (
              <Box sx={{ py: 5, textAlign: "center" }}>
                <Typography color="text.secondary" variant="body2">
                  Sem despesas no período selecionado.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
      {/* --- FIM GRÁFICOS PIZZA --- */}

      {/* --- DESPESAS DETALHADAS POR CATEGORIA --- */}
      <Paper sx={{ p: 3, mt: 1, mb: 1 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Despesas Detalhadas por Categoria
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Total por categoria no período, com participação percentual e
          separação por tipo (Fixa/Variável).
        </Typography>

        {loadingExpCat ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : expensesByCategory.length === 0 ? (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography color="text.secondary" variant="body2">
              Sem despesas no período selecionado.
            </Typography>
          </Box>
        ) : (
          (() => {
            const totalDespesas = expensesByCategory.reduce(
              (s, e) => s + (Number(e.total) || 0),
              0
            );
            const totalLancamentos = expensesByCategory.reduce(
              (s, e) => s + (Number(e.quantidade) || 0),
              0
            );
            return (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Categoria</TableCell>
                        <TableCell align="center">Lançamentos</TableCell>
                        <TableCell align="right">Total</TableCell>
                        <TableCell align="right" sx={{ width: 180 }}>
                          % do Total
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {expensesByCategory.map((e, idx) => {
                        const pct =
                          totalDespesas > 0
                            ? (Number(e.total) / totalDespesas) * 100
                            : 0;
                        return (
                          <TableRow key={e.categoria} hover>
                            <TableCell>
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <Box
                                  sx={{
                                    width: 12,
                                    height: 12,
                                    borderRadius: "2px",
                                    bgcolor:
                                      DONUT_COLORS[idx % DONUT_COLORS.length],
                                    flexShrink: 0,
                                  }}
                                />
                                {e.categoria}
                              </Box>
                            </TableCell>
                            <TableCell align="center">{e.quantidade}</TableCell>
                            <TableCell align="right">
                              {formatCurrency(e.total)}
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" alignItems="center" spacing={1} justifyContent="flex-end">
                                <Box sx={{ width: 90 }}>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(pct, 100)}
                                    sx={{ height: 6, borderRadius: 3 }}
                                  />
                                </Box>
                                <Typography variant="body2" sx={{ minWidth: 44 }}>
                                  {pct.toFixed(1)}%
                                </Typography>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, color: "text.primary" }}>
                          TOTAL
                        </TableCell>
                        <TableCell align="center" sx={{ fontWeight: 700, color: "text.primary" }}>
                          {totalLancamentos}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: "error.main" }}>
                          {formatCurrency(totalDespesas)}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700, color: "text.primary" }}>
                          100%
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>

                {/* Split Fixa / Variável */}
                <Box sx={{ display: "flex", gap: 3, mt: 2, flexWrap: "wrap" }}>
                  <Chip
                    label={`Fixas: ${formatCurrency(summary.totalFixedExpenses)}`}
                    color="warning"
                    variant="outlined"
                    size="small"
                  />
                  <Chip
                    label={`Variáveis: ${formatCurrency(summary.totalVariableExpenses)}`}
                    color="info"
                    variant="outlined"
                    size="small"
                  />
                </Box>
              </>
            );
          })()
        )}
      </Paper>
      {/* --- FIM DESPESAS DETALHADAS --- */}

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

      {/* --- FLUXO DE CAIXA DETALHADO --- */}
      <Paper sx={{ p: 3, mt: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Fluxo de Caixa — Transações do Período
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Todas as entradas e saídas no período selecionado, em ordem cronológica.
        </Typography>

        {loadingCashflow ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <Box sx={{ height: 420, width: "100%" }}>
              <DataGrid
                rows={cashflowData}
                getRowId={(r) => r.id}
                columns={[
                  {
                    field: "data",
                    headerName: "Data",
                    width: 120,
                    renderCell: (p) =>
                      p.value
                        ? new Date(p.value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
                        : "—",
                  },
                  {
                    field: "tipo",
                    headerName: "Tipo",
                    width: 160,
                    renderCell: (p) => {
                      const isExpense = p.value?.startsWith("Despesa");
                      return (
                        <Chip
                          label={p.value}
                          color={isExpense ? "error" : "success"}
                          size="small"
                          variant="outlined"
                        />
                      );
                    },
                  },
                  { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 200 },
                  {
                    field: "valor",
                    headerName: "Valor",
                    width: 140,
                    align: "right",
                    headerAlign: "right",
                    renderCell: (p) => (
                      <Typography
                        variant="body2"
                        fontWeight={600}
                        color={p.value >= 0 ? "success.main" : "error.main"}
                      >
                        {formatCurrency(Math.abs(p.value))}
                      </Typography>
                    ),
                  },
                ]}
                localeText={{ noRowsLabel: "Nenhuma transação no período selecionado." }}
                initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                pageSizeOptions={[10, 25, 50]}
                getRowClassName={(p) =>
                  p.row.valor < 0 ? "row-expense" : "row-income"
                }
                sx={{
                  "& .row-expense": { bgcolor: "error.main", opacity: 0.04 },
                }}
              />
            </Box>
            {/* Totalizadores */}
            {cashflowData.length > 0 && (() => {
              const receitas = cashflowData.filter((r) => r.valor > 0).reduce((s, r) => s + r.valor, 0);
              const despesas = cashflowData.filter((r) => r.valor < 0).reduce((s, r) => s + Math.abs(r.valor), 0);
              const saldo = receitas - despesas;
              return (
                <Box sx={{ display: "flex", gap: 3, mt: 2, flexWrap: "wrap" }}>
                  <Typography variant="body2">
                    <strong>Total Receitas:</strong>{" "}
                    <Typography component="span" color="success.main" fontWeight={600}>
                      {formatCurrency(receitas)}
                    </Typography>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Total Despesas:</strong>{" "}
                    <Typography component="span" color="error.main" fontWeight={600}>
                      {formatCurrency(despesas)}
                    </Typography>
                  </Typography>
                  <Typography variant="body2">
                    <strong>Saldo:</strong>{" "}
                    <Typography component="span" color={saldo >= 0 ? "success.main" : "error.main"} fontWeight={700}>
                      {formatCurrency(saldo)}
                    </Typography>
                  </Typography>
                </Box>
              );
            })()}
          </>
        )}
      </Paper>
      {/* --- FIM FLUXO DE CAIXA --- */}
    </>
  );
}

export default FinancialDashboard;
