import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Autocomplete,
  TextField,
  Paper,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

function OSReportClient() {
  const [customers, setCustomers] = useState([]); // Lista de todos os clientes
  const [selectedCustomer, setSelectedCustomer] = useState(null); // Cliente selecionado no Autocomplete
  const [osData, setOsData] = useState([]); // Dados das OS do cliente selecionado
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingOS, setLoadingOS] = useState(false);

  // Busca a lista de clientes para o Autocomplete
  useEffect(() => {
    const fetchCustomers = async () => {
      setLoadingCustomers(true);
      // Usamos a função getCustomers que já existe
      const customerList = await window.api.getCustomers();
      setCustomers(customerList || []);
      setLoadingCustomers(false);
    };
    fetchCustomers();
  }, []); // Roda apenas uma vez

  // Busca as OSs do cliente selecionado
  useEffect(() => {
    const fetchOS = async () => {
      if (selectedCustomer && selectedCustomer.id) {
        setLoadingOS(true);
        setOsData([]); // Limpa dados antigos
        const result = await window.api.getOSByClient(selectedCustomer.id);
        if (result.success) {
          setOsData(result.data);
        } else {
          console.error("Erro ao buscar OS por cliente:", result.error);
          alert(`Erro ao buscar OS: ${result.error}`);
          setOsData([]);
        }
        setLoadingOS(false);
      } else {
        setOsData([]); // Limpa a tabela se nenhum cliente estiver selecionado
      }
    };
    fetchOS();
  }, [selectedCustomer]); // Roda sempre que o cliente selecionado mudar

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 250 },
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
        if (!params.value) return "-"; // Mostra '-' se não houver data de saída
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
        Relatório de OS por Cliente
      </Typography>

      {/* Seletor de Cliente */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Autocomplete
          options={customers}
          getOptionLabel={(option) => option.nome || ""}
          value={selectedCustomer}
          onChange={(event, newValue) => {
            setSelectedCustomer(newValue);
          }}
          isOptionEqualToValue={(option, value) => option.id === value?.id}
          loading={loadingCustomers}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Selecione o Cliente"
              InputProps={{
                ...params.InputProps,
                endAdornment: (
                  <>
                    {loadingCustomers ? (
                      <CircularProgress color="inherit" size={20} />
                    ) : null}
                    {params.InputProps.endAdornment}
                  </>
                ),
              }}
            />
          )}
        />
      </Paper>

      {/* Tabela de Resultados */}
      <Box sx={{ height: "calc(100vh - 240px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={osData}
          columns={columns}
          loading={loadingOS}
          getRowId={(row) => row.id}
          localeText={{
            noRowsLabel: selectedCustomer
              ? "Nenhuma OS encontrada para este cliente."
              : "Selecione um cliente para ver o histórico.",
          }}
        />
      </Box>
    </>
  );
}

export default OSReportClient;
