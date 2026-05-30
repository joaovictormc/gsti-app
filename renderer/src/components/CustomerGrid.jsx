import { useState, useEffect } from "react";
import {
  Box, Button, Modal, IconButton, Snackbar, Alert,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Chip, Divider, CircularProgress, Grid, Paper,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import CustomerForm from "./CustomerForm";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import AssignmentIcon from "@mui/icons-material/Assignment";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ConfirmDialog from "./ConfirmDialog";

const formatPhone = (phone) => {
  if (!phone) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 11) return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (cleaned.length === 10) return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
};

const formatDocument = (doc) => {
  if (!doc) return "";
  const cleaned = String(doc).replace(/\D/g, "");
  if (cleaned.length === 11) return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cleaned.length === 14) return cleaned.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  return doc;
};

const formatCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatDateTime = (v) => {
  if (!v) return "—";
  return new Date(v).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const STATUS_COLORS = {
  "Orçamento": "default",
  "Em Aberto": "warning",
  "Aguardando Autorização": "secondary",
  "Aguardando Peça": "warning",
  "Em Andamento": "primary",
  "Finalizado": "success",
  "Entregue": "success",
  "Cancelado": "error",
};

const STATUS_BORDER = {
  "Orçamento": "#9e9e9e",
  "Em Aberto": "#f59e0b",
  "Aguardando Autorização": "#06b6d4",
  "Aguardando Peça": "#f59e0b",
  "Em Andamento": "#6366f1",
  "Finalizado": "#10b981",
  "Entregue": "#059669",
  "Cancelado": "#ef4444",
};

const modalStyle = {
  position: "absolute", top: "50%", left: "50%",
  transform: "translate(-50%, -50%)",
  width: { xs: "95vw", sm: 480 },
  bgcolor: "background.paper", boxShadow: 24, p: 4,
};

const BLANK_CUSTOMER = {
  nome: "", tipo_pessoa: "Física", cpf_cnpj: "", telefone: "", email: "",
  cep: "", logradouro: "", numero: "", bairro: "", cidade: "", estado: "",
};

function CustomerGrid() {
  const [customers, setCustomers] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, id: null, isDeleting: false });
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "error" });
  const [timeline, setTimeline] = useState({ open: false, customer: null, data: null, loading: false });

  const showSnackbar = (message, severity = "error") =>
    setSnackbar({ open: true, message, severity });

  const fetchCustomers = async () => {
    setIsLoading(true);
    const data = await window.api.getCustomers();
    setCustomers(data);
    setIsLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  const handleOpenAddModal = () => {
    setEditingCustomer(BLANK_CUSTOMER);
    setFormKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (customer) => {
    const sanitized = Object.fromEntries(
      Object.entries(customer).map(([k, v]) => [k, v === null ? "" : v])
    );
    // Retrocompatibilidade: se logradouro vazio mas endereco tem conteúdo, usa endereco como logradouro
    if (!sanitized.logradouro && sanitized.endereco) {
      sanitized.logradouro = sanitized.endereco;
    }
    setEditingCustomer(sanitized);
    setFormKey((k) => k + 1);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => { setIsModalOpen(false); setEditingCustomer(null); };

  const handleDeleteRequest = (id) => setConfirmDialog({ open: true, id, isDeleting: false });

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
    if (result.success) { handleCloseModal(); fetchCustomers(); }
    else showSnackbar(`Erro ao salvar cliente: ${result.error}`);
  };

  const handleOpenTimeline = async (customer) => {
    setTimeline({ open: true, customer, data: null, loading: true });
    const result = await window.api.getCustomerTimeline(customer.id);
    setTimeline((t) => ({ ...t, loading: false, data: result.success ? result : null }));
  };

  const columns = [
    { field: "id", headerName: "ID", width: 50 },
    { field: "nome", headerName: "Nome", flex: 1, minWidth: 150 },
    { field: "cpf_cnpj", headerName: "CPF/CNPJ", width: 160, renderCell: (p) => formatDocument(p.row.cpf_cnpj) },
    { field: "telefone", headerName: "Telefone", width: 140, renderCell: (p) => formatPhone(p.row.telefone) },
    { field: "email", headerName: "E-Mail", flex: 1, minWidth: 200 },
    {
      field: "endereco",
      headerName: "Endereço",
      flex: 1,
      minWidth: 200,
      renderCell: (p) => {
        const r = p.row;
        if (r.logradouro) {
          const parts = [
            r.logradouro,
            r.numero,
            r.bairro,
            r.cidade && r.estado ? `${r.cidade}/${r.estado}` : (r.cidade || r.estado),
          ].filter(Boolean);
          return parts.join(", ");
        }
        return r.endereco || "";
      },
    },
    {
      field: "actions", headerName: "Ações", width: 130, sortable: false,
      renderCell: (params) => (
        <>
          <IconButton onClick={() => handleOpenTimeline(params.row)} title="Histórico de OS" size="small">
            <HistoryIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleOpenEditModal(params.row)} title="Editar" size="small">
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton onClick={() => handleDeleteRequest(params.row.id)} color="error" title="Excluir" size="small">
            <DeleteIcon fontSize="small" />
          </IconButton>
        </>
      ),
    },
  ];

  const stats = timeline.data?.stats;

  return (
    <>
      <Box sx={{ mb: 2 }}>
        <Button variant="contained" onClick={handleOpenAddModal}>Adicionar Novo Cliente</Button>
      </Box>
      <Box sx={{ height: "calc(100vh - 240px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={customers} columns={columns} getRowId={(r) => r.id}
          loading={isLoading}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
        />
      </Box>

      {/* Modal edição/cadastro */}
      <Modal open={isModalOpen} onClose={handleCloseModal}>
        <Box sx={modalStyle}>
          {editingCustomer && (
            <CustomerForm
              key={formKey}
              initialData={editingCustomer}
              onSave={handleSave}
              onClose={handleCloseModal}
              onValidate={(cnpj) => window.api.validateCnpj(cnpj)}
            />
          )}
        </Box>
      </Modal>

      {/* Dialog Timeline */}
      <Dialog
        open={timeline.open}
        onClose={() => setTimeline((t) => ({ ...t, open: false }))}
        maxWidth="md" fullWidth
        PaperProps={{ sx: { maxHeight: "85vh" } }}
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <HistoryIcon color="primary" />
            <Typography variant="h6" component="span">
              Histórico — {timeline.customer?.nome}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent dividers>
          {timeline.loading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          ) : !timeline.data ? (
            <Typography color="error">Erro ao carregar histórico.</Typography>
          ) : (
            <>
              {/* Stat cards */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, borderLeft: 4, borderColor: "primary.main" }}>
                    <AssignmentIcon color="primary" />
                    <Box>
                      <Typography variant="h5" fontWeight={700} lineHeight={1}>{stats.total_os}</Typography>
                      <Typography variant="caption" color="text.secondary">Total de OS</Typography>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, borderLeft: 4, borderColor: "warning.main" }}>
                    <AssignmentIcon color="warning" />
                    <Box>
                      <Typography variant="h5" fontWeight={700} lineHeight={1}>{stats.os_abertas}</Typography>
                      <Typography variant="caption" color="text.secondary">Em aberto</Typography>
                    </Box>
                  </Paper>
                </Grid>
                <Grid item xs={12} sm={4}>
                  <Paper sx={{ p: 2, display: "flex", alignItems: "center", gap: 1.5, borderLeft: 4, borderColor: "success.main" }}>
                    <TrendingUpIcon color="success" />
                    <Box>
                      <Typography variant="h5" fontWeight={700} lineHeight={1}>{formatCurrency(stats.total_gasto)}</Typography>
                      <Typography variant="caption" color="text.secondary">Total gasto ({stats.os_finalizadas} finalizadas)</Typography>
                    </Box>
                  </Paper>
                </Grid>
              </Grid>

              <Divider sx={{ mb: 2 }} />

              {/* Lista de OS */}
              {timeline.data.os.length === 0 ? (
                <Typography color="text.secondary" align="center" sx={{ py: 3 }}>
                  Nenhuma OS encontrada para este cliente.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {timeline.data.os.map((os, i) => (
                    <Box key={os.id}>
                      <Box
                        sx={{
                          display: "flex", gap: 2, py: 1.5,
                          borderLeft: 3,
                          borderColor: STATUS_BORDER[os.status] || "#9e9e9e",
                          pl: 2,
                        }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap", mb: 0.5 }}>
                            <Typography variant="body2" fontWeight={700}>OS #{os.id}</Typography>
                            <Chip label={os.status} color={STATUS_COLORS[os.status] || "default"} size="small" variant="outlined" />
                            <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                              {formatDateTime(os.data_entrada)}
                            </Typography>
                          </Box>
                          <Typography variant="body2" noWrap>{os.equipamento || "—"}</Typography>
                          {os.defeito_relatado && (
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {os.defeito_relatado}
                            </Typography>
                          )}
                        </Box>
                        <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                          <Typography variant="body2" fontWeight={600}>
                            {formatCurrency(os.valor_total)}
                          </Typography>
                          {os.data_saida && (
                            <Typography variant="caption" color="text.secondary">
                              Saída: {formatDateTime(os.data_saida)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      {i < timeline.data.os.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setTimeline((t) => ({ ...t, open: false }))}>Fechar</Button>
        </DialogActions>
      </Dialog>

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
