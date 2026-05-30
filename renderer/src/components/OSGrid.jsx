import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Chip,
  Typography,
  Modal,
  TextField,
  IconButton,
  Snackbar,
  Alert,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import OSForm from "./OSForm";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ConfirmDialog from "./ConfirmDialog";

const STATUS_COLORS = {
  'Orçamento': 'default',
  'Em Aberto': 'warning',
  'Aguardando Autorização': 'secondary',
  'Aguardando Peça': 'warning',
  'Em Andamento': 'primary',
  'Finalizado': 'success',
  'Entregue': 'success',
  'Cancelado': 'error',
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 600,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
  maxHeight: "90vh",
  overflowY: "auto",
};

function OSGrid() {
  const [osList, setOSList] = useState([]);
  const [filteredOSList, setFilteredOSList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOS, setEditingOS] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [modalKey, setModalKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isDeleting: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });

  const showSnackbar = (message, severity = "error") =>
    setSnackbar({ open: true, message, severity });

  const fetchOSList = async () => {
    setIsLoading(true);
    const data = await window.api.getOSList();
    setOSList(data);
    setFilteredOSList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOSList();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (!term) {
      setFilteredOSList(osList);
    } else {
      const filteredData = osList.filter(
        (item) =>
          item.nome_cliente && item.nome_cliente.toLowerCase().includes(term)
      );
      setFilteredOSList(filteredData);
    }
  }, [searchTerm, osList]);

  const handleOpenAddModal = () => {
    setEditingOS(null);
    setModalKey((prevKey) => prevKey + 1); // Muda a chave
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (osId) => {
    const result = await window.api.getOSDetails(osId);
    if (result.success) {
      setEditingOS(result);
      setModalKey((prevKey) => prevKey + 1); // Muda a chave
      setIsModalOpen(true);
    } else {
      showSnackbar(`Erro ao buscar detalhes: ${result.error}`);
    }
  };

  const handleDeleteRequest = (osId) =>
    setConfirmDialog({ open: true, id: osId, isDeleting: false });

  const handleDeleteConfirm = async () => {
    setConfirmDialog((d) => ({ ...d, isDeleting: true }));
    const result = await window.api.deleteOS(confirmDialog.id);
    setConfirmDialog({ open: false, id: null, isDeleting: false });
    if (result.success) fetchOSList();
    else showSnackbar(`Erro ao excluir: ${result.error}`);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingOS(null);
  };

  const handleSaveOS = async (osData, items, total) => {
    const isEditing = !!osData.id;

    if (isEditing) {
      const osPromise = window.api.updateOS({ osData, total });
      const itemsPromise = window.api.updateOSItems({ osId: osData.id, items });
      const [osResult] = await Promise.all([osPromise, itemsPromise]);
      if (!osResult.success) showSnackbar(`Erro ao salvar OS: ${osResult.error}`);
    } else {
      const osResult = await window.api.addOS({ osData, total });
      if (osResult.success) {
        await window.api.addOSItems({ osId: osResult.osId, items });
      } else {
        showSnackbar(`Erro ao criar OS: ${osResult.error}`);
      }
    }
    handleCloseModal();
    fetchOSList();
  };

  // --- NOVA FUNÇÃO PARA IMPRIMIR ---
  const handlePrintReceipt = async (osId) => {
    const result = await window.api.generateEntryReceipt(osId);
    if (!result.success) {
      showSnackbar(`Erro ao gerar PDF: ${result.error}`);
    }
  };

  const handlePrintExitReceipt = async (osId) => {
    const result = await window.api.generateExitReceipt(osId);
    if (!result.success) {
      showSnackbar(`Erro ao gerar PDF de Saída: ${result.error}`);
    } else {
      // Opcional: Atualizar a lista caso a data de saída tenha sido definida agora
      fetchOSList();
    }
  };

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 200 },
    // --- COLUNA ATUALIZADA ---
    {
      field: "equipamento", // Usa o campo CONCAT do backend
      headerName: "Equipamento",
      flex: 1,
      minWidth: 250,
    },
    // --- FIM DA ATUALIZAÇÃO ---
    {
      field: "data_entrada",
      headerName: "Data de Entrada",
      width: 180,
      // --- CORREÇÃO DEFINITIVA DA FORMATAÇÃO DE DATA ---
      renderCell: (params) => {
        if (!params.value) return "";
        const date = new Date(params.value);
        if (isNaN(date.getTime())) return "Data Inválida";
        // Formato: DD/MM/AAAA, HH:MM
        return date.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 190,
      renderCell: (params) => (
        <Chip
          label={params.value}
          color={STATUS_COLORS[params.value] ?? 'default'}
          size="small"
          variant="outlined"
        />
      ),
    },
    {
      field: "valor_total",
      headerName: "Valor Total",
      width: 150,
      // --- CORREÇÃO DEFINITIVA DA FORMATAÇÃO DE VALOR ---
      renderCell: (params) => {
        const value = Number(params.value);
        if (params.value == null || isNaN(value)) return "R$ 0,00";
        return new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
        }).format(value);
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 200, // <-- Aumente a largura
      sortable: false,
      renderCell: (params) => (
        <>
          <IconButton
            onClick={() => handlePrintReceipt(params.row.id)}
            title="Imprimir Comprovante de Entrada"
          >
            <PrintIcon />
          </IconButton>
          {/* --- NOVO BOTÃO CONDICIONAL --- */}
          {["Finalizado", "Entregue"].includes(params.row.status) && (
            <IconButton
              onClick={() => handlePrintExitReceipt(params.row.id)}
              title="Imprimir Recibo de Saída/Garantia"
            >
              <ReceiptLongIcon />
            </IconButton>
          )}
          <IconButton
            onClick={() => handleOpenEditModal(params.row.id)}
            title="Editar OS"
          >
            <EditIcon />
          </IconButton>
          <IconButton
            onClick={() => handleDeleteRequest(params.row.id)}
            title="Excluir OS"
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
          Ordens de Serviço
        </Typography>
        <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
          <TextField
            size="small"
            variant="outlined"
            label="Buscar por Nome"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: 300 }}
          />
          <Button variant="contained" onClick={handleOpenAddModal}>
            Adicionar Nova OS
          </Button>
        </Box>
      </Box>
      <Box sx={{ height: 500, width: "100%", backgroundColor: "white" }}>
        <DataGrid
          rows={filteredOSList}
          columns={columns}
          getRowId={(row) => row.id}
          loading={isLoading}
          getRowLabel={(row) =>
            `${row.id} - ${row.nome_cliente} - ${row.equipamento}`
          }
          localeText={{ noRowsLabel: "Nenhuma Ordem de Serviço encontrada." }}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>
      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          <OSForm
            key={modalKey}
            initialData={editingOS}
            onSave={handleSaveOS}
            onClose={handleCloseModal}
          />
        </Box>
      </Modal>

      <ConfirmDialog
        open={confirmDialog.open}
        title="Confirmar Exclusão"
        message={`Tem certeza que deseja excluir a OS Nº ${confirmDialog.id}?`}
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

export default OSGrid;
