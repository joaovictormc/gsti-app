import { useState, useEffect } from 'react';
import { Box, Button, Modal, TextField, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

// Estilo para o nosso Modal
const modalStyle = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: 400,
  bgcolor: 'background.paper',
  border: '2px solid #000',
  boxShadow: 24,
  p: 4,
};

const columns = [
  { field: 'id', headerName: 'ID', width: 90 },
  { field: 'nome', headerName: 'Nome', width: 250 },
  { field: 'telefone', headerName: 'Telefone', width: 150 },
  { field: 'email', headerName: 'Email', width: 250 },
];

function CustomerGrid() {
  const [customers, setCustomers] = useState([]);
  // Estados para o Modal
  const [open, setOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ nome: '', telefone: '', email: '' });

  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    setOpen(false);
    // Limpa o formulário ao fechar
    setNewCustomer({ nome: '', telefone: '', email: '' });
  };

  const fetchCustomers = async () => {
    const customerData = await window.api.getCustomers();
    setCustomers(customerData);
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewCustomer(prevState => ({ ...prevState, [name]: value }));
  };

  const handleSubmit = async () => {
    const result = await window.api.addCustomer(newCustomer);
    if (result.success) {
      handleClose(); // Fecha o modal
      fetchCustomers(); // Atualiza a tabela com os novos dados
    } else {
      console.error("Erro ao adicionar cliente:", result.error);
      // Aqui você poderia exibir um alerta de erro para o usuário
    }
  };

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={handleOpen}>
          Adicionar Novo Cliente
        </Button>
      </Box>
      <Box sx={{ height: 450, width: '100%', backgroundColor: 'white' }}>
        <DataGrid
          rows={customers}
          columns={columns}
          initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
          pageSizeOptions={[5]}
          checkboxSelection
          disableRowSelectionOnClick
        />
      </Box>

      <Modal open={open} onClose={handleClose}>
        <Box sx={modalStyle}>
          <Typography variant="h6" component="h2">
            Cadastrar Novo Cliente
          </Typography>
          <TextField margin="normal" required fullWidth name="nome" label="Nome Completo" value={newCustomer.nome} onChange={handleInputChange} />
          <TextField margin="normal" fullWidth name="telefone" label="Telefone" value={newCustomer.telefone} onChange={handleInputChange} />
          <TextField margin="normal" fullWidth name="email" label="Email" value={newCustomer.email} onChange={handleInputChange} />
          <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
            <Button onClick={handleClose} sx={{ mr: 1 }}>Cancelar</Button>
            <Button variant="contained" onClick={handleSubmit}>Salvar</Button>
          </Box>
        </Box>
      </Modal>
    </>
  );
}

export default CustomerGrid;