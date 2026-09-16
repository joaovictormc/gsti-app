import { useState, useEffect } from "react";
import {
  Box, Typography, Autocomplete, TextField, Paper,
  CircularProgress, Grid, Chip, Divider,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";

const formatCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatDate = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
};

const STATUS_COLORS = {
  Orçamento: "default", "Em Aberto": "warning",
  "Aguardando Autorização": "secondary", "Aguardando Peça": "warning",
  "Em Andamento": "primary", Finalizado: "success", Entregue: "success", Cancelado: "error",
};

const toInputDate = (d) => d.toISOString().slice(0, 10);

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderLeft: 4, borderColor: `${color}.main` }}>
      <Icon sx={{ fontSize: 32, color: `${color}.main` }} />
      <Box>
        <Typography variant="h5" fontWeight={700} lineHeight={1}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Box>
    </Paper>
  );
}

const columns = [
  { field: "id", headerName: "OS Nº", width: 90 },
  { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 180 },
  { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 200 },
  {
    field: "status", headerName: "Status", width: 170,
    renderCell: (p) => <Chip label={p.value} color={STATUS_COLORS[p.value] || "default"} size="small" variant="outlined" />,
  },
  { field: "data_entrada", headerName: "Data Entrada", width: 130, renderCell: (p) => formatDate(p.value) },
  { field: "data_saida", headerName: "Data Saída", width: 130, renderCell: (p) => formatDate(p.value) },
  {
    field: "valor_total", headerName: "Valor Total", width: 130, align: "right", headerAlign: "right",
    renderCell: (p) => formatCurrency(p.value),
  },
];

function OSReportAttendant() {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [startDate, setStartDate] = useState(toInputDate(firstOfMonth));
  const [endDate, setEndDate] = useState(toInputDate(today));
  const [osData, setOsData] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingOS, setLoadingOS] = useState(false);

  useEffect(() => {
    (async () => {
      setLoadingUsers(true);
      const result = await window.api.getUsers();
      if (result.success) setUsers(result.data || []);
      setLoadingUsers(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedUser) { setOsData([]); return; }
    (async () => {
      setLoadingOS(true);
      const result = await window.api.getOSByAttendant({
        userId: selectedUser.id,
        startDate,
        endDate,
      });
      if (result.success) setOsData(result.data);
      else setOsData([]);
      setLoadingOS(false);
    })();
  }, [selectedUser, startDate, endDate]);

  const totalOS = osData.length;
  const finalizadas = osData.filter((o) => ["Finalizado", "Entregue"].includes(o.status)).length;
  const totalValor = osData.reduce((s, o) => s + (Number(o.valor_total) || 0), 0);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>OS por Atendente</Typography>
        <Typography variant="body2" color="text.secondary">
          Visualize e analise as ordens de serviço por técnico responsável.
        </Typography>
      </Box>

      {/* Filtros */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "flex-start" }}>
          <Autocomplete
            sx={{ minWidth: 260 }}
            options={users}
            loading={loadingUsers}
            getOptionLabel={(o) => o.nome || ""}
            isOptionEqualToValue={(o, v) => o.id === v.id}
            value={selectedUser}
            onChange={(_, v) => setSelectedUser(v)}
            renderInput={(params) => (
              <TextField {...params} label="Técnico / Atendente" size="small"
                InputProps={{ ...params.InputProps, endAdornment: (
                  <>{loadingUsers && <CircularProgress size={16} />}{params.InputProps.endAdornment}</>
                )}}
              />
            )}
          />
          <TextField size="small" label="Data Inicial" type="date" value={startDate}
            onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} />
          <TextField size="small" label="Data Final" type="date" value={endDate}
            onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} />
        </Box>
      </Paper>

      {/* Stats */}
      {selectedUser && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <StatCard icon={AssignmentIcon} label="Total de OS" value={totalOS} color="primary" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard icon={CheckCircleIcon} label="Finalizadas / Entregues" value={finalizadas} color="success" />
            </Grid>
            <Grid item xs={12} sm={4}>
              <StatCard icon={AttachMoneyIcon} label="Receita Total" value={formatCurrency(totalValor)} color="warning" />
            </Grid>
          </Grid>

          <Box sx={{ height: "calc(var(--gsti-vh) - 480px)", minHeight: 320 }}>
            <DataGrid
              rows={osData}
              columns={columns}
              getRowId={(r) => r.id}
              loading={loadingOS}
              localeText={{ noRowsLabel: "Nenhuma OS encontrada para este atendente no período." }}
              initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
              pageSizeOptions={[10, 25, 50]}
            />
          </Box>
        </>
      )}

      {!selectedUser && (
        <Paper sx={{ p: 6, textAlign: "center" }}>
          <AssignmentIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography color="text.secondary">Selecione um técnico para visualizar as ordens de serviço.</Typography>
        </Paper>
      )}
    </Box>
  );
}

export default OSReportAttendant;
