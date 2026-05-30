import { useState, useEffect } from "react";
import ConfirmDialog from "./ConfirmDialog";
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
  InputAdornment,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";

// Estilo do Modal (pode ser o mesmo dos outros)
const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 500,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
  maxHeight: "90vh",
  overflowY: "auto",
};

// Formato de data YYYY-MM-DD para o input type="date"
const toInputDateString = (date) => {
  if (!date) return "";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  // Adiciona 1 dia porque o input date considera meia-noite UTC
  // d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
};

const BLANK_EXPENSE = {
  descricao: "",
  data: toInputDateString(new Date()), // Data atual como padrão
  categoria: "Outros", // Categoria padrão
  tipo_despesa: "Variável",
  km_rodados: "",
  preco_litro: "",
  consumo_medio: "10.0", // Consumo padrão (ex: 10 km/l) - Ajuste para o seu veículo
  valor: "",
};

// Lista de Categorias
const CATEGORIES = [
  "Peças",
  "Ferramentas",
  "Combustível",
  "Alimentação",
  "Transporte App",
  "Outros",
];

const EXPENSE_TYPES = ["Variável", "Fixa"]; // Opções para o novo campo

function ExpensesGrid() {
  const [expenses, setExpenses] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [modalKey, setModalKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isDeleting: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });

  const showSnackbar = (message, severity = "error") =>
    setSnackbar({ open: true, message, severity });

  const fetchExpenses = async () => {
    setIsLoading(true);
    const data = await window.api.getExpenses();
    setExpenses(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchExpenses();
  }, []);

  const handleOpenAddModal = () => {
    setEditingExpense(BLANK_EXPENSE);
    setModalKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (expense) => {
    const expenseToEdit = {
      ...expense,
      data: toInputDateString(expense.data),
      // Garante que tipo_despesa tenha um valor válido ao editar
      tipo_despesa: expense.tipo_despesa || "Variável",
      km_rodados: expense.km_rodados !== null ? String(expense.km_rodados) : "",
      preco_litro:
        expense.preco_litro !== null ? String(expense.preco_litro) : "",
      consumo_medio:
        expense.consumo_medio !== null ? String(expense.consumo_medio) : "10.0",
      valor: String(expense.valor),
    };
    setEditingExpense(expenseToEdit);
    setModalKey((prev) => prev + 1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingExpense(null);
  };

  const handleDeleteRequest = (id) =>
    setConfirmDialog({ open: true, id, isDeleting: false });

  const handleDeleteConfirm = async () => {
    setConfirmDialog((d) => ({ ...d, isDeleting: true }));
    const result = await window.api.deleteExpense(confirmDialog.id);
    setConfirmDialog({ open: false, id: null, isDeleting: false });
    if (result.success) fetchExpenses();
    else showSnackbar(`Erro ao excluir despesa: ${result.error}`);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditingExpense((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (
      !editingExpense.descricao ||
      !editingExpense.data ||
      !editingExpense.tipo_despesa
    ) {
      showSnackbar("Descrição, Data e Tipo (Fixa/Variável) são obrigatórios.");
      return;
    }

    if (editingExpense.categoria !== "Combustível" && !editingExpense.valor) {
      showSnackbar("O campo Valor é obrigatório para esta categoria.");
      return;
    }
    // Se for combustível, os campos específicos são obrigatórios
    if (
      editingExpense.categoria === "Combustível" &&
      (!editingExpense.km_rodados ||
        !editingExpense.preco_litro ||
        !editingExpense.consumo_medio)
    ) {
      /* ... */
    }

    const dataToSend = { ...editingExpense };
    const apiCall = dataToSend.id ? window.api.updateExpense : window.api.addExpense;
    setIsSaving(true);
    const result = await apiCall(dataToSend);
    setIsSaving(false);

    if (result.success) {
      handleCloseModal();
      fetchExpenses();
    } else {
      showSnackbar(`Erro ao salvar despesa: ${result.error}`);
    }
  };

  const columns = [
    { field: "id", headerName: "ID", width: 70 },
    { field: "descricao", headerName: "Descrição", flex: 1, minWidth: 250 },
    { field: "categoria", headerName: "Categoria", width: 150 },
    { field: "tipo_despesa", headerName: "Tipo", width: 100 }, // <-- Nova coluna
    {
      field: "data",
      headerName: "Data",
      width: 120,
      renderCell: (params) => {
        if (!params.value) return "";
        // Adiciona 1 dia para compensar fuso horário do input date
        const date = new Date(params.value);
        date.setDate(date.getDate() + 1);
        return date.toLocaleDateString("pt-BR");
      },
    },
    {
      field: "valor",
      headerName: "Valor (R$)",
      width: 150,
      align: "right",
      headerAlign: "right",
      renderCell: (params) => {
        const value = Number(params.value);
        if (isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      },
    },
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
            title="Editar Despesa"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteRequest(params.row.id)}
            title="Excluir Despesa"
            color="error"
          >
            <DeleteIcon />
          </IconButton>
        </>
      ),
    },
  ];

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
          Gestão de Despesas
        </Typography>
        <Button variant="contained" onClick={handleOpenAddModal}>
          Adicionar Nova Despesa
        </Button>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={expenses}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          localeText={{ noRowsLabel: "Nenhuma despesa encontrada." }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>

      {/* Modal para Adicionar/Editar Despesa */}
      {editingExpense && (
        <Modal open={isModalOpen} onClose={handleCloseModal}>
          <Box sx={modalStyle}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              {editingExpense.id ? "Editar Despesa" : "Nova Despesa"}
            </Typography>

            <TextField
              name="descricao"
              label="Descrição"
              value={editingExpense.descricao}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                name="data"
                label="Data"
                type="date"
                value={editingExpense.data}
                onChange={handleInputChange}
                fullWidth
                margin="normal"
                required
                InputLabelProps={{ shrink: true }}
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Categoria</InputLabel>
                <Select
                  name="categoria"
                  value={editingExpense.categoria}
                  label="Categoria"
                  onChange={handleInputChange}
                >
                  {CATEGORIES.map((cat) => (
                    <MenuItem key={cat} value={cat}>
                      {cat}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* --- NOVO CAMPO: Tipo de Despesa --- */}
              <FormControl fullWidth margin="normal" required>
                <InputLabel>Tipo</InputLabel>
                <Select
                  name="tipo_despesa"
                  value={editingExpense.tipo_despesa}
                  label="Tipo"
                  onChange={handleInputChange}
                >
                  {EXPENSE_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {/* --- FIM DO NOVO CAMPO --- */}
            </Box>

            {/* Campos Condicionais para Combustível */}
            {editingExpense.categoria === "Combustível" && (
              <Box
                sx={{ border: "1px dashed grey", p: 2, mt: 2, borderRadius: 1 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Detalhes do Combustível
                </Typography>
                <Box sx={{ display: "flex", gap: 2 }}>
                  <TextField
                    name="km_rodados"
                    label="Km Rodados"
                    type="number"
                    value={editingExpense.km_rodados}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                    InputProps={{ inputProps: { step: "0.1", min: 0 } }}
                  />
                  <TextField
                    name="preco_litro"
                    label="Preço Litro (R$)"
                    type="number"
                    value={editingExpense.preco_litro}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                    InputProps={{ inputProps: { step: "0.01", min: 0 } }}
                  />
                  <TextField
                    name="consumo_medio"
                    label="Consumo (Km/L)"
                    type="number"
                    value={editingExpense.consumo_medio}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                    InputProps={{ inputProps: { step: "0.1", min: 1 } }}
                  />
                </Box>
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  O valor será calculado: (Km Rodados / Consumo) * Preço Litro
                </Typography>
              </Box>
            )}

            {/* Campo Valor (Desabilitado para Combustível) */}
            <TextField
              name="valor"
              label="Valor (R$)"
              type="number"
              value={editingExpense.valor}
              onChange={handleInputChange}
              fullWidth
              margin="normal"
              required={editingExpense.categoria !== "Combustível"}
              disabled={editingExpense.categoria === "Combustível"}
              InputProps={{
                inputProps: { step: "0.01", min: 0 },
                startAdornment:
                  editingExpense.categoria === "Combustível" ? (
                    <InputAdornment position="start">Calculado:</InputAdornment>
                  ) : null,
              }}
              helperText={
                editingExpense.categoria === "Combustível"
                  ? "Calculado automaticamente"
                  : ""
              }
            />

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
        message="Tem certeza que deseja excluir esta despesa?"
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

export default ExpensesGrid;
