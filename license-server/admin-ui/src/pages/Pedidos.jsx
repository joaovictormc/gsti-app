import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { get, qs } from "../api";
import { brl, dataHora, MODALIDADES, PLANOS } from "../format";
import { Cabecalho, Carregando, Erro, StatusChip, useCarregar } from "../components/comum";

export default function Pedidos() {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const f = { busca: params.get("busca") || "", status: params.get("status") || "", modalidade: params.get("modalidade") || "", pagina: Number(params.get("pagina") || 1) };
  const [busca, setBusca] = useState(f.busca);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/pedidos${qs(f)}`), [params.toString()]);
  const alterar = (m) => setParams(Object.fromEntries(Object.entries({ ...f, pagina: 1, ...m }).filter(([, v]) => v !== "" && v !== 1)));

  return (
    <>
      <Cabecalho titulo="Pedidos" subtitulo="Compras e renovações feitas pelo site (Mercado Pago)." />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); alterar({ busca }); }}>
          <TextField label="Buscar por cliente ou id do pedido" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
          <TextField select label="Situação" value={f.status} onChange={(e) => alterar({ status: e.target.value })} sx={{ minWidth: 170 }}>
            <MenuItem value="">Todas</MenuItem>
            {["pendente", "pago", "reembolsado", "contestado", "expirado", "cancelado"].map((s) => <MenuItem key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</MenuItem>)}
          </TextField>
          <TextField select label="Modalidade" value={f.modalidade} onChange={(e) => alterar({ modalidade: e.target.value })} sx={{ minWidth: 200 }}>
            <MenuItem value="">Todas</MenuItem>{Object.entries(MODALIDADES).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <Button type="submit" variant="outlined">Buscar</Button>
        </Stack>
      </Paper>
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Cliente</TableCell><TableCell>Descrição</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((p) => (
                  <TableRow key={p.id} hover sx={{ cursor: "pointer" }} onClick={() => navegar(`/pedidos/${p.id}`)}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{dataHora(p.criado_em)}</TableCell>
                    <TableCell><Typography fontWeight={600}>{p.nome || "—"}</Typography><Typography variant="body2" color="text.secondary">{p.email}</Typography></TableCell>
                    <TableCell>{p.tipo === "renovacao" ? "Renovação" : "Licença"} {PLANOS[p.plano]}<Typography variant="caption" display="block" color="text.secondary">{MODALIDADES[p.modalidade]}</Typography></TableCell>
                    <TableCell align="right">{brl(p.valor_centavos)}</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                  </TableRow>
                ))}
                {!dados.itens.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhum pedido encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={dados.total} page={f.pagina - 1} rowsPerPage={dados.porPagina} rowsPerPageOptions={[dados.porPagina]} onPageChange={(_e, p) => alterar({ ...f, pagina: p + 1 })} />
        </Paper>
      )}
    </>
  );
}
