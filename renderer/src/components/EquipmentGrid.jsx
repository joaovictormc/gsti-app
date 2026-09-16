import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import HistoryIcon from "@mui/icons-material/History";
import ConfirmDialog from "./ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";
import { TIPOS_EQUIPAMENTO, tiposCom, descreverEquipamento } from "../constants/equipamentos";

const VAZIO = { id: null, cliente_id: null, tipo: "Notebook", marca: "", modelo: "", numero_serie: "", observacoes: "" };

const dataCurta = (v) => (v ? new Date(v).toLocaleDateString("pt-BR") : "—");
const moeda = (v) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0);

function EquipmentGrid() {
  const { permissoes } = useAuth();
  const [equipamentos, setEquipamentos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("Todos");
  const [edicao, setEdicao] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState("");
  const [historico, setHistorico] = useState(null);
  const [confirmar, setConfirmar] = useState({ open: false, id: null, isDeleting: false });
  const [aviso, setAviso] = useState({ open: false, message: "", severity: "error" });

  const avisar = (message, severity = "error") => setAviso({ open: true, message, severity });

  const carregar = async () => {
    setCarregando(true);
    const r = await window.api.getEquipments();
    if (r.success) setEquipamentos(r.data);
    else avisar(`Erro ao carregar equipamentos: ${r.error}`);
    setCarregando(false);
  };

  useEffect(() => {
    carregar();
    window.api.getActiveData().then((r) => r.success && setClientes(r.customers));
  }, []);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return equipamentos.filter((e) => {
      if (tipoFiltro !== "Todos" && e.tipo !== tipoFiltro) return false;
      if (!termo) return true;
      return [e.nome_cliente, e.tipo, e.marca, e.modelo, e.numero_serie].some((v) => String(v || "").toLowerCase().includes(termo));
    });
  }, [equipamentos, busca, tipoFiltro]);

  const abrirNovo = () => { setErroForm(""); setEdicao({ ...VAZIO }); };
  const abrirEdicao = (row) => {
    setErroForm("");
    setEdicao({
      id: row.id, cliente_id: row.cliente_id, tipo: row.tipo || "Outro", marca: row.marca || "",
      modelo: row.modelo || "", numero_serie: row.numero_serie || "", observacoes: row.observacoes || "",
    });
  };

  const salvar = async () => {
    if (!edicao.cliente_id) return setErroForm("Selecione o cliente.");
    if (!edicao.marca && !edicao.modelo && !edicao.numero_serie) {
      return setErroForm("Informe pelo menos a marca, o modelo ou o número de série.");
    }
    setSalvando(true);
    const r = edicao.id ? await window.api.updateEquipment(edicao) : await window.api.addEquipment(edicao);
    setSalvando(false);
    if (!r.success) return setErroForm(r.error);
    setEdicao(null);
    avisar("Equipamento salvo.", "success");
    carregar();
  };

  const abrirHistorico = async (row) => {
    setHistorico({ equipamento: row, itens: null });
    const r = await window.api.getEquipmentHistory(row.id);
    if (r.success) setHistorico({ equipamento: row, itens: r.data });
    else { setHistorico(null); avisar(r.error); }
  };

  const excluir = async () => {
    setConfirmar((c) => ({ ...c, isDeleting: true }));
    const r = await window.api.deleteEquipment(confirmar.id);
    setConfirmar({ open: false, id: null, isDeleting: false });
    if (r.success) { avisar("Equipamento excluído.", "success"); carregar(); }
    else avisar(r.error, "warning");
  };

  const colunas = [
    { field: "nome_cliente", headerName: "Cliente", flex: 1, minWidth: 180 },
    { field: "tipo", headerName: "Tipo", width: 120 },
    { field: "marca", headerName: "Marca", width: 130, renderCell: (p) => p.value || "—" },
    { field: "modelo", headerName: "Modelo", flex: 1, minWidth: 150, renderCell: (p) => p.value || "—" },
    { field: "numero_serie", headerName: "Nº de Série", width: 150, renderCell: (p) => p.value || "—" },
    {
      field: "total_os",
      headerName: "OS",
      width: 70,
      align: "center",
      headerAlign: "center",
    },
    { field: "ultima_os_em", headerName: "Última OS", width: 110, renderCell: (p) => dataCurta(p.value) },
    {
      field: "ultimo_status",
      headerName: "Situação",
      width: 170,
      renderCell: (p) => (p.value ? <Chip size="small" variant="outlined" label={p.value} /> : "—"),
    },
    {
      field: "acoes",
      headerName: "Ações",
      width: 130,
      sortable: false,
      renderCell: (p) => (
        <>
          <IconButton size="small" title="Histórico de OS" onClick={() => abrirHistorico(p.row)}><HistoryIcon fontSize="small" /></IconButton>
          {permissoes.editarCadastros && (
            <IconButton size="small" title="Editar" onClick={() => abrirEdicao(p.row)}><EditIcon fontSize="small" /></IconButton>
          )}
          {permissoes.podeExcluir && (
            <IconButton size="small" title="Excluir" color="error" onClick={() => setConfirmar({ open: true, id: p.row.id, isDeleting: false })}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          )}
        </>
      ),
    },
  ];

  const clienteSelecionado = edicao ? clientes.find((c) => c.id === edicao.cliente_id) || null : null;

  return (
    <>
      <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
        <Box>
          <Typography variant="h4" sx={{ mb: 0 }}>Equipamentos</Typography>
          <Typography variant="body2" color="text.secondary">
            Aparelhos de cada cliente. As OS novas são vinculadas automaticamente.
          </Typography>
        </Box>
        {permissoes.editarCadastros && (
          <Button variant="contained" onClick={abrirNovo}>Cadastrar equipamento</Button>
        )}
      </Box>

      <Paper sx={{ p: 1.5, mb: 2, display: "flex", gap: 1.5, alignItems: "center", flexWrap: "wrap" }}>
        <TextField
          size="small"
          label="Buscar por cliente, marca, modelo ou nº de série"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          sx={{ flex: 1, minWidth: 280 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment> }}
        />
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Tipo</InputLabel>
          <Select value={tipoFiltro} label="Tipo" onChange={(e) => setTipoFiltro(e.target.value)}>
            <MenuItem value="Todos">Todos</MenuItem>
            {TIPOS_EQUIPAMENTO.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </FormControl>
        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
          {filtrados.length} de {equipamentos.length} equipamentos
        </Typography>
      </Paper>

      <Box sx={{ height: "calc(var(--gsti-vh) - 290px)", minHeight: 320, width: "100%" }}>
        <DataGrid
          rows={filtrados}
          columns={colunas}
          loading={carregando}
          getRowId={(r) => r.id}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
          pageSizeOptions={[10, 25, 50]}
          localeText={{ noRowsLabel: busca || tipoFiltro !== "Todos" ? "Nenhum equipamento encontrado." : "Nenhum equipamento cadastrado." }}
        />
      </Box>

      {/* Cadastro / edição */}
      <Dialog open={!!edicao} onClose={() => !salvando && setEdicao(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{edicao?.id ? "Editar equipamento" : "Cadastrar equipamento"}</DialogTitle>
        {edicao && (
          <DialogContent>
            <Autocomplete
              options={clientes}
              value={clienteSelecionado}
              getOptionLabel={(o) => o?.nome || ""}
              isOptionEqualToValue={(o, v) => o.id === v.id}
              onChange={(_e, v) => setEdicao({ ...edicao, cliente_id: v ? v.id : null })}
              renderInput={(params) => <TextField {...params} label="Cliente" margin="normal" required />}
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Tipo</InputLabel>
                <Select value={edicao.tipo} label="Tipo" onChange={(e) => setEdicao({ ...edicao, tipo: e.target.value })}>
                  {tiposCom(edicao.tipo).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                </Select>
              </FormControl>
              <TextField label="Marca" value={edicao.marca} onChange={(e) => setEdicao({ ...edicao, marca: e.target.value })} fullWidth margin="normal" />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Modelo" value={edicao.modelo} onChange={(e) => setEdicao({ ...edicao, modelo: e.target.value })} fullWidth margin="normal" />
              <TextField label="Nº de Série" value={edicao.numero_serie} onChange={(e) => setEdicao({ ...edicao, numero_serie: e.target.value })} fullWidth margin="normal" />
            </Stack>
            <TextField
              label="Observações (senha, acessórios, características)"
              value={edicao.observacoes}
              onChange={(e) => setEdicao({ ...edicao, observacoes: e.target.value })}
              fullWidth
              margin="normal"
              multiline
              minRows={2}
            />
            {erroForm && <Alert severity="error" sx={{ mt: 1 }}>{erroForm}</Alert>}
          </DialogContent>
        )}
        <DialogActions>
          <Button onClick={() => setEdicao(null)} disabled={salvando}>Cancelar</Button>
          <Button variant="contained" onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Salvar"}</Button>
        </DialogActions>
      </Dialog>

      {/* Histórico */}
      <Dialog open={!!historico} onClose={() => setHistorico(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {historico && descreverEquipamento(historico.equipamento)}
          <Typography variant="body2" color="text.secondary">
            {historico?.equipamento.nome_cliente}
            {historico?.equipamento.numero_serie ? ` · Série ${historico.equipamento.numero_serie}` : ""}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {historico?.equipamento.observacoes && (
            <Alert severity="info" sx={{ mb: 2 }}>{historico.equipamento.observacoes}</Alert>
          )}
          {!historico?.itens ? (
            <Typography color="text.secondary">Carregando…</Typography>
          ) : historico.itens.length === 0 ? (
            <Typography color="text.secondary">Nenhuma OS vinculada a este equipamento.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>OS</TableCell>
                  <TableCell>Entrada</TableCell>
                  <TableCell>Defeito / Solução</TableCell>
                  <TableCell>Técnico</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Valor</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {historico.itens.map((os) => (
                  <TableRow key={os.id}>
                    <TableCell>{os.id}</TableCell>
                    <TableCell>{dataCurta(os.data_entrada)}</TableCell>
                    <TableCell sx={{ maxWidth: 300 }}>
                      <Typography variant="body2">{os.defeito_relatado || "—"}</Typography>
                      {os.solucao_aplicada && <Typography variant="caption" color="text.secondary">{os.solucao_aplicada}</Typography>}
                    </TableCell>
                    <TableCell>{os.nome_atendente || "—"}</TableCell>
                    <TableCell><Chip size="small" variant="outlined" label={os.status} /></TableCell>
                    <TableCell align="right">{moeda(os.valor_total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setHistorico(null)}>Fechar</Button></DialogActions>
      </Dialog>

      <ConfirmDialog
        open={confirmar.open}
        title="Excluir equipamento"
        message="Tem certeza? Só é possível excluir equipamentos sem OS no histórico."
        onConfirm={excluir}
        onCancel={() => setConfirmar({ open: false, id: null, isDeleting: false })}
        isLoading={confirmar.isDeleting}
      />

      <Snackbar open={aviso.open} autoHideDuration={4000} onClose={() => setAviso((a) => ({ ...a, open: false }))} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity={aviso.severity} onClose={() => setAviso((a) => ({ ...a, open: false }))}>{aviso.message}</Alert>
      </Snackbar>
    </>
  );
}

export default EquipmentGrid;
