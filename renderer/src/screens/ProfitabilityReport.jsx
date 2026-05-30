import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Paper, Grid, CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend,
} from "chart.js";
import { useTheme } from "@mui/material/styles";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const formatCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 2, borderLeft: 4, borderColor: `${color}.main` }}>
      <Icon sx={{ fontSize: 32, color: `${color}.main` }} />
      <Box>
        <Typography variant="h6" fontWeight={700} lineHeight={1}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Box>
    </Paper>
  );
}

export default function ProfitabilityReport() {
  const theme = useTheme();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await window.api.getProfitabilityReport();
      if (result.success) setData(result.data);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => ({
    receita: data.reduce((s, r) => s + Number(r.receita_total), 0),
    vendas: data.reduce((s, r) => s + Number(r.total_vendas), 0),
    itens: data.filter((r) => Number(r.total_vendas) > 0).length,
  }), [data]);

  const top5 = useMemo(
    () => data.filter((r) => Number(r.receita_total) > 0).slice(0, 5),
    [data]
  );

  const chartData = {
    labels: top5.map((r) => r.descricao.length > 20 ? r.descricao.slice(0, 20) + "…" : r.descricao),
    datasets: [{
      label: "Receita (R$)",
      data: top5.map((r) => Number(r.receita_total)),
      backgroundColor: "rgba(99,102,241,0.75)",
      borderColor: "#6366f1",
      borderWidth: 1,
      borderRadius: 4,
    }],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (c) => formatCurrency(c.parsed.y) } },
    },
    scales: {
      x: { ticks: { color: theme.palette.text.secondary }, grid: { color: theme.palette.divider } },
      y: {
        ticks: { callback: (v) => formatCurrency(v), color: theme.palette.text.secondary },
        grid: { color: theme.palette.divider },
      },
    },
  };

  const columns = [
    { field: "descricao", headerName: "Produto / Serviço", flex: 1, minWidth: 200 },
    { field: "tipo", headerName: "Tipo", width: 100 },
    {
      field: "preco_tabela",
      headerName: "Preço Tabela",
      width: 130,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => formatCurrency(p.value),
    },
    {
      field: "total_vendas",
      headerName: "Vendas",
      width: 90,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "total_quantidade",
      headerName: "Qtd.",
      width: 80,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "preco_medio",
      headerName: "Preço Médio",
      width: 130,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => Number(p.row.total_vendas) > 0 ? formatCurrency(p.value) : "—",
    },
    {
      field: "receita_total",
      headerName: "Receita Total",
      width: 140,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => (
        <Typography
          variant="body2"
          fontWeight={Number(p.value) > 0 ? 700 : 400}
          color={Number(p.value) > 0 ? "success.main" : "text.disabled"}
        >
          {Number(p.value) > 0 ? formatCurrency(p.value) : "—"}
        </Typography>
      ),
    },
  ];

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", pt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>Lucratividade por Serviço</Typography>
        <Typography variant="body2" color="text.secondary">
          Receita gerada por cada produto ou serviço em OS finalizadas e entregues.
        </Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={4}>
          <StatCard icon={TrendingUpIcon} label="Receita total gerada" value={formatCurrency(totals.receita)} color="success" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard icon={ReceiptLongIcon} label="Vendas realizadas" value={totals.vendas} color="primary" />
        </Grid>
        <Grid item xs={12} sm={4}>
          <StatCard icon={ShoppingCartIcon} label="Itens com vendas" value={`${totals.itens} / ${data.length}`} color="secondary" />
        </Grid>
      </Grid>

      {/* Gráfico Top 5 */}
      {top5.length > 0 && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" fontWeight={600} mb={2}>Top 5 por Receita</Typography>
          <Box sx={{ height: 280 }}>
            <Bar data={chartData} options={chartOptions} />
          </Box>
        </Paper>
      )}

      {/* Tabela completa */}
      <Box sx={{ height: "calc(100vh - 520px)", minHeight: 280, width: "100%" }}>
        <DataGrid
          rows={data} columns={columns} getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
          localeText={{ noRowsLabel: "Nenhum dado encontrado." }}
        />
      </Box>
    </Box>
  );
}
