import { useState, useEffect } from "react";
import { Box, Button, Modal, IconButton } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CustomerForm from "./CustomerForm";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// FUNÇÕES DE FORMATAÇÃO (CORRIGIDAS E MAIS ROBUSTAS)
const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone; // Retorna o original se não corresponder
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
  return doc; // Retorna o original se não corresponder
};

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
  const [formKey, setFormKey] = useState(0); // Chave para forçar o reset do formulário

  const fetchCustomers = async () =>
    setCustomers(await window.api.getCustomers());

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleOpenAddModal = () => {
    setEditingCustomer(BLANK_CUSTOMER);
    setFormKey((prevKey) => prevKey + 1); // Muda a key para garantir um formulário novo
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
    setFormKey((prevKey) => prevKey + 1); // Muda a key para garantir um formulário novo
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingCustomer(null); // Limpa o estado ao fechar
  };

  const handleDelete = async (customerId) => {
    if (window.confirm("Tem certeza que deseja excluir este cliente?")) {
      const result = await window.api.deleteCustomer(customerId);
      if (result.success) fetchCustomers();
      else alert(`Erro ao excluir cliente: ${result.error}`);
    }
  };

  const handleSave = async (customerData) => {
    const apiCall = customerData.id
      ? window.api.updateCustomer
      : window.api.addCustomer;
    const result = await apiCall(customerData);
    if (result.success) {
      handleCloseModal();
      fetchCustomers();
    } else {
      alert(`Erro ao salvar cliente: ${result.error}`);
    }
  };

  // A validação agora é uma responsabilidade do formulário, mas a chamada é feita aqui
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
      // **CORREÇÃO DEFINITIVA DA FORMATAÇÃO**
      valueFormatter: (params) => formatDocument(params.value),
    },
    {
      field: "telefone",
      headerName: "Telefone",
      width: 140,
      // **CORREÇÃO DEFINITIVA DA FORMATAÇÃO**
      valueFormatter: (params) => formatPhone(params.value),
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
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Novo Cliente
        </Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={customers}
          columns={columns}
          getRowId={(row) => row.id}
        />
      </Box>
      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          {/* Renderiza o formulário apenas se houver um cliente para editar/adicionar */}
          {editingCustomer && (
            <CustomerForm
              key={formKey} // A chave garante que o componente seja 100% novo a cada abertura
              initialData={editingCustomer}
              onSave={handleSave}
              onClose={handleCloseModal}
              onValidate={handleValidation}
            />
          )}
        </Box>
      </Modal>
    </>
  );
}

export default CustomerGrid;
