import { useState, useEffect } from "react";
import {
  Box, Typography, FormControl, InputLabel, Select, MenuItem, Paper, CircularProgress
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

// Define os status possíveis (idealmente, deveriam vir do backend ou de uma constante compartilhada)
const OS_STATUS_OPTIONS = ['Orçamento', 'Aguardando Autorização', 'Em Aberto', 'Aguardando Peça', 'Em Andamento', 'Finalizado', 'Entregue', 'Cancelado'];

function OSReportStatus() {
  const [selectedStatus, setSelectedStatus] = useState(''); // Status selecionado no Select
  const [osData, setOsData] = useState([]); // Dados das OS do status selecionado
  const [loadingOS, setLoadingOS] = useState(false);

  // Busca as OSs do status selecionado
  useEffect(() => {
    const fetchOS = async () => {
      if (selectedStatus) { // Só busca se um status for selecionado
        setLoadingOS(true);
        setOsData([]); // Limpa dados antigos
        const result = await window.api.getOSByStatus(selectedStatus);
        if (result.success) {
          setOsData(result.data);
        } else {
          console.error("Erro ao buscar OS por status:", result.error);
          alert(`Erro ao buscar OS: ${result.error}`);
          setOsData([]);
        }
        setLoadingOS(false);
      } else {
        setOsData([]); // Limpa a tabela se nenhum status estiver selecionado
      }
    };
    fetchOS();
  }, [selectedStatus]); // Roda sempre que o status selecionado mudar

  const handleStatusChange = (event) => {
    setSelectedStatus(event.target.value);
  };

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 200 },
    { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 250 },
    {
      field: "data_entrada",
      headerName: "Data Entrada",
      width: 180,
      renderCell: (params) => {
        if (!params.value) return "";
        return new Date(params.value).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      },
    },
     {
      field: "data_saida",
      headerName: "Data Saída",
      width: 180,
      renderCell: (params) => {
        if (!params.value) return "-";
        return new Date(params.value).toLocaleString("pt-BR", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      field: "valor_total",
      headerName: "Valor Total",
      width: 150,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const value = Number(params.value);
        if (params.value == null || isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
      },
    },
    // Removido o campo 'status' da tabela, pois já filtramos por ele
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Relatório de OS por Status
      </Typography>

      {/* Seletor de Status */}
      <Paper sx={{ p: 2, mb: 3, maxWidth: 300 }}> {/* Limita a largura */}
        <FormControl fullWidth>
          <InputLabel>Selecionar Status</InputLabel>
          <Select
            value={selectedStatus}
            label="Selecionar Status"
            onChange={handleStatusChange}
          >
            {/* Adiciona uma opção "Todos" ou "Selecione..." se desejar */}
            <MenuItem value=""><em>Selecione um status</em></MenuItem>
            {OS_STATUS_OPTIONS.map((statusOption) => (
              <MenuItem key={statusOption} value={statusOption}>
                {statusOption}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Paper>

      {/* Tabela de Resultados */}
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={osData}
          columns={columns}
          loading={loadingOS}
          getRowId={(row) => row.id}
          localeText={{ noRowsLabel: selectedStatus ? `Nenhuma OS encontrada com o status "${selectedStatus}".` : "Selecione um status para ver as OS." }}
        />
      </Box>
    </>
  );
}

export default OSReportStatus;