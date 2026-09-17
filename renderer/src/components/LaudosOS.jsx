import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import DeleteIcon from "@mui/icons-material/Delete";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import WifiTetheringIcon from "@mui/icons-material/WifiTethering";
import CompareArrowsIcon from "@mui/icons-material/CompareArrows";
import DownloadIcon from "@mui/icons-material/Download";
import ConfirmDialog from "./ConfirmDialog";
import { useAuth } from "../contexts/AuthContext";

const SITUACAO = { ok: ["Sem problemas", "success"], atencao: ["Atenção", "warning"], critico: ["Crítico", "error"] };
const MOMENTO = { entrada: "Entrada", saida: "Saída" };
const dataHora = (iso) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

// Recebimento pela rede: código grande, endereços e aguardo do agente
function PainelRecebimento({ info, onParar }) {
  const [restante, setRestante] = useState("");
  useEffect(() => {
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((new Date(info.expiraEm) - Date.now()) / 1000));
      setRestante(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, [info.expiraEm]);
  return (
    <Paper variant="outlined" sx={{ p: 2.5, mb: 2, borderColor: "primary.main", bgcolor: "action.hover" }}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems={{ sm: "center" }}>
        <Box sx={{ textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary">Código para o agente</Typography>
          <Typography sx={{ fontFamily: "Consolas, monospace", fontSize: 40, fontWeight: 700, letterSpacing: "0.2em", lineHeight: 1.1 }}>{info.codigo}</Typography>
        </Box>
        <Box sx={{ flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
            <CircularProgress size={16} />
            <Typography fontWeight={600}>Aguardando o laudo… (expira em {restante})</Typography>
          </Stack>
          <Typography variant="body2" color="text.secondary">
            No computador em reparo, abra o <strong>GSTI Diagnóstico</strong>, clique em <strong>Enviar para o GSTI App</strong>,
            escolha esta loja e digite o código. Se a loja não aparecer, use o endereço:{" "}
            <strong>{info.enderecos.map((e) => `${e}:${info.porta}`).join(" ou ")}</strong>.
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
            Os dois computadores precisam estar na mesma rede. Se o Windows perguntar, permita o GSTI App no firewall (rede privada).
          </Typography>
        </Box>
        <Button onClick={onParar}>Parar</Button>
      </Stack>
    </Paper>
  );
}

export default function LaudosOS({ os, onClose, onAlterado }) {
  const { permissoes } = useAuth();
  const [laudos, setLaudos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [mensagem, setMensagem] = useState(null);
  const [recebendo, setRecebendo] = useState(null);
  const [excluindo, setExcluindo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [par, setPar] = useState({ entrada: "", saida: "" });

  const carregar = useCallback(async () => {
    if (!os) return;
    setCarregando(true);
    const r = await window.api.getOSLaudos(os.id);
    if (r.success) setLaudos(r.data);
    else setMensagem({ tipo: "error", texto: r.error });
    setCarregando(false);
  }, [os]);

  useEffect(() => {
    setMensagem(null);
    setRecebendo(null);
    carregar();
  }, [carregar]);

  // Laudo chegou pela rede (ou o recebimento terminou)
  useEffect(() => {
    if (!os) return undefined;
    return window.api.onLaudoRecebido((ev) => {
      if (ev.osId !== os.id) return;
      if (ev.encerrado) {
        setRecebendo(null);
        if (ev.encerrado === "tentativas") setMensagem({ tipo: "warning", texto: "Recebimento encerrado: código digitado errado 5 vezes." });
        if (ev.encerrado === "expirado") setMensagem({ tipo: "info", texto: "Recebimento encerrado por tempo. Clique em Receber pela rede para gerar outro código." });
        return;
      }
      if (ev.success) {
        setMensagem({ tipo: ev.avisos?.length ? "warning" : "success", texto: ["Laudo recebido pela rede e anexado à OS.", ...(ev.avisos || [])].join(" ") });
        carregar();
        onAlterado?.();
      } else if (ev.duplicado) {
        setMensagem({ tipo: "info", texto: ev.error });
      }
    });
  }, [os, carregar, onAlterado]);

  // Para o recebimento ao fechar
  const fechar = () => {
    if (recebendo) window.api.stopLaudoReceiver();
    onClose();
  };

  // Sugestão do comparativo: primeira entrada e última saída
  const entradas = laudos.filter((l) => l.momento === "entrada");
  const saidas = laudos.filter((l) => l.momento === "saida");
  useEffect(() => {
    setPar({ entrada: entradas[0]?.id ?? "", saida: saidas[saidas.length - 1]?.id ?? "" });
  }, [laudos]); // eslint-disable-line react-hooks/exhaustive-deps
  const podeComparar = useMemo(() => par.entrada && par.saida, [par]);

  const importar = async () => {
    setMensagem(null);
    const r = await window.api.importLaudoArquivo(os.id);
    if (r.cancelado) return;
    if (r.success) {
      setMensagem({ tipo: r.avisos?.length ? "warning" : "success", texto: ["Laudo importado.", ...(r.avisos || [])].join(" ") });
      carregar();
      onAlterado?.();
    } else setMensagem({ tipo: "error", texto: r.error });
  };

  const receber = async () => {
    setMensagem(null);
    const r = await window.api.startLaudoReceiver(os.id);
    if (r.success) setRecebendo(r);
    else setMensagem({ tipo: "error", texto: r.error });
  };

  const parar = async () => {
    await window.api.stopLaudoReceiver();
    setRecebendo(null);
  };

  const pdf = async (id) => {
    const r = await window.api.saveLaudoPdf(id);
    if (r.success) setMensagem({ tipo: "success", texto: `PDF salvo em ${r.caminho}` });
    else if (!r.cancelado) setMensagem({ tipo: "error", texto: r.error });
  };

  const comparativo = async (acao) => {
    setOcupado(true);
    const r = await window.api.laudoComparativo({ entradaId: par.entrada, saidaId: par.saida, acao });
    setOcupado(false);
    if (r.success) {
      if (r.mesmoEquipamento === false) setMensagem({ tipo: "warning", texto: "Atenção: os laudos parecem ser de equipamentos diferentes (número de série não confere)." });
      else if (acao === "pdf") setMensagem({ tipo: "success", texto: `PDF do comparativo salvo em ${r.caminho}` });
    } else if (!r.cancelado) setMensagem({ tipo: "error", texto: r.error });
  };

  const [baixando, setBaixando] = useState(false);
  const baixarAgente = async () => {
    setMensagem(null);
    setBaixando(true);
    const r = await window.api.downloadDiagnosticoAgente();
    setBaixando(false);
    if (r.success) setMensagem({ tipo: "success", texto: `GSTI Diagnóstico ${r.versao} salvo em ${r.caminho}.` });
    else if (!r.cancelado) setMensagem({ tipo: "error", texto: r.error });
  };

  const excluir = async () => {
    const r = await window.api.deleteLaudo(excluindo.id);
    setExcluindo(null);
    if (r.success) {
      carregar();
      onAlterado?.();
    } else setMensagem({ tipo: "error", texto: r.error });
  };

  return (
    <Dialog open={!!os} onClose={fechar} maxWidth="lg" fullWidth>
      <DialogTitle>
        Laudos técnicos — OS nº {os?.id}
        <Typography variant="body2" color="text.secondary">{[os?.nome_cliente, os?.equipamento].filter(Boolean).join(" · ")}</Typography>
      </DialogTitle>
      <DialogContent dividers>
        {mensagem && <Alert severity={mensagem.tipo} sx={{ mb: 2 }} onClose={() => setMensagem(null)}>{mensagem.texto}</Alert>}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ mb: 2 }}>
          <Button variant="contained" startIcon={<WifiTetheringIcon />} onClick={receber} disabled={!!recebendo}>Receber pela rede</Button>
          <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={importar}>Importar arquivo (.gstilaudo)</Button>
          <Box sx={{ flex: 1 }} />
          <Button startIcon={baixando ? <CircularProgress size={16} /> : <DownloadIcon />} onClick={baixarAgente} disabled={baixando}>
            {baixando ? "Baixando…" : "Baixar GSTI Diagnóstico"}
          </Button>
        </Stack>
        {recebendo && <PainelRecebimento info={recebendo} onParar={parar} />}

        {carregando ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}><CircularProgress /></Box>
        ) : laudos.length === 0 ? (
          <Alert severity="info" variant="outlined">
            Nenhum laudo nesta OS. Rode o <strong>GSTI Diagnóstico</strong> (pen drive) no computador do cliente na <strong>entrada</strong> e
            de novo na <strong>saída</strong> do reparo para gerar o comparativo antes/depois.
          </Alert>
        ) : (
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Momento</TableCell>
                  <TableCell>Gerado em</TableCell>
                  <TableCell>Equipamento</TableCell>
                  <TableCell>Situação</TableCell>
                  <TableCell>Alertas</TableCell>
                  <TableCell align="right">Ações</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {laudos.map((l) => {
                  const [rotulo, cor] = SITUACAO[l.situacao] || SITUACAO.ok;
                  const a = l.resumo?.alertas || {};
                  return (
                    <TableRow key={l.id} hover>
                      <TableCell><Chip size="small" variant="outlined" label={MOMENTO[l.momento] || l.momento} /></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {dataHora(l.gerado_em)}
                        <Typography variant="caption" display="block" color="text.secondary">{l.origem === "rede" ? "Recebido pela rede" : "Arquivo"}{l.usuario ? ` · ${l.usuario}` : ""}</Typography>
                      </TableCell>
                      <TableCell sx={{ minWidth: 260 }} title={l.resumo?.processador || ""}>
                        {l.equipamento}
                        <Typography variant="caption" display="block" color="text.secondary">
                          {[l.resumo?.memoriaGB ? `${l.resumo.memoriaGB} GB RAM` : "", l.resumo?.disco, l.numero_serie ? `S/N ${l.numero_serie}` : ""].filter(Boolean).join(" · ")}
                        </Typography>
                      </TableCell>
                      <TableCell><Chip size="small" color={cor} label={rotulo} /></TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>{a.critico || 0} crítico(s) · {a.atencao || 0} atenção</TableCell>
                      <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                        <Tooltip title="Ver laudo"><IconButton size="small" onClick={() => window.api.viewLaudo(l.id)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Salvar PDF"><IconButton size="small" onClick={() => pdf(l.id)}><PictureAsPdfIcon fontSize="small" /></IconButton></Tooltip>
                        {permissoes.podeExcluir && (
                          <Tooltip title="Excluir laudo"><IconButton size="small" color="error" onClick={() => setExcluindo(l)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {entradas.length > 0 && saidas.length > 0 && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <Typography fontWeight={600} sx={{ mb: 1.5, display: "flex", alignItems: "center", gap: 1 }}><CompareArrowsIcon fontSize="small" /> Comparativo antes e depois do reparo</Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
              <TextField select label="Entrada" value={par.entrada} onChange={(e) => setPar({ ...par, entrada: e.target.value })} sx={{ minWidth: 200 }}>
                {entradas.map((l) => <MenuItem key={l.id} value={l.id}>{dataHora(l.gerado_em)}</MenuItem>)}
              </TextField>
              <TextField select label="Saída" value={par.saida} onChange={(e) => setPar({ ...par, saida: e.target.value })} sx={{ minWidth: 200 }}>
                {saidas.map((l) => <MenuItem key={l.id} value={l.id}>{dataHora(l.gerado_em)}</MenuItem>)}
              </TextField>
              <Box sx={{ flex: 1 }} />
              <Button disabled={!podeComparar || ocupado} onClick={() => comparativo("ver")}>Ver comparativo</Button>
              <Button variant="outlined" disabled={!podeComparar || ocupado} startIcon={<PictureAsPdfIcon />} onClick={() => comparativo("pdf")}>Salvar PDF</Button>
            </Stack>
          </Paper>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={fechar}>Fechar</Button>
      </DialogActions>
      <ConfirmDialog
        open={!!excluindo}
        onCancel={() => setExcluindo(null)}
        onConfirm={excluir}
        title="Excluir laudo"
        message={`Excluir o laudo de ${MOMENTO[excluindo?.momento] || ""} gerado em ${dataHora(excluindo?.gerado_em)}?`}
      />
    </Dialog>
  );
}
