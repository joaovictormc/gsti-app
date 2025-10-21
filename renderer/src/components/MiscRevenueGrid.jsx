import { useState, useEffect } from "react";
import {
  Box, Button, Modal, TextField, Typography, IconButton, InputAdornment
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Estilo do Modal
const modalStyle = {
  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  width: 400, bgcolor: "background.paper", border: "2px solid #000",
  boxShadow: 24, p: 4, maxHeight: '90vh', overflowY: 'auto',
};

// Formato de data YYYY-MM-DD para o input type="date"
const toInputDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split('T')[0];
};

const BLANK_REVENUE = {
  descricao: "",
  valor: "",
  data: toInputDateString(new Date()),
};

function MiscRevenueGrid() {
  const [revenues, setRevenues] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState(null);
  // --- CORREÇÃO APLICADA AQUI ---
  const [modalKey, setModalKey] = useState(0); // Para resetar o formulário

  const fetchRevenues = async () => {
    const data = await window.api.getMiscRevenues();
    setRevenues(data);
  };

  useEffect(() => {
    fetchRevenues();
  }, []);

  const handleOpenAddModal = () => {
    setEditingRevenue(BLANK_REVENUE);
    setModalKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (revenue) => {
    const revenueToEdit = {
      ...revenue,
      data: toInputDateString(revenue.data),
      valor: String(revenue.valor),
    };
    setEditingRevenue(revenueToEdit);
    setModalKey(prev => prev + 1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingRevenue(null);
  };

  const handleDelete = async (revenueId) => {
    if (window.confirm("Tem certeza que deseja excluir esta receita?")) {
      const result = await window.api.deleteMiscRevenue(revenueId);
      if (result.success) {
        fetchRevenues();
      } else {
        alert(`Erro ao excluir receita: ${result.error}`);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingRevenue((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!editingRevenue.descricao || !editingRevenue.valor || !editingRevenue.data) {
      alert("Descrição, Valor e Data são obrigatórios.");
      return;
    }

    const dataToSend = { ...editingRevenue };

    const apiCall = dataToSend.id ? window.api.updateMiscRevenue : window.api.addMiscRevenue;
    const result = await apiCall(dataToSend);

    if (result.success) {
      handleCloseModal();
      fetchRevenues();
    } else {
      alert(`Erro ao salvar receita: ${result.error}`);
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 300 },
    {
      field: "data",
      headerName: "Data",
      width: 120,
      renderCell: (params) => {
        if (!params.value) return "";
        const date = new Date(params.value);
         // Corrige a exibição da data local
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() + userTimezoneOffset); // Ajusta para UTC 0 e depois pega data local
        return localDate.toLocaleDateString("pt-BR", {timeZone: 'UTC'}); // Exibe data correta
      },
    },
    {
      field: "valor",
      headerName: "Valor (R$)",
      width: 150,
      align: 'right',
      headerAlign: 'right',
      renderCell: (params) => {
        const value = Number(params.value);
        if (isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <>
          <IconButton onClick={() => handleOpenEditModal(params.row)} title="Editar Receita">
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(params.row.id)} title="Excluir Receita">
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <>
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Gestão de Receitas Avulsas
        </Typography>
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Nova Receita
        </Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={revenues}
          columns={columns}
          getRowId={(row) => row.id}
          localeText={{ noRowsLabel: "Nenhuma receita avulsa encontrada." }}
        />
      </Box>

      {/* Modal para Adicionar/Editar Receita */}
      {editingRevenue && (
        <Modal open={isModalOpen} onClose={handleCloseModal}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              {editingRevenue.id ? "Editar Receita" : "Nova Receita"}
            </Typography>

            <TextField
              name="descricao" label="Descrição" value={editingRevenue.descricao}
              onChange={handleInputChange} fullWidth margin="normal" required
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
                <TextField
                name="valor" label="Valor (R$)" type="number"
                value={editingRevenue.valor} onChange={handleInputChange} fullWidth margin="normal" required
                InputProps={{ inputProps: { step: "0.01", min: 0 } }}
                />
                <TextField
                name="data" label="Data" type="date" value={editingRevenue.data}
                onChange={handleInputChange} fullWidth margin="normal" required
                InputLabelProps={{ shrink: true }}
                />
            </Box>

            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={handleCloseModal} sx={{ mr: 1 }}>Cancelar</Button>
              <Button variant="contained" onClick={handleSave}>Salvar</Button>
            </Box>
          </Box>
        </Modal>
      )}
    </>
  );
}

export default MiscRevenueGrid;