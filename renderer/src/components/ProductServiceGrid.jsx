import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Stack,
  Modal,
  TextField,
  Typography,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  IconButton,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import { useAuth } from "../contexts/AuthContext";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ConfirmDialog from "./ConfirmDialog";

const modalStyle = {
  position: "absolute",
  top: "calc(50% + var(--gsti-barra) / 2)",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: '95vw', sm: 480 },
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

const BLANK_PRODUCT = { descricao: "", valor: "", custo: "", tipo: "Serviço", estoque_atual: "", estoque_minimo: "" };

const formatarMoeda = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);
// "1.234,56" / "12,5" / "12.5" -> número (ou null quando vazio)
const lerMoeda = (v) => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  let t = String(v).trim();
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const paraCampo = (v) => (v === null || v === undefined ? "" : String(v).replace(".", ","));

function ProductServiceGrid() {
  const { permissoes } = useAuth();
  const [products, setProducts] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isDeleting: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });

  const showSnackbar = (message, severity = "error") =>
    setSnackbar({ open: true, message, severity });

  const fetchProducts = async () => {
    setIsLoading(true);
    const productsData = await window.api.getProducts();
    setProducts(productsData);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAddModal = () => {
    setEditingProduct(BLANK_PRODUCT);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    setEditingProduct({
      ...product,
      valor: paraCampo(product.valor),
      custo: paraCampo(product.custo),
      estoque_minimo: String(product.estoque_minimo ?? ""),
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingProduct((prevState) => ({ ...prevState, [name]: value }));
  };

  const handleDeleteRequest = (productId) => {
    setConfirmDialog({ open: true, id: productId, isDeleting: false });
  };

  const handleDeleteConfirm = async () => {
    setConfirmDialog((d) => ({ ...d, isDeleting: true }));
    const result = await window.api.deleteProduct(confirmDialog.id);
    setConfirmDialog({ open: false, id: null, isDeleting: false });
    if (result.success) {
      fetchProducts();
    } else {
      showSnackbar(`Erro ao excluir: ${result.error}`);
    }
  };

  const handleSave = async () => {
    if (!editingProduct.descricao || !editingProduct.valor) {
      showSnackbar("Descrição e Valor são obrigatórios.");
      return;
    }

    const valorNumerico = lerMoeda(editingProduct.valor);
    const custoNumerico = lerMoeda(editingProduct.custo);
    if (!Number.isFinite(valorNumerico) || valorNumerico < 0) {
      showSnackbar("Informe um valor de venda válido.");
      return;
    }
    if (Number.isNaN(custoNumerico) || (custoNumerico !== null && custoNumerico < 0)) {
      showSnackbar("Informe um custo válido (ou deixe em branco).");
      return;
    }
    const dataToSend = { ...editingProduct, valor: valorNumerico, custo: custoNumerico };

    setIsSaving(true);
    const apiCall = dataToSend.id ? window.api.updateProduct : window.api.addProduct;
    const result = await apiCall(dataToSend);
    setIsSaving(false);

    if (result.success) {
      handleCloseModal();
      fetchProducts();
    } else {
      showSnackbar(`Erro ao salvar: ${result.error}`);
    }
  };

  const podeEditar = !!permissoes.editarProdutos;
  const podeExcluir = !!permissoes.podeExcluir;
  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 250 },
    { field: "tipo", headerName: "Tipo", width: 110 },
    {
      field: "valor",
      headerName: "Venda",
      width: 120,
      renderCell: (params) => formatarMoeda(params.row.valor),
    },
    permissoes.verCusto && {
      field: "custo",
      headerName: "Custo",
      width: 120,
      renderCell: (params) => (params.row.custo === null || params.row.custo === undefined ? "—" : formatarMoeda(params.row.custo)),
    },
    permissoes.verCusto && {
      field: "margem",
      headerName: "Margem",
      width: 110,
      valueGetter: (_v, row) => {
        if (row.custo === null || row.custo === undefined || !Number(row.valor)) return null;
        return ((Number(row.valor) - Number(row.custo)) / Number(row.valor)) * 100;
      },
      renderCell: (params) =>
        params.value === null ? "—" : (
          <Chip size="small" label={`${params.value.toFixed(0)}%`} color={params.value < 0 ? "error" : params.value < 20 ? "warning" : "success"} variant="outlined" />
        ),
    },
    {
      field: "estoque_atual",
      headerName: "Estoque",
      width: 100,
      renderCell: (params) => (params.row.tipo === "Produto" ? params.row.estoque_atual : "—"),
    },
    (podeEditar || podeExcluir) && {
      field: "actions",
      headerName: "Ações",
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <>
          {podeEditar && (
            <IconButton onClick={() => handleOpenEditModal(params.row)} title="Editar">
              <EditIcon />
            </IconButton>
          )}
          {podeExcluir && (
            <IconButton onClick={() => handleDeleteRequest(params.row.id)} color="error" title="Excluir">
              <DeleteIcon />
            </IconButton>
          )}
        </>
      ),
    },
  ].filter(Boolean);

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Gestão de Produtos e Serviços
        </Typography>
        {podeEditar && (
          <Button variant="contained" onClick={handleOpenAddModal}>
            Adicionar Novo
          </Button>
        )}
      </Box>
      <Box sx={{ height: "calc(var(--gsti-vh) - 240px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={products}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>

      {editingProduct && (
        <Modal open={isModalOpen} onClose={handleCloseModal}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2">
              {editingProduct.id ? "Editar Produto/Serviço" : "Novo Produto/Serviço"}
            </Typography>
            <TextField
              margin="normal"
              required
              fullWidth
              name="descricao"
              label="Descrição"
              value={editingProduct.descricao}
              onChange={handleInputChange}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                margin="normal"
                required
                fullWidth
                name="valor"
                label="Valor de venda (R$)"
                type="text"
                inputMode="decimal"
                value={editingProduct.valor}
                onChange={handleInputChange}
              />
              {permissoes.verCusto && (
                <TextField
                  margin="normal"
                  fullWidth
                  name="custo"
                  label="Custo (R$)"
                  type="text"
                  inputMode="decimal"
                  value={editingProduct.custo}
                  onChange={handleInputChange}
                  helperText="Opcional — usado na margem"
                />
              )}
            </Stack>
            <FormControl fullWidth margin="normal">
              <InputLabel>Tipo</InputLabel>
              <Select
                name="tipo"
                value={editingProduct.tipo}
                label="Tipo"
                onChange={handleInputChange}
              >
                <MenuItem value="Serviço">Serviço</MenuItem>
                <MenuItem value="Produto">Produto</MenuItem>
              </Select>
            </FormControl>
            {editingProduct.tipo === "Produto" && (
              <Stack direction="row" spacing={2}>
                {editingProduct.id ? (
                  <TextField
                    margin="normal"
                    fullWidth
                    label="Estoque atual"
                    value={editingProduct.estoque_atual ?? 0}
                    disabled
                    helperText="Ajuste em Controle de Estoque"
                  />
                ) : (
                  <TextField
                    margin="normal"
                    fullWidth
                    name="estoque_atual"
                    label="Quantidade em estoque"
                    type="number"
                    value={editingProduct.estoque_atual}
                    onChange={handleInputChange}
                    inputProps={{ min: 0 }}
                  />
                )}
                <TextField
                  margin="normal"
                  fullWidth
                  name="estoque_minimo"
                  label="Estoque mínimo"
                  type="number"
                  value={editingProduct.estoque_minimo}
                  onChange={handleInputChange}
                  inputProps={{ min: 0 }}
                  helperText="Alerta de estoque baixo"
                />
              </Stack>
            )}
            <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={handleCloseModal} sx={{ mr: 1 }} disabled={isSaving}>
                Cancelar
              </Button>
              <Button variant="contained" onClick={handleSave} disabled={isSaving}
                startIcon={isSaving ? <CircularProgress size={16} color="inherit" /> : null}>
                {isSaving ? "Salvando..." : "Salvar"}
              </Button>
            </Box>
          </Box>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este item?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDialog({ open: false, id: null, isDeleting: false })}
        isLoading={confirmDialog.isDeleting}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default ProductServiceGrid;
