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
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";

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
  const [newProduct, setNewProduct] = useState(BLANK_PRODUCT);

  const fetchProducts = async () => {
    const productsData = await window.api.getProducts();
    setProducts(productsData);
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenModal = () => {
    setNewProduct(BLANK_PRODUCT);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => setIsModalOpen(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewProduct((prevState) => ({ ...prevState, [name]: value }));
  };

  const handleSave = async () => {
    if (!newProduct.descricao || !newProduct.valor) {
      alert("Descrição e Valor são obrigatórios.");
      return;
    }

    const dataToSend = {
      ...newProduct,
      valor: parseFloat(newProduct.valor),
    };

    const result = await window.api.addProduct(dataToSend);
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
      valueFormatter: (params) => Number(params.value).toFixed(2),
    },
  ];

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" gutterBottom>
          Gestão de Produtos e Serviços
        </Typography>
        <Button variant="contained" onClick={handleOpenModal}>
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

      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2">
            Novo Produto/Serviço
          </Typography>
          <TextField
            margin="normal"
            required
            fullWidth
            name="descricao"
            label="Descrição"
            value={newProduct.descricao}
            onChange={handleInputChange}
          />
          <TextField
            margin="normal"
            required
            fullWidth
            name="valor"
            label="Valor (R$)"
            type="number"
            value={newProduct.valor}
            onChange={handleInputChange}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Tipo</InputLabel>
            <Select
              name="tipo"
              value={newProduct.tipo}
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
    </>
  );
}

export default ProductServiceGrid;
