import { useState, useEffect } from "react";
import {
  Box, Button, Modal, TextField, Typography, IconButton,
  Snackbar, Alert, CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ConfirmDialog from "./ConfirmDialog";

const modalStyle = {
  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  width: 400, bgcolor: "background.paper", border: "2px solid #000",
  boxShadow: 24, p: 4, maxHeight: "90vh", overflowY: "auto",
};

const toInputDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
};

const BLANK_REVENUE = { descricao: "", valor: "", data: toInputDateString(new Date()) };

function MiscRevenueGrid() {
  const [revenues, setRevenues] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isDeleting: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });

  const showSnackbar = (message, severity = "error") =>
    setSnackbar({ open: true, message, severity });

  const fetchRevenues = async () => {
    setIsLoading(true);
    const data = await window.api.getMiscRevenues();
    setRevenues(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchRevenues(); }, []);

  const handleOpenAddModal = () => {
    setEditingRevenue(BLANK_REVENUE);
    setModalKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (revenue) => {
    setEditingRevenue({ ...revenue, data: toInputDateString(revenue.data), valor: String(revenue.valor) });
    setModalKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingRevenue(null); };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingRevenue((prev) => ({ ...prev, [name]: value }));
  };

  const handleDeleteRequest = (id) => setConfirmDialog({ open: true, id, isDeleting: false });

  const handleDeleteConfirm = async () => {
    setConfirmDialog((d) => ({ ...d, isDeleting: true }));
    const result = await window.api.deleteMiscRevenue(confirmDialog.id);
    setConfirmDialog({ open: false, id: null, isDeleting: false });
    if (result.success) {
      fetchRevenues();
    } else {
      showSnackbar(`Erro ao excluir: ${result.error}`);
    }
  };

  const handleSave = async () => {
    if (!editingRevenue.descricao || !editingRevenue.valor || !editingRevenue.data) {
      showSnackbar("Descrição, Valor e Data são obrigatórios.");
      return;
    }
    setIsSaving(true);
    const apiCall = editingRevenue.id ? window.api.updateMiscRevenue : window.api.addMiscRevenue;
    const result = await apiCall(editingRevenue);
    setIsSaving(false);
    if (result.success) {
      handleCloseModal();
      fetchRevenues();
    } else {
      showSnackbar(`Erro ao salvar: ${result.error}`);
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 300 },
    {
      field: "data", headerName: "Data", width: 120,
      renderCell: (params) => {
        if (!params.value) return "";
        const date = new Date(params.value);
        const userTimezoneOffset = date.getTimezoneOffset() * 60000;
        const localDate = new Date(date.getTime() + userTimezoneOffset);
        return localDate.toLocaleDateString("pt-BR", { timeZone: "UTC" });
      },
    },
    {
      field: "valor", headerName: "Valor (R$)", width: 150, align: "right", headerAlign: "right",
      renderCell: (params) => {
        const value = Number(params.value);
        if (isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
      },
    },
    {
      field: "actions", headerName: "Ações", width: 100, sortable: false, align: "center", headerAlign: "center",
      renderCell: (params) => (
        <>
          <IconButton onClick={() => handleOpenEditModal(params.row)} title="Editar"><EditIcon /></IconButton>
          <IconButton onClick={() => handleDeleteRequest(params.row.id)} title="Excluir" color="error"><DeleteIcon /></IconButton>
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
        <Button variant="contained" onClick={handleOpenAddModal}>Adicionar Nova Receita</Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={revenues} columns={columns} getRowId={(row) => row.id}
          loading={isLoading}
          localeText={{ noRowsLabel: "Nenhuma receita avulsa encontrada." }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>

      {editingRevenue && (
        <Modal key={modalKey} open={isModalOpen} onClose={handleCloseModal}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              {editingRevenue.id ? "Editar Receita" : "Nova Receita"}
            </Typography>
            <TextField name="descricao" label="Descrição" value={editingRevenue.descricao}
              onChange={handleInputChange} fullWidth margin="normal" required />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField name="valor" label="Valor (R$)" type="number" value={editingRevenue.valor}
                onChange={handleInputChange} fullWidth margin="normal" required
                InputProps={{ inputProps: { step: "0.01", min: 0 } }} />
              <TextField name="data" label="Data" type="date" value={editingRevenue.data}
                onChange={handleInputChange} fullWidth margin="normal" required
                InputLabelProps={{ shrink: true }} />
            </Box>
            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
              <Button onClick={handleCloseModal} sx={{ mr: 1 }} disabled={isSaving}>Cancelar</Button>
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
        message="Tem certeza que deseja excluir esta receita?"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDialog({ open: false, id: null, isDeleting: false })}
        isLoading={confirmDialog.isDeleting}
      />

      <Snackbar open={snackbar.open} autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((s) => ({ ...s, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}

export default MiscRevenueGrid;
