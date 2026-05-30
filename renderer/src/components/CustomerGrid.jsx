import { useState, useEffect } from "react";
import { Box, Button, Modal, IconButton, Snackbar, Alert } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CustomerForm from "./CustomerForm";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import ConfirmDialog from "./ConfirmDialog";

// --- FUNÇÕES DE FORMATAÇÃO (Seu código, já estão ótimas) ---
const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
};

const formatDocument = (doc) => {
  if (!doc) return "";
  const cleaned = String(doc).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cleaned.length === 14)
    return cleaned.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  return doc;
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: '95vw', sm: 480 },
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
};

const BLANK_CUSTOMER = {
  nome: "",
  tipo_pessoa: "Física",
  cpf_cnpj: "",
  telefone: "",
  email: "",
  endereco: "",
};

function CustomerGrid() {
  const [customers, setCustomers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isDeleting: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });

  const showSnackbar = (message, severity = "error") =>
    setSnackbar({ open: true, message, severity });

  // --- LÓGICA DE BUSCA DE DADOS OTIMIZADA ---
  const fetchCustomers = async () => {
    setIsLoading(true);
    const data = await window.api.getCustomers();
    setCustomers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCustomer(BLANK_CUSTOMER);
    setFormKey((prevKey) => prevKey + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer) => {
    const sanitizedCustomer = Object.fromEntries(
      Object.entries(customer).map(([key, value]) => [
        key,
        value === null ? "" : value,
      ])
    );
    setEditingCustomer(sanitizedCustomer);
    setFormKey((prevKey) => prevKey + 1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null);
  };

  const handleDeleteRequest = (customerId) =>
    setConfirmDialog({ open: true, id: customerId, isDeleting: false });

  const handleDeleteConfirm = async () => {
    setConfirmDialog((d) => ({ ...d, isDeleting: true }));
    const result = await window.api.deleteCustomer(confirmDialog.id);
    setConfirmDialog({ open: false, id: null, isDeleting: false });
    if (result.success) fetchCustomers();
    else showSnackbar(`Erro ao excluir cliente: ${result.error}`);
  };

  const handleSave = async (customerData) => {
    const apiCall = customerData.id ? window.api.updateCustomer : window.api.addCustomer;
    const result = await apiCall(customerData);
    if (result.success) {
      handleCloseModal();
      fetchCustomers();
    } else {
      showSnackbar(`Erro ao salvar cliente: ${result.error}`);
    }
  };

  const handleValidation = async (cnpj) => {
    return await window.api.validateCnpj(cnpj);
  };

  const columns = [
    { field: "id", headerName: "ID", width: 50 },
    { field: "nome", headerName: "Nome", flex: 1, minWidth: 150 },
    {
      field: "cpf_cnpj",
      headerName: "CPF/CNPJ",
      width: 160,
      // --- ALTERAÇÃO PRINCIPAL: Usando renderCell para controle total ---
      renderCell: (params) => formatDocument(params.row.cpf_cnpj),
    },
    {
      field: "telefone",
      headerName: "Telefone",
      width: 140,
      // --- ALTERAÇÃO PRINCIPAL: Usando renderCell para controle total ---
      renderCell: (params) => formatPhone(params.row.telefone),
    },
    { field: "email", headerName: "E-Mail", flex: 1, minWidth: 200 },
    { field: "endereco", headerName: "Endereço", flex: 1, minWidth: 200 },
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
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Novo Cliente
        </Button>
      </Box>
      <Box sx={{ height: "calc(100vh - 240px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={customers}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>
      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          {editingCustomer && (
            <CustomerForm
              key={formKey}
              initialData={editingCustomer}
              onSave={handleSave}
              onClose={handleCloseModal}
              onValidate={handleValidation}
            />
          )}
        </Box>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este cliente?"
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

export default CustomerGrid;