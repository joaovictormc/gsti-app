import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import CodeIcon from "@mui/icons-material/Code";
import BlockIcon from "@mui/icons-material/Block";
import DeleteIcon from "@mui/icons-material/Delete";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import SyncIcon from "@mui/icons-material/Sync";
import { useAuth } from "../contexts/AuthContext";
import ConfirmDialog from "./ConfirmDialog";

// Notas fiscais de uma OS: lista, registro de nota emitida por fora, cancelamento e anexos.

const hoje = () => new Date().toISOString().slice(0, 10);
const moeda = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Situação da nota -> rótulo e cor
const SITUACOES = {
  emitida: { rotulo: "Emitida", cor: "success", variante: "filled" },
  processando: { rotulo: "Processando", cor: "info", variante: "outlined" },
  cancelando: { rotulo: "Cancelando", cor: "warning", variante: "outlined" },
  cancelada: { rotulo: "Cancelada", cor: "default", variante: "outlined" },
  erro: { rotulo: "Rejeitada", cor: "error", variante: "outlined" },
};
const EMISSORES_ROTULO = { manual: "Registro manual", notaas: "Notaas" };
const emAndamento = (n) => ["processando", "cancelando"].includes(n.status);

const novaNota = (os) => ({
  tipo: "NFS-e",
  numero: "",
  serie: "",
  dataEmissao: hoje(),
  valor: os ? String(Number(os.valor_total || 0).toFixed(2)).replace(".", ",") : "",
  chaveAcesso: "",
  observacao: "",
  pdf: null,
  xml: null,
});

export default function NotasFiscaisOS({ os, onClose, onAlterado }) {
  const { permissoes } = useAuth();
  const [notas, setNotas] = useState([]);
  const [status, setStatus] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState({ tipo: "", texto: "" });
  const [cancelando, setCancelando] = useState(null); // { id, motivo }
  const [excluindo, setExcluindo] = useState(null);
  const [emissao, setEmissao] = useState(null); // { carregando, emissor, sugestao, pendencias, descricao, valor }
  const [atualizando, setAtualizando] = useState(null);

  const podeRegistrar = !!permissoes.emitirNotaFiscal;
  const finalizada = ["Finalizado", "Entregue"].includes(os?.status);

  const carregar = useCallback(async () => {
    if (!os) return [];
    setCarregando(true);
    const [r, s] = await Promise.all([window.api.getOSNotas(os.id), window.api.getFiscalStatus()]);
    if (r.success) setNotas(r.data);
    else setMensagem({ tipo: "error", texto: r.error });
    if (s.success) setStatus(s);
    setCarregando(false);
    return r.success ? r.data : [];
  }, [os]);

  // Consulta o emissor para notas em processamento/cancelamento
  const atualizarSituacao = useCallback(async (id, silencioso = false) => {
    setAtualizando(id);
    const r = await window.api.atualizarNota(id);
    setAtualizando(null);
    if (!r.success && !silencioso) setMensagem({ tipo: "error", texto: r.error });
    return r;
  }, []);

  useEffect(() => {
    setForm(null);
    setEmissao(null);
    setMensagem({ tipo: "", texto: "" });
    (async () => {
      const lista = await carregar();
      const pendentes = lista.filter(emAndamento);
      if (pendentes.length) {
        for (const n of pendentes) await atualizarSituacao(n.id, true);
        await carregar();
        onAlterado?.();
      }
    })();
  }, [carregar, atualizarSituacao]); // eslint-disable-line react-hooks/exhaustive-deps

  const emiteNFSeIntegrada = status?.emiteIntegrado?.includes("NFS-e");
  const temNFSeAtiva = notas.some((n) => n.origem !== "manual" && ["processando", "emitida", "cancelando"].includes(n.status));

  const abrirEmissao = async () => {
    setMensagem({ tipo: "", texto: "" });
    setEmissao({ carregando: true });
    const r = await window.api.prepararNFSeIntegrada(os.id);
    if (!r.success) {
      setEmissao(null);
      setMensagem({ tipo: "error", texto: r.error });
      return;
    }
    setEmissao({
      carregando: false,
      emissor: r.emissor,
      sugestao: r.sugestao,
      pendencias: r.pendencias,
      descricao: r.sugestao.descricao,
      valor: String(r.sugestao.valor.toFixed(2)).replace(".", ","),
    });
  };

  const emitir = async () => {
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    const r = await window.api.emitirNFSeIntegrada({ osId: os.id, descricao: emissao.descricao, valor: emissao.valor });
    setSalvando(false);
    if (r.success) {
      setEmissao(null);
      setMensagem(
        r.status === "emitida"
          ? { tipo: "success", texto: "NFS-e emitida." }
          : r.status === "erro"
            ? { tipo: "error", texto: `A NFS-e foi rejeitada: ${r.mensagemErro || "veja o motivo na lista"}` }
            : { tipo: "info", texto: "NFS-e enviada e em processamento. A situação é atualizada ao abrir esta janela ou pelo botão de atualizar." }
      );
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
    await carregar();
    onAlterado?.();
  };

  const anexar = async (tipo) => {
    const r = await window.api.selectNotaArquivo(tipo);
    if (r.success) setForm((f) => ({ ...f, [tipo]: r }));
  };

  const registrar = async () => {
    setSalvando(true);
    setMensagem({ tipo: "", texto: "" });
    const r = await window.api.addNotaManual({
      osId: os.id,
      tipo: form.tipo,
      numero: form.numero,
      serie: form.serie,
      dataEmissao: form.dataEmissao,
      valor: form.valor,
      chaveAcesso: form.chaveAcesso,
      observacao: form.observacao,
      pdfArquivo: form.pdf?.arquivo,
      xmlArquivo: form.xml?.arquivo,
    });
    setSalvando(false);
    if (r.success) {
      setForm(null);
      setMensagem({ tipo: "success", texto: "Nota registrada na OS." });
      await carregar();
      onAlterado?.();
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
  };

  const confirmarCancelamento = async () => {
    const r = await window.api.cancelarNota({ id: cancelando.id, motivo: cancelando.motivo });
    if (r.success) {
      const integrada = cancelando.integrada;
      setCancelando(null);
      setMensagem(
        !integrada
          ? { tipo: "success", texto: "Nota marcada como cancelada. Lembre-se de cancelá-la também onde foi emitida." }
          : r.status === "cancelada"
            ? { tipo: "success", texto: "NFS-e cancelada no emissor." }
            : { tipo: "info", texto: "Cancelamento solicitado ao emissor. A situação é atualizada ao abrir esta janela." }
      );
      await carregar();
      onAlterado?.();
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
  };

  const confirmarExclusao = async () => {
    const r = await window.api.deleteNota(excluindo);
    setExcluindo(null);
    if (r.success) {
      await carregar();
      onAlterado?.();
    } else {
      setMensagem({ tipo: "error", texto: r.error });
    }
  };

  const abrirArquivo = async (id, tipo) => {
    const r = await window.api.openNotaArquivo({ id, tipo });
    if (!r.success) setMensagem({ tipo: "error", texto: r.error });
  };

  const campo = (chave) => ({
    value: form?.[chave] ?? "",
    onChange: (e) => setForm((f) => ({ ...f, [chave]: e.target.value })),
    size: "small",
    fullWidth: true,
    disabled: salvando,
  });

  return (
    <Dialog open={!!os} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Notas fiscais — OS nº {os?.id}
        <Typography variant="body2" color="text.secondary">{os?.nome_cliente}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {mensagem.texto && (
          <Alert severity={mensagem.tipo || "info"} sx={{ mb: 2 }} onClose={() => setMensagem({ tipo: "", texto: "" })}>
            {mensagem.texto}
          </Alert>
        )}

        {status && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {status.integradoAtivo ? (
              <>
                Emissor configurado: <strong>{status.emissor.nome}</strong>. Emita a NFS-e direto por aqui; notas de
                produto (NF-e/NFC-e) continuam pelo registro manual.
              </>
            ) : (
              <>
                Registre aqui a nota emitida por fora (portal da prefeitura, Emissor Nacional, Emissor Sebrae ou pelo
                contador). A emissão direto pelo app com emissor integrado fica em Configurações &gt; Nota fiscal
                (plano Anual com renovação automática).
              </>
            )}
          </Alert>
        )}

        {carregando ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>
        ) : notas.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>Nenhuma nota registrada nesta OS.</Typography>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Tipo</TableCell>
                  <TableCell>Número</TableCell>
                  <TableCell>Emissão</TableCell>
                  <TableCell align="right">Valor</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell align="right">Arquivos / ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {notas.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell>{n.tipo}</TableCell>
                    <TableCell>
                      {n.numero || "—"}{n.serie ? ` / série ${n.serie}` : ""}
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {EMISSORES_ROTULO[n.origem] || n.origem}{n.usuario ? ` · ${n.usuario}` : ""}
                      </Typography>
                    </TableCell>
                    <TableCell>{new Date(n.data_emissao).toLocaleDateString("pt-BR", { timeZone: "UTC" })}</TableCell>
                    <TableCell align="right">{moeda(n.valor)}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={(SITUACOES[n.status] || SITUACOES.emitida).rotulo}
                        color={(SITUACOES[n.status] || SITUACOES.emitida).cor}
                        variant={(SITUACOES[n.status] || SITUACOES.emitida).variante}
                      />
                      {n.status === "erro" && n.mensagem_erro && (
                        <Typography variant="caption" color="error" sx={{ display: "block", maxWidth: 260 }}>
                          {n.mensagem_erro}
                        </Typography>
                      )}
                      {n.motivo_cancelamento && (
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                          {n.motivo_cancelamento}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      {n.tem_pdf && (
                        <IconButton size="small" title="Abrir PDF" onClick={() => abrirArquivo(n.id, "pdf")}>
                          <PictureAsPdfIcon fontSize="small" />
                        </IconButton>
                      )}
                      {n.tem_xml && (
                        <IconButton size="small" title="Abrir XML" onClick={() => abrirArquivo(n.id, "xml")}>
                          <CodeIcon fontSize="small" />
                        </IconButton>
                      )}
                      {n.origem !== "manual" && (emAndamento(n) || (n.status === "emitida" && (!n.tem_pdf || !n.tem_xml))) && (
                        <IconButton
                          size="small"
                          title="Atualizar situação no emissor"
                          disabled={atualizando === n.id}
                          onClick={async () => { await atualizarSituacao(n.id); await carregar(); onAlterado?.(); }}
                        >
                          {atualizando === n.id ? <CircularProgress size={16} /> : <SyncIcon fontSize="small" />}
                        </IconButton>
                      )}
                      {podeRegistrar && (n.origem === "manual" ? n.status !== "cancelada" : n.status === "emitida") && (
                        <IconButton
                          size="small"
                          title={n.origem === "manual" ? "Marcar como cancelada" : "Cancelar NFS-e no emissor"}
                          onClick={() => setCancelando({ id: n.id, motivo: "", integrada: n.origem !== "manual" })}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      )}
                      {podeRegistrar && permissoes.podeExcluir && (n.origem === "manual" || n.status === "erro") && (
                        <IconButton size="small" color="error" title="Excluir registro" onClick={() => setExcluindo(n.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}

        {cancelando && (
          <Box sx={{ mt: 2, p: 2, border: 1, borderColor: "divider", borderRadius: 2 }}>
            <Typography variant="body2" sx={{ mb: 1 }}>
              {cancelando.integrada
                ? "A NFS-e será cancelada no emissor (com valor fiscal, se o projeto estiver em Produção). Confira o prazo de cancelamento do seu município."
                : "Marcar a nota como cancelada no GSTI App. O cancelamento fiscal deve ser feito onde a nota foi emitida."}
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                size="small"
                fullWidth
                label="Motivo do cancelamento"
                value={cancelando.motivo}
                onChange={(e) => setCancelando((c) => ({ ...c, motivo: e.target.value }))}
                inputProps={{ maxLength: 255 }}
              />
              <Button onClick={() => setCancelando(null)}>Voltar</Button>
              <Button variant="contained" color="warning" onClick={confirmarCancelamento} disabled={cancelando.motivo.trim().length < 5}>
                {cancelando.integrada ? "Cancelar NFS-e" : "Marcar cancelada"}
              </Button>
            </Stack>
          </Box>
        )}

        {emissao && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>
              Emitir NFS-e {emissao.emissor ? `pela ${emissao.emissor.nome}` : ""}
            </Typography>
            {emissao.carregando ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={28} /></Box>
            ) : (
              <>
                {emissao.pendencias.length > 0 && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Antes de emitir:
                    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
                      {emissao.pendencias.map((p) => <li key={p}>{p}</li>)}
                    </Box>
                  </Alert>
                )}
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Typography variant="body2" color="text.secondary">Tomador (cliente)</Typography>
                    <Typography variant="body2">
                      {emissao.sugestao.tomador.nome} · {emissao.sugestao.tomador.documento || "sem CPF/CNPJ"}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="body2" color="text.secondary">Cód. tributação</Typography>
                    <Typography variant="body2">{emissao.sugestao.codigoTributacao || "—"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6, sm: 2 }}>
                    <Typography variant="body2" color="text.secondary">ISS</Typography>
                    <Typography variant="body2">{emissao.sugestao.aliquotaIss != null ? `${emissao.sugestao.aliquotaIss}%` : "—"}</Typography>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Descrição do serviço"
                      multiline
                      minRows={3}
                      fullWidth
                      size="small"
                      value={emissao.descricao}
                      onChange={(e) => setEmissao((x) => ({ ...x, descricao: e.target.value }))}
                      disabled={salvando}
                      inputProps={{ maxLength: 2000 }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Valor do serviço (R$)"
                      fullWidth
                      size="small"
                      value={emissao.valor}
                      onChange={(e) => setEmissao((x) => ({ ...x, valor: e.target.value }))}
                      disabled={salvando}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <Alert severity="warning" sx={{ py: 0 }}>
                      Se o projeto na {emissao.emissor?.nome || "plataforma"} estiver em Produção, a nota terá valor fiscal.
                    </Alert>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}

        {podeRegistrar && finalizada && form && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1.5 }}>Registrar nota emitida por fora</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Tipo</InputLabel>
                  <Select label="Tipo" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} disabled={salvando}>
                    {(status?.tiposNota || ["NFS-e", "NF-e", "NFC-e"]).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 8, sm: 3 }}><TextField label="Número" required {...campo("numero")} /></Grid>
              <Grid size={{ xs: 4, sm: 2 }}><TextField label="Série" {...campo("serie")} /></Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField label="Data de emissão" type="date" InputLabelProps={{ shrink: true }} {...campo("dataEmissao")} />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}><TextField label="Valor (R$)" {...campo("valor")} /></Grid>
              <Grid size={{ xs: 12, sm: 8 }}><TextField label="Chave de acesso (opcional)" {...campo("chaveAcesso")} helperText="44 dígitos (NF-e/NFC-e) ou 50 (NFS-e Nacional)" /></Grid>
              <Grid size={{ xs: 12 }}><TextField label="Observação" {...campo("observacao")} /></Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => anexar("pdf")} disabled={salvando}>
                    {form.pdf ? `PDF: ${form.pdf.nome}` : "Anexar PDF"}
                  </Button>
                  <Button variant="outlined" startIcon={<AttachFileIcon />} onClick={() => anexar("xml")} disabled={salvando}>
                    {form.xml ? `XML: ${form.xml.nome}` : "Anexar XML"}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary">
                  Os anexos ficam salvos no banco de dados e podem ser abertos em qualquer computador.
                </Typography>
              </Grid>
            </Grid>
          </>
        )}
        {!finalizada && (
          <Alert severity="warning" sx={{ mt: 2 }}>Finalize a OS para registrar a nota fiscal.</Alert>
        )}
      </DialogContent>
      <DialogActions>
        {podeRegistrar && finalizada && !form && !emissao && emiteNFSeIntegrada && (
          <Button
            variant="contained"
            color="secondary"
            onClick={abrirEmissao}
            disabled={temNFSeAtiva}
            title={temNFSeAtiva ? "Esta OS já tem NFS-e emitida ou em processamento" : undefined}
          >
            Emitir NFS-e ({status.emissor.nome})
          </Button>
        )}
        {podeRegistrar && finalizada && !form && !emissao && (
          <Button variant={emiteNFSeIntegrada ? "outlined" : "contained"} onClick={() => setForm(novaNota(os))}>
            Registrar nota emitida por fora
          </Button>
        )}
        {emissao && !emissao.carregando && (
          <>
            <Button onClick={() => setEmissao(null)} disabled={salvando}>Voltar</Button>
            <Button variant="contained" color="secondary" onClick={emitir} disabled={salvando || emissao.pendencias.length > 0}>
              {salvando ? "Emitindo…" : "Emitir NFS-e"}
            </Button>
          </>
        )}
        {form && (
          <>
            <Button onClick={() => setForm(null)} disabled={salvando}>Cancelar</Button>
            <Button variant="contained" onClick={registrar} disabled={salvando || !form.numero.trim()}>
              {salvando ? "Salvando…" : "Salvar nota"}
            </Button>
          </>
        )}
        {!form && !emissao && <Button onClick={onClose}>Fechar</Button>}
      </DialogActions>

      <ConfirmDialog
        open={!!excluindo}
        title="Excluir registro da nota"
        message="O registro e os anexos serão apagados do GSTI App. Isso não cancela a nota onde ela foi emitida."
        onConfirm={confirmarExclusao}
        onCancel={() => setExcluindo(null)}
      />
    </Dialog>
  );
}
