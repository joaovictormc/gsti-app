import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Stack,
  Button,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

// --- FUNÇÕES DE DATA (DEFINIDAS CORRETAMENTE) ---
const toInputDateString = (date) => {
  try {
    if (!date) return "";
    const d = new Date(date);
    if (isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error("Erro ao formatar data para input:", date, error);
    return "";
  }
};

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
      // Fallback seguro
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
      // Fallback seguro
      startDate: toInputDateString(new Date(today.getFullYear(), 0, 1)),
      endDate: toInputDateString(new Date(today.getFullYear(), 11, 31)),
    };
  }
};
// --- FIM FUNÇÕES DE DATA ---

function DetailedRevenueReport() {
  const today = new Date();
  // Agora estas chamadas funcionarão
  const currentMonthRange = getMonthDateRange(today);
  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);

  const [reportData, setReportData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (
        startDate &&
        endDate &&
        /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
        /^\d{4}-\d{2}-\d{2}$/.test(endDate)
      ) {
        setLoading(true);
        setReportData([]);
        console.log("[DetailedRevenueReport] Fetching data for:", {
          startDate,
          endDate,
        });
        try {
          const result = await window.api.getDetailedRevenueReport({
            startDate,
            endDate,
          });
          console.log("[DetailedRevenueReport] API Result:", result);
          if (result.success && Array.isArray(result.data)) {
            console.log(
              "[DetailedRevenueReport] Setting reportData state with:",
              result.data
            ); // Log antes de setar
            setReportData(result.data);
          } else {
            console.error(
              "[DetailedRevenueReport] Erro API ou dados inválidos:",
              result?.error || "Formato inesperado"
            );
            setReportData([]);
          }
        } catch (apiError) {
          console.error(
            "[DetailedRevenueReport] Erro na chamada API:",
            apiError
          );
          setReportData([]);
        } finally {
          setLoading(false);
        }
      } else {
        console.warn("[DetailedRevenueReport] Datas inválidas para busca:", {
          startDate,
          endDate,
        });
        setReportData([]);
      }
    };
    fetchData();
  }, [startDate, endDate]);

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

  const columns = [
    {
      field: "data",
      headerName: "Data",
      width: 180,
      renderCell: (params) => {
        // --- CORREÇÃO: Usa params.row.data ---
        const rawValue = params.row?.data; // Usa optional chaining por segurança extra
        if (!rawValue) return "";
        try {
          const date = new Date(rawValue);
          if (isNaN(date.getTime())) return "Data Inválida";
          return date.toLocaleString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        } catch (error) {
          console.error("Error formatting date:", rawValue, error);
          return "Erro Data";
        }
      },
      // --- CORREÇÃO: Adiciona verificação em valueGetter ---
      valueGetter: (params) => {
        // Se params.row não existir, retorna null
        if (!params.row) {
          return null;
        }
        // Se existir, tenta criar a data
        return params.row.data ? new Date(params.row.data) : null;
      },
      type: "dateTime",
    },
    { field: "tipo", headerName: "Tipo", width: 150 },
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 300 },
    {
      field: "valor",
      headerName: "Valor (R$)",
      width: 150,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => {
        const value = Number(params.value);
        if (isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(Math.abs(value));
      },
      type: "number",
    },
  ];

  const totalRevenueDisplayed = reportData.reduce(
    (sum, item) => sum + (Number(item.valor) || 0),
    0
  );

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Relatório Detalhado de Receitas
      </Typography>

      {/* Seletores de Período */}
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
        </Stack>
      </Paper>

      {/* Tabela de Resultados */}
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={reportData}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          localeText={{
            noRowsLabel: "Nenhuma receita encontrada para este período.",
          }}
          slots={{
            footer: () => (
              <Box
                sx={{
                  p: 1,
                  display: "flex",
                  justifyContent: "flex-end",
                  fontWeight: "bold",
                }}
              >
                Total Receitas no Período:{" "}
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(totalRevenueDisplayed)}
              </Box>
            ),
          }}
        />
      </Box>
    </>
  );
}

export default DetailedRevenueReport;
