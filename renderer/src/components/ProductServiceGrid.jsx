import { useState, useEffect } from "react";
import {
  Box,
  Button,
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
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ConfirmDialog from "./ConfirmDialog";

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

const BLANK_PRODUCT = { descricao: "", valor: "", tipo: "Serviço" };

function ProductServiceGrid() {
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
    setEditingProduct({ ...product, valor: String(product.valor) });
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

    const valorString = String(editingProduct.valor).replace(",", ".");
    const valorNumerico = parseFloat(valorString) || 0;
    const dataToSend = { ...editingProduct, valor: valorNumerico };

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

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 250 },
    { field: "tipo", headerName: "Tipo", width: 150 },
    {
      field: "valor",
      headerName: "Valor (R$)",
      width: 150,
      renderCell: (params) => {
        const value = Number(params.row.valor);
        if (isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton onClick={() => handleOpenEditModal(params.row)}>
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleDeleteRequest(params.row.id)} color="error">
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Gestão de Produtos e Serviços
        </Typography>
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Novo
        </Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
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
            <TextField
              margin="normal"
              required
              fullWidth
              name="valor"
              label="Valor (R$)"
              type="text"
              inputMode="decimal"
              value={editingProduct.valor}
              onChange={handleInputChange}
            />
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
