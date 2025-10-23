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

// Função auxiliar para formatar data para YYYY-MM-DD
const toInputDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
};

// Funções auxiliares para obter períodos comuns
const getMonthDateRange = (date) => {
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return {
    startDate: toInputDateString(startOfMonth),
    endDate: toInputDateString(endOfMonth),
  };
};

const getYearDateRange = (date) => {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const endOfYear = new Date(date.getFullYear(), 11, 31);
  return {
    startDate: toInputDateString(startOfYear),
    endDate: toInputDateString(endOfYear),
  };
};

function MostUsedServicesReport() {
  const today = new Date();
  const currentMonthRange = getMonthDateRange(today);

  const [startDate, setStartDate] = useState(currentMonthRange.startDate);
  const [endDate, setEndDate] = useState(currentMonthRange.endDate);
  const [reportData, setReportData] = useState([]); // Dados do relatório
  const [loading, setLoading] = useState(false);

  // Busca os dados do relatório quando as datas mudam
  useEffect(() => {
    const fetchData = async () => {
      if (startDate && endDate) {
        setLoading(true);
        setReportData([]); // Limpa dados antigos
        const result = await window.api.getMostUsedServices({
          startDate,
          endDate,
        });
        if (result.success) {
          // Adiciona um 'id' único a cada linha para a DataGrid, usando o id do produto/serviço
          setReportData(result.data.map((item) => ({ ...item, id: item.id })));
        } else {
          console.error(
            "Erro ao buscar serviços mais utilizados:",
            result.error
          );
          alert(`Erro ao buscar dados: ${result.error}`);
          setReportData([]);
        }
        setLoading(false);
      } else {
        setReportData([]);
      }
    };
    fetchData();
  }, [startDate, endDate]); // Roda sempre que as datas mudarem

  // Funções para definir períodos pré-definidos (opcional, igual ao Dashboard)
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
    // Usamos o ID do produto/serviço como ID da linha
    // { field: "id", headerName: "ID Item", width: 90 }, // Opcional
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 300 },
    { field: "tipo", headerName: "Tipo", width: 150 },
    {
      field: "total_utilizado",
      headerName: "Qtd. Utilizada",
      width: 150,
      align: "right",
      headerAlign: "right",
      // Simplesmente mostra o número
      renderCell: (params) => params.value || 0,
    },
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Relatório de Serviços/Produtos Mais Utilizados
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
        {/* Botões de Período Rápido */}
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
          // getRowId já usa o campo 'id' por padrão, que adicionamos no map
          localeText={{
            noRowsLabel: "Nenhum item utilizado encontrado para este período.",
          }}
        />
      </Box>
    </>
  );
}

export default MostUsedServicesReport;
