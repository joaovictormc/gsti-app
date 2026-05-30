import { useState, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Stack,
  CircularProgress,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
// Importa debounce para evitar buscas a cada tecla digitada (opcional, mas melhora performance)
// Se não tiver debounce instalado: npm install lodash.debounce
// import debounce from 'lodash.debounce';

function EquipmentHistoryReport() {
  const [serialNumber, setSerialNumber] = useState(""); // Termo de busca
  const [osData, setOsData] = useState([]); // Dados das OS encontradas
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false); // Para mostrar mensagem inicial

  // Função para buscar os dados
  const fetchHistory = useCallback(async (searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) {
      setOsData([]);
      setHasSearched(false); // Reseta se a busca for limpa
      return;
    }
    setLoading(true);
    setHasSearched(true); // Marca que uma busca foi feita
    setOsData([]); // Limpa resultados anteriores
    const result = await window.api.searchOSBySerial(searchTerm.trim());
    if (result.success) {
      setOsData(result.data);
    } else {
      console.error("Erro ao buscar histórico por serial:", result.error);
      alert(`Erro ao buscar histórico: ${result.error}`);
      setOsData([]);
    }
    setLoading(false);
  }, []); // useCallback para otimização

  // Função chamada ao clicar no botão buscar
  const handleSearchClick = () => {
    fetchHistory(serialNumber);
  };

  // Função chamada ao limpar a busca
  const handleClearClick = () => {
    setSerialNumber("");
    fetchHistory(""); // Chama fetch com termo vazio para limpar
  };

  // Opcional: Busca debounced enquanto digita (descomente se preferir)
  // const debouncedFetch = useCallback(debounce((term) => fetchHistory(term), 500), [fetchHistory]);
  // const handleInputChange = (event) => {
  //   const term = event.target.value;
  //   setSerialNumber(term);
  //   debouncedFetch(term);
  // };

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 200 },
    { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 250 },
    { field: "numero_serie", headerName: "Nº Série", width: 150 },
    { field: "status", headerName: "Status", width: 150 },
    {
      field: "data_entrada",
      headerName: "Data Entrada",
      width: 180,
      renderCell: (params) => {
        if (!params.value) return "";
        return new Date(params.value).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    {
      field: "data_saida",
      headerName: "Data Saída",
      width: 180,
      renderCell: (params) => {
        if (!params.value) return "-";
        return new Date(params.value).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    {
      field: "valor_total",
      headerName: "Valor Total",
      width: 150,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => {
        const value = Number(params.value);
        if (params.value == null || isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      },
    },
  ];

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Relatório de Histórico por Equipamento (Nº de Série)
      </Typography>

      {/* Campo de Busca */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="Buscar por Número de Série"
            value={serialNumber}
            // onChange={handleInputChange} // Use este se quiser busca ao digitar (com debounce)
            onChange={(e) => setSerialNumber(e.target.value)} // Use este para busca com botão
            fullWidth
            size="small"
            InputProps={{
              endAdornment: serialNumber ? (
                <IconButton
                  size="small"
                  onClick={handleClearClick}
                  title="Limpar busca"
                >
                  <ClearIcon />
                </IconButton>
              ) : null,
            }}
            // Permite buscar pressionando Enter
            onKeyPress={(ev) => {
              if (ev.key === "Enter") {
                handleSearchClick();
                ev.preventDefault();
              }
            }}
          />
          <Button
            variant="contained"
            onClick={handleSearchClick}
            disabled={loading || !serialNumber.trim()}
            startIcon={<SearchIcon />}
          >
            Buscar
          </Button>
        </Stack>
      </Paper>

      {/* Tabela de Resultados */}
      <Box sx={{ height: 500, width: "100%" }}>
        <DataGrid
          rows={osData}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          localeText={{
            noRowsLabel: hasSearched
              ? "Nenhuma OS encontrada para este número de série."
              : "Digite um número de série e clique em Buscar.",
            footerRowSelected: (count) =>
              count !== 1
                ? `${count.toLocaleString()} linhas selecionadas`
                : `1 linha selecionada`,
          }}
        />
      </Box>
    </>
  );
}

export default EquipmentHistoryReport;
