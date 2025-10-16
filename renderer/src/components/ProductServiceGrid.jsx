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
  IconButton, // <-- Importe o IconButton
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit"; // <-- Importe o ícone de Edição
import DeleteIcon from "@mui/icons-material/Delete"; // <-- Importe o ícone de Deleção

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
  // Renomeado para refletir que pode ser um produto novo ou existente
  const [editingProduct, setEditingProduct] = useState(null);

  const fetchProducts = async () => {
    const productsData = await window.api.getProducts();
    setProducts(productsData);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenAddModal = () => {
    setEditingProduct(BLANK_PRODUCT);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (product) => {
    // Garante que o valor seja uma string para o campo de texto
    setEditingProduct({ ...product, valor: String(product.valor) });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null); // Limpa o estado ao fechar
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingProduct((prevState) => ({ ...prevState, [name]: value }));
  };
  
  const handleDelete = async (productId) => {
    if (window.confirm("Tem certeza que deseja excluir este item?")) {
      const result = await window.api.deleteProduct(productId);
      if (result.success) {
        fetchProducts(); // Atualiza a lista após a exclusão
      } else {
        alert(`Erro ao excluir: ${result.error}`);
      }
    }
  };

  const handleSave = async () => {
    if (!editingProduct.descricao || !editingProduct.valor) {
      alert("Descrição e Valor são obrigatórios.");
      return;
    }

    const valorString = String(editingProduct.valor).replace(",", ".");
    const valorNumerico = parseFloat(valorString) || 0;

    const dataToSend = {
      ...editingProduct,
      valor: valorNumerico,
    };

    // Decide se deve chamar a API de 'update' ou 'add'
    const apiCall = dataToSend.id
      ? window.api.updateProduct
      : window.api.addProduct;
      
    const result = await apiCall(dataToSend);

    if (result.success) {
      handleCloseModal();
      fetchProducts();
    } else {
      alert(`Erro ao salvar: ${result.error}`);
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
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      },
    },
    // --- NOVA COLUNA DE AÇÕES ---
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
          <IconButton onClick={() => handleDelete(params.row.id)}>
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
        />
      </Box>

      {/* O Modal agora só renderiza se houver um 'editingProduct' */}
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
              <Button onClick={handleCloseModal} sx={{ mr: 1 }}>
                Cancelar
              </Button>
              <Button variant="contained" onClick={handleSave}>
                Salvar
              </Button>
            </Box>
          </Box>
        </Modal>
      )}
    </>
  );
}

export default ProductServiceGrid;