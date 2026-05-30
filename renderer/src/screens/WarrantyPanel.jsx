import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import VerifiedUserIcon from "@mui/icons-material/VerifiedUser";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const formatDate = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

function WarrantyChip({ days }) {
  if (days < 0)
    return <Chip label="Expirada" color="default" size="small" />;
  if (days === 0)
    return <Chip label="Vence hoje" color="error" size="small" />;
  if (days <= 7)
    return <Chip label={`${days} dias`} color="error" size="small" />;
  if (days <= 30)
    return <Chip label={`${days} dias`} color="warning" size="small" />;
  return (
    <Chip label={`${days} dias`} color="success" size="small" variant="outlined" />
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Paper
      sx={{
        p: 2,
        display: "flex",
        alignItems: "center",
        gap: 2,
        borderLeft: 4,
        borderColor: `${color}.main`,
      }}
    >
      <Icon sx={{ fontSize: 32, color: `${color}.main` }} />
      <Box>
        <Typography variant="h5" fontWeight={700} lineHeight={1}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

export default function WarrantyPanel() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await window.api.getWarrantyPanel();
      if (result.success) setRows(result.data);
      setLoading(false);
    })();
  }, []);

  const parsed = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        dias_restantes: Number(r.dias_restantes),
      })),
    [rows]
  );

  const counts = useMemo(
    () => ({
      total: parsed.length,
      critica: parsed.filter((r) => r.dias_restantes >= 0 && r.dias_restantes <= 7).length,
      alerta: parsed.filter((r) => r.dias_restantes > 7 && r.dias_restantes <= 30).length,
      ok: parsed.filter((r) => r.dias_restantes > 30).length,
      expirada: parsed.filter((r) => r.dias_restantes < 0).length,
    }),
    [parsed]
  );

  const filtered = useMemo(() => {
    let data = parsed;
    if (filter === "critica") data = data.filter((r) => r.dias_restantes >= 0 && r.dias_restantes <= 7);
    else if (filter === "alerta") data = data.filter((r) => r.dias_restantes > 7 && r.dias_restantes <= 30);
    else if (filter === "ok") data = data.filter((r) => r.dias_restantes > 30);
    else if (filter === "expirada") data = data.filter((r) => r.dias_restantes < 0);
    if (search.trim()) {
      const term = search.toLowerCase();
      data = data.filter(
        (r) =>
          r.nome_cliente?.toLowerCase().includes(term) ||
          r.equipamento?.toLowerCase().includes(term) ||
          String(r.id).includes(term) ||
          r.numero_serie?.toLowerCase().includes(term)
      );
    }
    return data;
  }, [parsed, filter, search]);

  const columns = [
    { field: "id", headerName: "OS Nº", width: 80 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 180 },
    { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 200 },
    {
      field: "numero_serie",
      headerName: "Nº Série",
      width: 130,
      renderCell: (p) => p.value || "—",
    },
    {
      field: "data_saida",
      headerName: "Entregue em",
      width: 120,
      renderCell: (p) => formatDate(p.value),
    },
    {
      field: "data_vencimento",
      headerName: "Vencimento",
      width: 120,
      renderCell: (p) => formatDate(p.value),
    },
    { field: "garantia_dias", headerName: "Prazo (dias)", width: 110, align: "center", headerAlign: "center" },
    {
      field: "dias_restantes",
      headerName: "Situação",
      width: 130,
      align: "center",
      headerAlign: "center",
      renderCell: (p) => <WarrantyChip days={p.value} />,
    },
    {
      field: "solucao_aplicada",
      headerName: "Solução Aplicada",
      flex: 1,
      minWidth: 200,
      renderCell: (p) => (
        <Tooltip title={p.value || ""} placement="top">
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
              maxWidth: "100%",
            }}
          >
            {p.value || "—"}
          </span>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          Painel de Garantias
        </Typography>
        <Typography variant="body2" color="text.secondary">
          OS entregues com garantia ativa ou expirada.
        </Typography>
      </Box>

      {/* Stat cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard icon={VerifiedUserIcon} label="Total em garantia" value={counts.total} color="primary" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={ErrorOutlineIcon} label="Críticas (≤ 7 dias)" value={counts.critica} color="error" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={WarningAmberIcon} label="Em alerta (8–30 dias)" value={counts.alerta} color="warning" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={CheckCircleOutlineIcon} label="OK (> 30 dias)" value={counts.ok} color="success" />
        </Grid>
      </Grid>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small"
            label="Buscar cliente, equipamento ou OS"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }}
          />
          <ToggleButtonGroup
            size="small"
            value={filter}
            exclusive
            onChange={(_, v) => v && setFilter(v)}
          >
            <ToggleButton value="all">Todas</ToggleButton>
            <ToggleButton value="critica" sx={{ color: "error.main" }}>
              Críticas
            </ToggleButton>
            <ToggleButton value="alerta" sx={{ color: "warning.main" }}>
              Alerta
            </ToggleButton>
            <ToggleButton value="ok" sx={{ color: "success.main" }}>
              OK
            </ToggleButton>
            <ToggleButton value="expirada">Expiradas</ToggleButton>
          </ToggleButtonGroup>
          {counts.expirada > 0 && (
            <Chip
              label={`${counts.expirada} expirada${counts.expirada > 1 ? "s" : ""}`}
              color="default"
              size="small"
            />
          )}
        </Box>
      </Paper>

      {/* Grid */}
      <Box sx={{ height: "calc(100vh - 380px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          localeText={{
            noRowsLabel: search || filter !== "all"
              ? "Nenhuma garantia encontrada para este filtro."
              : "Nenhuma OS com garantia registrada.",
          }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
          getRowClassName={(p) => {
            const d = p.row.dias_restantes;
            if (d < 0) return "row-expired";
            if (d <= 7) return "row-critical";
            return "";
          }}
          sx={{
            "& .row-critical": { bgcolor: "error.main", opacity: 0.08 },
            "& .row-expired": { opacity: 0.5 },
          }}
        />
      </Box>
    </Box>
  );
}
