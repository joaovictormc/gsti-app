import { useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Link, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { get, post, put } from "../api";
import { data } from "../format";
import { Cabecalho, Carregando, Erro, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";

const COR = { novo: "default", em_analise: "info", planejado: "info", disponivel: "success", descartado: "default" };
const ORIGEM = { portal: "Área do cliente", app: "Aplicativo" };

function Situacao({ status, rotulo }) {
  return <Chip size="small" label={rotulo} color={COR[status]} variant={COR[status] === "default" ? "outlined" : "filled"} sx={{ fontWeight: 600 }} />;
}

function Detalhe({ chave, status, onFechar, onSalvo }) {
  const { pode } = useSessao();
  const [aviso, avisar] = useAviso();
  const { dados, erro, carregando, recarregar } = useCarregar(() => (chave ? get(`/emissores/${encodeURIComponent(chave)}`) : Promise.resolve(null)), [chave]);
  const [form, setForm] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (dados?.emissor) setForm({ nome: dados.emissor.nome, status: dados.emissor.status, nota: dados.emissor.nota || "", notaPublica: dados.emissor.nota_publica || "" });
  }, [dados]);

  const podeEditar = pode("emissores.gerenciar");
  const salvar = async () => {
    setOcupado(true);
    try {
      await put(`/emissores/${encodeURIComponent(chave)}`, form);
      avisar("Situação salva.");
      await recarregar();
      onSalvo();
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(false);
    }
  };
  const avisarClientes = async () => {
    setOcupado(true);
    try {
      const r = await post(`/emissores/${encodeURIComponent(chave)}/avisar`);
      avisar(`${r.enviados} cliente(s) avisado(s)${r.falhas ? `, ${r.falhas} falha(s) no envio` : ""}.`, r.falhas ? "warning" : "success");
      await recarregar();
      onSalvo();
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(false);
    }
  };

  const pendentesAviso = dados?.pedidos.filter((p) => !p.avisado_em).length || 0;
  return (
    <Dialog open={!!chave} onClose={onFechar} maxWidth="md" fullWidth>
      <DialogTitle>{dados?.emissor.nome || "Emissor"}</DialogTitle>
      <DialogContent>
        <Erro erro={erro} onTentar={recarregar} />
        {carregando || !form ? <Carregando /> : (
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Nome exibido" value={form.nome} disabled={!podeEditar} onChange={(e) => setForm({ ...form, nome: e.target.value })} sx={{ flex: 1 }} />
              <TextField select label="Situação" value={form.status} disabled={!podeEditar} onChange={(e) => setForm({ ...form, status: e.target.value })} sx={{ minWidth: 200 }}>
                {Object.entries(status).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
              </TextField>
            </Stack>
            <TextField
              label="Nota para os clientes (aparece na área do cliente e, se Em análise/Planejado, no guia do site)"
              value={form.notaPublica} disabled={!podeEditar} onChange={(e) => setForm({ ...form, notaPublica: e.target.value })}
              inputProps={{ maxLength: 300 }}
            />
            <TextField label="Anotações internas" value={form.nota} disabled={!podeEditar} multiline minRows={2} onChange={(e) => setForm({ ...form, nota: e.target.value })} />
            {form.status === "disponivel" && dados.emissor.status === "disponivel" && pendentesAviso > 0 && (
              <Alert severity="info" action={podeEditar && <Button color="inherit" size="small" onClick={avisarClientes} disabled={ocupado}>Avisar {pendentesAviso}</Button>}>
                {pendentesAviso} cliente(s) ainda não foram avisados de que o emissor está disponível.
              </Alert>
            )}
            <Box>
              <Typography variant="h6" sx={{ mb: 1 }}>Pedidos ({dados.pedidos.length})</Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead><TableRow><TableCell>Cliente</TableCell><TableCell>Notas</TableCell><TableCell>Local</TableCell><TableCell>Observação</TableCell><TableCell>Pedido</TableCell></TableRow></TableHead>
                  <TableBody>
                    {dados.pedidos.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {p.cliente_id ? <Link component={RouterLink} to={`/clientes/${p.cliente_id}`}>{p.cliente_nome || p.email}</Link> : p.email}
                          <Typography variant="caption" display="block" color="text.secondary">{ORIGEM[p.origem] || p.origem}{p.avisado_em ? ` · avisado ${data(p.avisado_em)}` : ""}</Typography>
                        </TableCell>
                        <TableCell>{p.documentos.join(", ")}</TableCell>
                        <TableCell>{[p.municipio, p.uf].filter(Boolean).join(" / ") || "—"}</TableCell>
                        <TableCell sx={{ maxWidth: 260 }}>
                          {p.observacao || "—"}
                          {p.site && <Link href={p.site} target="_blank" rel="noopener" display="block" variant="caption">{p.site}</Link>}
                        </TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{data(p.criado_em)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar}>Fechar</Button>
        {podeEditar && <Button variant="contained" onClick={salvar} disabled={ocupado || !form}>Salvar</Button>}
      </DialogActions>
      {aviso}
    </Dialog>
  );
}

export default function Emissores() {
  const [filtro, setFiltro] = useState("");
  const [aberto, setAberto] = useState(null);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/emissores${filtro ? `?status=${filtro}` : ""}`), [filtro]);

  return (
    <>
      <Cabecalho
        titulo="Pedidos de emissores"
        subtitulo="Emissores de nota fiscal que os clientes pediram para integrar, do mais pedido para o menos pedido."
        acoes={<Button component="a" href="/emissores" target="_blank" variant="outlined">Ver o guia no site</Button>}
      />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "center" }}>
          <TextField select label="Situação" value={filtro} onChange={(e) => setFiltro(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="">Todas</MenuItem>
            {dados && Object.entries(dados.status).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          {dados && (
            <Typography variant="body2" color="text.secondary">
              No catálogo hoje: {dados.catalogo.map((c) => `${c.nome.split(/[—(]/)[0].trim()}${c.status !== "disponivel" ? " (em desenvolvimento)" : ""}`).join(" · ")}
            </Typography>
          )}
        </Stack>
      </Paper>
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell align="right">Clientes</TableCell><TableCell>Emissor</TableCell><TableCell>Notas</TableCell><TableCell>UFs</TableCell><TableCell>Situação</TableCell><TableCell>Último pedido</TableCell></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((i) => (
                  <TableRow key={i.chave} hover sx={{ cursor: "pointer" }} onClick={() => setAberto(i.chave)}>
                    <TableCell align="right"><Typography sx={{ fontSize: 22, fontWeight: 700 }}>{i.pedidos}</Typography></TableCell>
                    <TableCell><Typography fontWeight={600}>{i.nome}</Typography>{i.nota_publica && <Typography variant="caption" color="text.secondary">{i.nota_publica}</Typography>}</TableCell>
                    <TableCell>{i.documentos.join(", ")}</TableCell>
                    <TableCell>{i.ufs.join(", ") || "—"}</TableCell>
                    <TableCell><Situacao status={i.status} rotulo={i.statusRotulo} /></TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{data(i.ultimo)}</TableCell>
                  </TableRow>
                ))}
                {!dados.itens.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhum pedido de emissor ainda.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      <Detalhe chave={aberto} status={dados?.status || {}} onFechar={() => setAberto(null)} onSalvo={recarregar} />
    </>
  );
}
