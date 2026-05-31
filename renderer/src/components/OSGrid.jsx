import { useState, useEffect, useMemo } from "react";
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
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import OSForm from "./OSForm";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ConfirmDialog from "./ConfirmDialog";

const STATUS_LIST = [
  "Orçamento",
  "Aguardando Autorização",
  "Em Aberto",
  "Aguardando Peça",
  "Em Andamento",
  "Finalizado",
  "Entregue",
  "Cancelado",
];

const STATUS_COLORS = {
  Orçamento: "default",
  "Em Aberto": "warning",
  "Aguardando Autorização": "secondary",
  "Aguardando Peça": "warning",
  "Em Andamento": "primary",
  Finalizado: "success",
  Entregue: "success",
  Cancelado: "error",
};

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "95vw", sm: "90vw", md: 640 },
  bgcolor: "background.paper",
  boxShadow: 24,
  p: 4,
  maxHeight: "90vh",
  overflowY: "auto",
};

function OSGrid() {
  const [osList, setOSList] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingOS, setEditingOS] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
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
    setIsLoading(false);
  };

  useEffect(() => { fetchOSList(); }, []);

  // Filtro multi-campo client-side
  const filteredOSList = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return osList.filter((item) => {
      // Filtro de status
      if (statusFilter !== "Todos" && item.status !== statusFilter) return false;

      // Sem texto de busca: passa
      if (!term) return true;

      // OS Nº (ID exato ou parcial)
      if (String(item.id).includes(term)) return true;

      // Nome do cliente
      if (item.nome_cliente?.toLowerCase().includes(term)) return true;

      // Telefone: compara apenas dígitos quando o termo contém só números
      const termDigits = term.replace(/\D/g, "");
      if (termDigits.length >= 3) {
        const phoneDigits = String(item.telefone_cliente || "").replace(/\D/g, "");
        if (phoneDigits.includes(termDigits)) return true;
      }

      // Equipamento (tipo + marca + modelo já concatenados)
      if (item.equipamento?.toLowerCase().includes(term)) return true;

      // Nº de série
      if (item.numero_serie?.toLowerCase().includes(term)) return true;

      // Atendente
      if (item.nome_atendente?.toLowerCase().includes(term)) return true;

      return false;
    });
  }, [searchTerm, statusFilter, osList]);

  const handleOpenAddModal = () => {
    setEditingOS(null);
    setModalKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = async (osId) => {
    const result = await window.api.getOSDetails(osId);
    if (result.success) {
      setEditingOS(result);
      setModalKey((k) => k + 1);
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

  const handleCloseModal = () => { setIsModalOpen(false); setEditingOS(null); };

  const handleSaveOS = async (osData, items, total) => {
    const isEditing = !!osData.id;
    if (isEditing) {
      const [osResult] = await Promise.all([
        window.api.updateOS({ osData, total }),
        window.api.updateOSItems({ osId: osData.id, items }),
      ]);
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

  const handlePrintReceipt = async (osId) => {
    const result = await window.api.generateEntryReceipt(osId);
    if (!result.success) showSnackbar(`Erro ao gerar PDF: ${result.error}`);
  };

  const handlePrintExitReceipt = async (osId) => {
    const result = await window.api.generateExitReceipt(osId);
    if (!result.success) showSnackbar(`Erro ao gerar PDF de Saída: ${result.error}`);
    else fetchOSList();
  };

  const handleClearFilters = () => { setSearchTerm(""); setStatusFilter("Todos"); };

  const hasActiveFilters = searchTerm || statusFilter !== "Todos";

  const columns = [
    { field: "id", headerName: "OS Nº", width: 90 },
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 180 },
    { field: "nome_atendente", headerName: "Atendente", width: 140, renderCell: (p) => p.value || "—" },
    { field: "equipamento", headerName: "Equipamento", flex: 1, minWidth: 220 },
    {
      field: "data_entrada",
      headerName: "Data de Entrada",
      width: 165,
      renderCell: (p) => {
        if (!p.value) return "";
        const d = new Date(p.value);
        return isNaN(d) ? "Inválida" : d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
      },
    },
    {
      field: "status",
      headerName: "Status",
      width: 185,
      renderCell: (p) => (
        <Chip label={p.value} color={STATUS_COLORS[p.value] ?? "default"} size="small" variant="outlined" />
      ),
    },
    {
      field: "valor_total",
      headerName: "Valor Total",
      width: 130,
      renderCell: (p) => {
        const v = Number(p.value);
        return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(isNaN(v) ? 0 : v);
      },
    },
    {
      field: "actions",
      headerName: "Ações",
      width: 180,
      sortable: false,
      renderCell: (p) => (
        <>
          <IconButton onClick={() => handlePrintReceipt(p.row.id)} title="Comprovante de Entrada" size="small">
            <PrintIcon fontSize="small" />
          </IconButton>
          {["Finalizado", "Entregue"].includes(p.row.status) && (
            <IconButton onClick={() => handlePrintExitReceipt(p.row.id)} title="Recibo de Saída/Garantia" size="small">
              <ReceiptLongIcon fontSize="small" />
            </IconButton>
          )}
          <IconButton onClick={() => handleOpenEditModal(p.row.id)} title="Editar OS" size="small">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleDeleteRequest(p.row.id)} title="Excluir OS" color="error" size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  return (
    <>
      {/* Cabeçalho */}
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Typography variant="h4" sx={{ mb: 0 }}>Ordens de Serviço</Typography>
        <Button variant="contained" onClick={handleOpenAddModal}>Adicionar Nova OS</Button>
      </Box>

      {/* Painel de busca avançada */}
      <Paper sx={{ p: 1.5, mb: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Buscar por OS nº, cliente, telefone, equipamento ou série"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ flex: 1, minWidth: 280 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />

        <FormControl size="small" sx={{ minWidth: 185 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={(e) => setStatusFilter(e.target.value)}>
            <MenuItem value="Todos">Todos</MenuItem>
            {STATUS_LIST.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </Select>
        </FormControl>

        {hasActiveFilters && (
          <Button size="small" variant="outlined" onClick={handleClearFilters} sx={{ whiteSpace: "nowrap" }}>
            Limpar filtros
          </Button>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", whiteSpace: "nowrap" }}>
          {filteredOSList.length} de {osList.length} OS
        </Typography>
      </Paper>

      {/* Grid */}
      <Box sx={{ height: "calc(100vh - 290px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={filteredOSList}
          columns={columns}
          getRowId={(r) => r.id}
          loading={isLoading}
          localeText={{
            noRowsLabel: hasActiveFilters
              ? "Nenhuma OS encontrada para este filtro."
              : "Nenhuma Ordem de Serviço cadastrada.",
          }}
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
