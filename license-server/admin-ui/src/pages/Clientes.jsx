import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography } from "@mui/material";
import { get, qs } from "../api";
import { brl, data } from "../format";
import { Cabecalho, Carregando, Erro, useCarregar } from "../components/comum";

export default function Clientes() {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const pagina = Number(params.get("pagina") || 1);
  const buscaAtual = params.get("busca") || "";
  const [busca, setBusca] = useState(buscaAtual);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/clientes${qs({ busca: buscaAtual, pagina })}`), [params.toString()]);

  return (
    <>
      <Cabecalho titulo="Clientes" subtitulo="Pessoas e empresas com compras, licenças ou pedidos." />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); setParams(busca ? { busca } : {}); }}>
          <TextField label="Buscar por nome, e-mail ou CPF/CNPJ" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
          <Button type="submit" variant="outlined">Buscar</Button>
        </Stack>
      </Paper>
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Cliente</TableCell><TableCell>Documento</TableCell><TableCell>Licenças</TableCell><TableCell align="right">Total pago</TableCell><TableCell>Desde</TableCell></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((c) => (
                  <TableRow key={c.id} hover sx={{ cursor: "pointer" }} onClick={() => navegar(`/clientes/${c.id}`)}>
                    <TableCell><Typography fontWeight={600}>{c.nome || "—"}</Typography><Typography variant="body2" color="text.secondary">{c.email}</Typography></TableCell>
                    <TableCell>{c.documento || "—"}</TableCell>
                    <TableCell>{c.licencas}</TableCell>
                    <TableCell align="right">{brl(c.total_pago)}</TableCell>
                    <TableCell>{data(c.criado_em)}</TableCell>
                  </TableRow>
                ))}
                {!dados.itens.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhum cliente encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={dados.total} page={pagina - 1} rowsPerPage={dados.porPagina} rowsPerPageOptions={[dados.porPagina]} onPageChange={(_e, p) => setParams({ ...(buscaAtual && { busca: buscaAtual }), pagina: p + 1 })} />
        </Paper>
      )}
    </>
  );
}
