import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Button,
  Tooltip,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";

// Status considerados "abertos" (não finalizados)
const OPEN_STATUSES = [
  "Orçamento",
  "Aguardando Autorização",
  "Em Aberto",
  "Aguardando Peça",
  "Em Andamento",
];

const STATUS_COLORS = {
  "Orçamento": "default",
  "Aguardando Autorização": "secondary",
  "Em Aberto": "info",
  "Aguardando Peça": "warning",
  "Em Andamento": "primary",
};

// Cor do "dias em aberto" conforme a idade
const ageColor = (dias) => {
  if (dias == null) return "text.secondary";
  if (dias <= 7) return "success.main";
  if (dias <= 15) return "text.primary";
  if (dias <= 30) return "warning.main";
  return "error.main";
};

const formatDateTime = (value) =>
  value
    ? new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatCurrency = (value) => {
  const n = Number(value);
  if (value == null || isNaN(n)) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);
};

function OSReportOpenAging() {
  const [allRows, setAllRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState([]); // vazio = todos

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.api.getOpenOSAging();
      setAllRows(result?.success ? result.data : []);
    } catch (_) {
      setAllRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const rows = useMemo(() => {
    if (statusFilter.length === 0) return allRows;
    return allRows.filter((r) => statusFilter.includes(r.status));
  }, [allRows, statusFilter]);

  // Resumo
  const { total, atrasadas, maisAntiga } = useMemo(() => {
    const total = rows.length;
    const atrasadas = rows.filter((r) => r.atrasada).length;
    const maisAntiga = rows.reduce(
      (max, r) => (r.dias_aberto != null && r.dias_aberto > max ? r.dias_aberto : max),
      0
    );
    return { total, atrasadas, maisAntiga };
  }, [rows]);

  const columns = [
    { field: "id", headerName: "OS Nº", width: 80 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 180 },
    { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 200 },
    {
      field: "status",
      headerName: "Status",
      width: 180,
      renderCell: (p) => (
        <Chip
          label={p.value}
          size="small"
          color={STATUS_COLORS[p.value] || "default"}
          variant="outlined"
        />
      ),
    },
    {
      field: "data_entrada",
      headerName: "Entrada",
      width: 150,
      renderCell: (p) => formatDateTime(p.value),
    },
    {
      field: "dias_aberto",
      headerName: "Dias em Aberto",
      width: 140,
      align: "center",
      headerAlign: "center",
      renderCell: (p) => (
        <Typography variant="body2" fontWeight={700} color={ageColor(p.value)}>
          {p.value != null ? `${p.value} dia${p.value === 1 ? "" : "s"}` : "—"}
        </Typography>
      ),
    },
    {
      field: "data_prevista",
      headerName: "Previsão",
      width: 160,
      renderCell: (p) =>
        p.value ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {p.row.atrasada && (
              <Tooltip title="Previsão vencida">
                <WarningAmberIcon fontSize="small" color="error" />
              </Tooltip>
            )}
            <Typography variant="body2" color={p.row.atrasada ? "error.main" : "text.primary"}>
              {formatDateTime(p.value)}
            </Typography>
          </Stack>
        ) : (
          "—"
        ),
    },
    {
      field: "valor_total",
      headerName: "Valor",
      width: 130,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => formatCurrency(p.value),
    },
  ];

  return (
    <>
      <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1}>
        <Typography variant="h4" gutterBottom>
          Relatório de OS Abertas por Tempo
        </Typography>
        <Button
          variant="outlined"
          size="small"
          startIcon={<RefreshIcon />}
          onClick={fetchData}
          disabled={loading}
        >
          Atualizar
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Ordens de serviço ainda não finalizadas, das mais antigas para as mais
        recentes. Use para priorizar o que está há mais tempo parado.
      </Typography>

      {/* Resumo */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap">
        <Chip label={`Total em aberto: ${total}`} color="primary" />
        <Chip
          label={`Atrasadas: ${atrasadas}`}
          color={atrasadas > 0 ? "error" : "default"}
          variant={atrasadas > 0 ? "filled" : "outlined"}
        />
        <Chip
          label={`Mais antiga: ${maisAntiga} dia${maisAntiga === 1 ? "" : "s"}`}
          color={maisAntiga > 30 ? "error" : maisAntiga > 15 ? "warning" : "default"}
          variant="outlined"
        />
      </Stack>

      {/* Filtro por status */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Filtrar por status (vazio = todos os abertos)
        </Typography>
        <ToggleButtonGroup
          value={statusFilter}
          onChange={(_, val) => setStatusFilter(val)}
          size="small"
          color="primary"
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
          {OPEN_STATUSES.map((s) => (
            <ToggleButton key={s} value={s} sx={{ textTransform: "none" }}>
              {s}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Paper>

      {/* Tabela */}
      <Box sx={{ height: "calc(var(--gsti-vh) - 380px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(row) => row.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50, 100]}
          getRowClassName={(p) => (p.row.atrasada ? "row-overdue" : "")}
          localeText={{ noRowsLabel: "Nenhuma OS em aberto." }}
          sx={{
            "& .row-overdue": { bgcolor: "rgba(239, 68, 68, 0.06)" },
          }}
        />
      </Box>
    </>
  );
}

export default OSReportOpenAging;
