import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { get, post, qs } from "../api";
import { PLANOS, validade, diasAte, dataHora } from "../format";
import { Cabecalho, Carregando, Erro, SegredoUnico, StatusChip, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";

export function statusLicenca(l) {
  if (l.status === "ativa" && l.valida_ate && new Date(l.valida_ate) < new Date()) return "expirada";
  return l.status;
}

function EmitirLicenca({ aberto, onFechar, onEmitida }) {
  const inicial = { email: "", nome: "", plano: "cortesia", dias: "", maxMaquinas: 1, observacao: "", enviarEmail: true };
  const [f, setF] = useState(inicial);
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const campo = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  const emitir = async () => {
    setOcupado(true);
    setErro("");
    try {
      const r = await post("/licencas", { ...f, dias: f.dias ? Number(f.dias) : undefined, maxMaquinas: Number(f.maxMaquinas) });
      setF(inicial);
      onEmitida(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open={aberto} onClose={() => !ocupado && onFechar()} maxWidth="sm" fullWidth>
      <DialogTitle>Emitir licença manualmente</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Para cortesias, parceiros ou vendas fora do site. Vendas pelo site geram a licença automaticamente.
        </Typography>
        <Stack spacing={2}>
          <TextField label="E-mail do cliente" type="email" required {...campo("email")} autoFocus />
          <TextField label="Nome" {...campo("nome")} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField select label="Plano" fullWidth {...campo("plano")}>
              {["cortesia", "anual", "vitalicia"].map((p) => <MenuItem key={p} value={p}>{PLANOS[p]}</MenuItem>)}
            </TextField>
            <TextField label="Validade (dias)" type="number" fullWidth helperText="Vazio = sem expiração" {...campo("dias")} />
            <TextField label="Computadores" type="number" fullWidth {...campo("maxMaquinas")} slotProps={{ htmlInput: { min: 1 } }} />
          </Stack>
          <TextField label="Observação interna" multiline minRows={2} {...campo("observacao")} />
          <FormControlLabel control={<Checkbox checked={f.enviarEmail} onChange={(e) => setF({ ...f, enviarEmail: e.target.checked })} />} label="Enviar a chave por e-mail ao cliente" />
          {erro && <Alert severity="error">{erro}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" onClick={emitir} disabled={ocupado || !f.email}>{ocupado ? "Emitindo…" : "Emitir"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Licencas() {
  const { pode } = useSessao();
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const filtros = { busca: params.get("busca") || "", status: params.get("status") || "", plano: params.get("plano") || "", vencendo: params.get("vencendo") || "", pagina: Number(params.get("pagina") || 1) };
  const [busca, setBusca] = useState(filtros.busca);
  const [emitir, setEmitir] = useState(false);
  const [chave, setChave] = useState(null);

  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/licencas${qs(filtros)}`), [params.toString()]);
  const alterar = (mudancas) => {
    const n = { ...filtros, pagina: 1, ...mudancas };
    setParams(Object.fromEntries(Object.entries(n).filter(([, v]) => v !== "" && v !== 1)));
  };

  return (
    <>
      <Cabecalho
        titulo="Licenças"
        subtitulo="Busque por e-mail, nome, início do id ou os 4 últimos caracteres da chave."
        acoes={pode("licencas.editar") && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEmitir(true)}>Emitir licença</Button>}
      />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); alterar({ busca }); }}>
          <TextField label="Buscar" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
          <TextField select label="Situação" value={filtros.status} onChange={(e) => alterar({ status: e.target.value })} sx={{ minWidth: 160 }}>
            <MenuItem value="">Todas</MenuItem><MenuItem value="ativa">Ativas</MenuItem><MenuItem value="suspensa">Suspensas</MenuItem><MenuItem value="revogada">Revogadas</MenuItem>
          </TextField>
          <TextField select label="Plano" value={filtros.plano} onChange={(e) => alterar({ plano: e.target.value })} sx={{ minWidth: 150 }}>
            <MenuItem value="">Todos</MenuItem>{Object.entries(PLANOS).filter(([k]) => k !== "trial").map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <TextField select label="Vencimento" value={filtros.vencendo} onChange={(e) => alterar({ vencendo: e.target.value })} sx={{ minWidth: 170 }}>
            <MenuItem value="">Qualquer</MenuItem><MenuItem value="7">Em até 7 dias</MenuItem><MenuItem value="30">Em até 30 dias</MenuItem><MenuItem value="60">Em até 60 dias</MenuItem>
          </TextField>
          <Button type="submit" variant="outlined">Buscar</Button>
        </Stack>
      </Paper>
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow><TableCell>Cliente</TableCell><TableCell>Plano</TableCell><TableCell>Chave</TableCell><TableCell>Validade</TableCell><TableCell>Computadores</TableCell><TableCell>Situação</TableCell><TableCell>Emitida</TableCell></TableRow>
              </TableHead>
              <TableBody>
                {dados.itens.map((l) => {
                  const dias = diasAte(l.valida_ate);
                  return (
                    <TableRow key={l.id} hover sx={{ cursor: "pointer" }} onClick={() => navegar(`/licencas/${l.id}`)}>
                      <TableCell><Typography fontWeight={600}>{l.nome || "—"}</Typography><Typography variant="body2" color="text.secondary">{l.email}</Typography></TableCell>
                      <TableCell>{PLANOS[l.plano] || l.plano}</TableCell>
                      <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>…{l.chave_final}</TableCell>
                      <TableCell>{validade(l.valida_ate)}{dias != null && dias >= 0 && dias <= 30 && <Typography variant="caption" display="block" color="warning.main">em {dias} dia(s)</Typography>}</TableCell>
                      <TableCell>{l.maquinas} / {l.max_maquinas}</TableCell>
                      <TableCell><StatusChip status={statusLicenca(l)} /></TableCell>
                      <TableCell>{dataHora(l.criado_em)}</TableCell>
                    </TableRow>
                  );
                })}
                {!dados.itens.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhuma licença encontrada.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={dados.total} page={dados.pagina - 1} rowsPerPage={dados.porPagina} rowsPerPageOptions={[dados.porPagina]} onPageChange={(_e, p) => alterar({ ...filtros, pagina: p + 1 })} />
        </Paper>
      )}
      <EmitirLicenca aberto={emitir} onFechar={() => setEmitir(false)} onEmitida={(r) => { setEmitir(false); setChave(r); recarregar(); }} />
      <SegredoUnico
        aberto={!!chave}
        titulo="Licença emitida"
        rotulo={`Chave de ${chave?.email || ""}`}
        valor={chave?.chave || ""}
        onFechar={() => { const id = chave.id; setChave(null); navegar(`/licencas/${id}`); }}
      />
    </>
  );
}
