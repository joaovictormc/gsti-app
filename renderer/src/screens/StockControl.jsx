import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, Paper, Chip, IconButton, TextField,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, ToggleButton, ToggleButtonGroup, CircularProgress,
  Snackbar, Alert, Grid,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import EditIcon from "@mui/icons-material/Edit";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useAuth } from "../contexts/AuthContext";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";

const formatCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

function StockChip({ atual, minimo }) {
  if (atual === 0) return <Chip label="Sem estoque" color="error" size="small" />;
  if (atual <= minimo) return <Chip label={`${atual} (mínimo)`} color="warning" size="small" />;
  return <Chip label={atual} color="success" size="small" variant="outlined" />;
}

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

export default function StockControl() {
  const { permissoes } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });
  const [adjustDialog, setAdjustDialog] = useState({ open: false, product: null, qty: "", operation: "entry" });
  const [minDialog, setMinDialog] = useState({ open: false, product: null, value: "" });
  const [saving, setSaving] = useState(false);

  const showSnackbar = (message, severity = "success") =>
    setSnackbar({ open: true, message, severity });

  const fetchStock = async () => {
    setLoading(true);
    const result = await window.api.getStock();
    if (result.success) setProducts(result.data.filter((p) => p.tipo === "Produto"));
    setLoading(false);
  };

  useEffect(() => { fetchStock(); }, []);

  const counts = useMemo(() => ({
    total: products.length,
    sem: products.filter((p) => Number(p.estoque_atual) === 0).length,
    baixo: products.filter((p) => Number(p.estoque_atual) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo)).length,
    ok: products.filter((p) => Number(p.estoque_atual) > Number(p.estoque_minimo)).length,
  }), [products]);

  const filtered = useMemo(() => {
    let data = products;
    if (filter === "sem") data = data.filter((p) => Number(p.estoque_atual) === 0);
    else if (filter === "baixo") data = data.filter((p) => Number(p.estoque_atual) > 0 && Number(p.estoque_atual) <= Number(p.estoque_minimo));
    else if (filter === "ok") data = data.filter((p) => Number(p.estoque_atual) > Number(p.estoque_minimo));
    if (search.trim()) {
      const t = search.toLowerCase();
      data = data.filter((p) => p.descricao?.toLowerCase().includes(t) || p.tipo?.toLowerCase().includes(t));
    }
    return data;
  }, [products, filter, search]);

  const handleAdjust = async () => {
    const qty = parseInt(adjustDialog.qty, 10);
    if (!qty || qty <= 0) { showSnackbar("Informe uma quantidade válida.", "error"); return; }
    setSaving(true);
    const result = await window.api.adjustStock({
      productId: adjustDialog.product.id,
      quantity: qty,
      operation: adjustDialog.operation,
    });
    setSaving(false);
    if (result.success) {
      showSnackbar(`Estoque atualizado: ${result.newStock} unidades.`);
      setAdjustDialog({ open: false, product: null, qty: "", operation: "entry" });
      fetchStock();
    } else {
      showSnackbar(result.error, "error");
    }
  };

  const handleUpdateMin = async () => {
    const val = parseInt(minDialog.value, 10);
    if (isNaN(val) || val < 0) { showSnackbar("Valor inválido.", "error"); return; }
    setSaving(true);
    const result = await window.api.updateStockMin({ productId: minDialog.product.id, estoque_minimo: val });
    setSaving(false);
    if (result.success) {
      showSnackbar("Estoque mínimo atualizado.");
      setMinDialog({ open: false, product: null, value: "" });
      fetchStock();
    } else {
      showSnackbar(result.error, "error");
    }
  };

  const columns = [
    { field: "descricao", headerName: "Produto / Serviço", flex: 1, minWidth: 200 },
    { field: "tipo", headerName: "Tipo", width: 100 },
    {
      field: "valor",
      headerName: "Preço",
      width: 120,
      align: "right",
      headerAlign: "right",
      renderCell: (p) => formatCurrency(p.value),
    },
    {
      field: "estoque_atual",
      headerName: "Estoque Atual",
      width: 150,
      align: "center",
      headerAlign: "center",
      renderCell: (p) => <StockChip atual={Number(p.value)} minimo={Number(p.row.estoque_minimo)} />,
    },
    {
      field: "estoque_minimo",
      headerName: "Mínimo",
      width: 90,
      align: "center",
      headerAlign: "center",
    },
    permissoes.ajustarEstoque && {
      field: "actions",
      headerName: "Ajustar",
      width: 130,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (p) => (
        <>
          <IconButton
            size="small" color="success" title="Entrada de estoque"
            onClick={() => setAdjustDialog({ open: true, product: p.row, qty: "", operation: "entry" })}
          >
            <AddIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small" color="error" title="Saída de estoque"
            onClick={() => setAdjustDialog({ open: true, product: p.row, qty: "", operation: "exit" })}
          >
            <RemoveIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small" title="Definir estoque mínimo"
            onClick={() => setMinDialog({ open: true, product: p.row, value: String(p.row.estoque_minimo) })}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ].filter(Boolean);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>Controle de Estoque</Typography>
        <Typography variant="body2" color="text.secondary">
          Gerencie o estoque de produtos e peças. Itens do tipo "Serviço" não precisam de controle de estoque.
        </Typography>
      </Box>

      {/* Stats */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard icon={CheckCircleOutlineIcon} label="Com estoque OK" value={counts.ok} color="success" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={WarningAmberIcon} label="Abaixo do mínimo" value={counts.baixo} color="warning" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={ErrorOutlineIcon} label="Sem estoque" value={counts.sem} color="error" />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard icon={ErrorOutlineIcon} label="Total de itens" value={counts.total} color="primary" />
        </Grid>
      </Grid>

      {/* Filtros */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", alignItems: "center" }}>
          <TextField
            size="small" label="Buscar produto ou serviço"
            value={search} onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 260 }}
          />
          <ToggleButtonGroup size="small" value={filter} exclusive onChange={(_, v) => v && setFilter(v)}>
            <ToggleButton value="all">Todos</ToggleButton>
            <ToggleButton value="baixo" sx={{ color: "warning.main" }}>Baixo</ToggleButton>
            <ToggleButton value="sem" sx={{ color: "error.main" }}>Sem estoque</ToggleButton>
            <ToggleButton value="ok" sx={{ color: "success.main" }}>OK</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Paper>

      {/* Grid */}
      <Box sx={{ height: "calc(100vh - 420px)", minHeight: 300, width: "100%" }}>
        <DataGrid
          rows={filtered} columns={columns} getRowId={(r) => r.id}
          loading={loading}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
          localeText={{ noRowsLabel: "Nenhum produto encontrado." }}
        />
      </Box>

      {/* Dialog ajuste de estoque */}
      <Dialog open={adjustDialog.open} onClose={() => setAdjustDialog({ open: false, product: null, qty: "", operation: "entry" })} maxWidth="xs" fullWidth>
        <DialogTitle>
          {adjustDialog.operation === "entry" ? "Entrada de Estoque" : "Saída de Estoque"}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {adjustDialog.product?.descricao} — Atual: {adjustDialog.product?.estoque_atual} unidades
          </Typography>
          <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
            <ToggleButtonGroup size="small" value={adjustDialog.operation} exclusive
              onChange={(_, v) => v && setAdjustDialog((d) => ({ ...d, operation: v }))}>
              <ToggleButton value="entry" sx={{ color: "success.main" }}>Entrada (+)</ToggleButton>
              <ToggleButton value="exit" sx={{ color: "error.main" }}>Saída (-)</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          <TextField
            autoFocus fullWidth label="Quantidade" type="number"
            value={adjustDialog.qty}
            onChange={(e) => setAdjustDialog((d) => ({ ...d, qty: e.target.value }))}
            inputProps={{ min: 1 }}
            onKeyDown={(e) => e.key === "Enter" && handleAdjust()}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdjustDialog({ open: false, product: null, qty: "", operation: "entry" })}>Cancelar</Button>
          <Button variant="contained" onClick={handleAdjust} disabled={saving}
            color={adjustDialog.operation === "entry" ? "success" : "error"}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog estoque mínimo */}
      <Dialog open={minDialog.open} onClose={() => setMinDialog({ open: false, product: null, value: "" })} maxWidth="xs" fullWidth>
        <DialogTitle>Estoque Mínimo</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {minDialog.product?.descricao}
          </Typography>
          <TextField
            autoFocus fullWidth label="Quantidade mínima" type="number"
            value={minDialog.value}
            onChange={(e) => setMinDialog((d) => ({ ...d, value: e.target.value }))}
            inputProps={{ min: 0 }}
            helperText="Alerta aparece quando o estoque cair abaixo deste valor."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMinDialog({ open: false, product: null, value: "" })}>Cancelar</Button>
          <Button variant="contained" onClick={handleUpdateMin} disabled={saving}
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : null}>
            {saving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
