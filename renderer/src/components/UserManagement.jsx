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
  Alert,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import ConfirmDialog from "./ConfirmDialog";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { useAuth } from "../contexts/AuthContext"; // Importa o hook de autenticação

// Estilo do Modal
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
  maxHeight: "90vh",
  overflowY: "auto",
};

const BLANK_USER = {
  nome: "",
  email: "",
  login: "",
  password: "", // Senha só é obrigatória ao adicionar
  role: "Funcionario", // Papel padrão
};

const USER_ROLES = ["Admin", "Funcionario"];

function UserManagement() {
  const { currentUser } = useAuth(); // Pega o usuário logado atual
  const [users, setUsers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, name: "", isDeleting: false });

  const fetchUsers = async () => {
    // Idealmente, a API get-users deveria ser protegida no backend,
    // mas adicionamos uma camada extra de segurança no frontend também.
    if (currentUser?.role === "Admin") {
      const result = await window.api.getUsers();
      if (result.success) {
        // Filtra o próprio usuário admin da lista para evitar auto-exclusão/edição acidental
        setUsers(result.data.filter((user) => user.id !== currentUser.id));
      } else {
        console.error("Erro ao buscar usuários:", result.error);
        // Poderia mostrar um alerta na tela principal
      }
    }
  };

  // Busca usuários ao montar o componente e se o currentUser mudar (caso raro)
  useEffect(() => {
    fetchUsers();
  }, [currentUser]);

  const handleOpenAddModal = () => {
    setError("");
    setEditingUser(BLANK_USER);
    setModalKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (user) => {
    setError("");
    // --- CORREÇÃO: Inclui email e garante string vazia para nulos ---
    setEditingUser({
      ...user,
      email: user.email || "", // Garante que email não seja null
      password: "", // Limpa campo de senha ao editar
    });
    setModalKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setError("");
  };

  const handleDeleteRequest = (userId, userName) =>
    setConfirmDialog({ open: true, id: userId, name: userName, isDeleting: false });

  const handleDeleteConfirm = async () => {
    setConfirmDialog((d) => ({ ...d, isDeleting: true }));
    const result = await window.api.deleteUser(confirmDialog.id);
    setConfirmDialog({ open: false, id: null, name: "", isDeleting: false });
    if (result.success) fetchUsers();
    else setError(`Erro ao excluir usuário: ${result.error}`);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingUser((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError(""); // Limpa erro anterior
    const isEditing = !!editingUser?.id;

    if (!editingUser.nome || !editingUser.email || !editingUser.login || !editingUser.role) {
      setError("Nome, Email, Login e Papel são obrigatórios.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingUser.email)) {
      setError("Informe um email válido.");
      return;
    }
    if (!isEditing && !editingUser.password) {
      setError("Senha é obrigatória para novos usuários.");
      return;
    }
    if (!isEditing && editingUser.password.length < 6) {
      setError("A senha deve ter no mínimo 6 caracteres.");
      return;
    }

    const dataToSend = { ...editingUser };
    // Remove a senha se estiver editando e o campo senha estiver vazio
    if (isEditing && !dataToSend.password) {
      delete dataToSend.password; // O backend não tentará atualizar a senha
    }

    const apiCall = isEditing ? window.api.updateUser : window.api.addUser;
    setIsSaving(true);
    const result = await apiCall(dataToSend);
    setIsSaving(false);

    if (result.success) {
      handleCloseModal();
      fetchUsers();
    } else {
      setError(result.error || "Erro desconhecido ao salvar.");
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "nome", headerName: "Nome", flex: 1, minWidth: 200 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 200 },
    { field: "login", headerName: "Login", flex: 1, minWidth: 150 },
    { field: "role", headerName: "Papel", width: 130 },
    {
      field: "actions",
      headerName: "Ações",
      width: 100,
      sortable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => (
        <>
          <IconButton
            onClick={() => handleOpenEditModal(params.row)}
            title="Editar Usuário"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteRequest(params.row.id, params.row.nome)}
            title="Excluir Usuário"
          >
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

  // Segurança extra: Se por algum motivo este componente for renderizado
  // para um não-admin, não mostra nada. O controle principal deve estar no App.jsx.
  if (currentUser?.role !== "Admin") {
    return (
      <Typography color="error">
        Acesso negado. Apenas administradores podem gerenciar usuários.
      </Typography>
    );
  }

  return (
    <>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Typography variant="h4" gutterBottom sx={{ mb: 0 }}>
          Gerenciar Usuários
        </Typography>
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Novo Usuário
        </Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={users}
          columns={columns}
          getRowId={(row) => row.id}
          localeText={{ noRowsLabel: "Nenhum outro usuário encontrado." }}
        />
      </Box>

      {/* Modal para Adicionar/Editar Usuário */}
      {editingUser && (
        <Modal open={isModalOpen} onClose={handleCloseModal}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              {editingUser.id ? "Editar Usuário" : "Novo Usuário"}
            </Typography>

            {error && (
              <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
                {error}
              </Alert>
            )}

            <TextField
              name="nome"
              label="Nome Completo"
              value={editingUser.nome}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required
            />

            {/* --- NOVO CAMPO: Email --- */}
            <TextField
              name="email"
              label="Email"
              type="email"
              value={editingUser.email}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required
            />
            {/* --- FIM NOVO CAMPO --- */}
            <TextField
              name="login"
              label="Login de Acesso"
              value={editingUser.login}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required
            />
            <TextField
              name="password"
              label={
                editingUser.id
                  ? "Nova Senha (deixe em branco para manter)"
                  : "Senha"
              }
              type="password"
              value={editingUser.password}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required={!editingUser.id} // Obrigatório só se for novo
            />
            <FormControl fullWidth margin="normal" required>
              <InputLabel>Papel</InputLabel>
              <Select
                name="role"
                value={editingUser.role}
                label="Papel"
                onChange={handleInputChange}
              >
                {USER_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
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
        message={`Tem certeza que deseja excluir o usuário "${confirmDialog.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDialog({ open: false, id: null, name: "", isDeleting: false })}
        isLoading={confirmDialog.isDeleting}
      />
    </>
  );
}

export default UserManagement;
