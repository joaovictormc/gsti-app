import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import { get, qs } from "../api";
import { brl, data } from "../format";
import { Cabecalho, Carregando, Erro, StatusChip, useCarregar } from "../components/comum";

export default function Assinaturas() {
  const navegar = useNavigate();
  const [status, setStatus] = useState("authorized");
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/assinaturas${qs({ status })}`), [status]);

  return (
    <>
      <Cabecalho
        titulo="Renovações automáticas"
        subtitulo="Assinaturas anuais cobradas no cartão pelo Mercado Pago."
        acoes={
          <TextField select label="Situação" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">Todas</MenuItem><MenuItem value="authorized">Ativas</MenuItem><MenuItem value="pending">Pendentes</MenuItem><MenuItem value="paused">Pausadas</MenuItem><MenuItem value="cancelled">Canceladas</MenuItem>
          </TextField>
        }
      />
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Cliente</TableCell><TableCell align="right">Valor anual</TableCell><TableCell>Próxima cobrança</TableCell><TableCell>Situação</TableCell><TableCell>Desde</TableCell></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((a) => (
                  <TableRow key={a.id} hover sx={{ cursor: "pointer" }} onClick={() => navegar(`/pedidos/${a.pedido_id}`)}>
                    <TableCell><Typography fontWeight={600}>{a.nome || "—"}</Typography><Typography variant="body2" color="text.secondary">{a.email}</Typography></TableCell>
                    <TableCell align="right">{brl(a.valor_centavos)}</TableCell>
                    <TableCell>{a.status === "authorized" ? data(a.proxima_cobranca) : "—"}</TableCell>
                    <TableCell><StatusChip status={a.status} /></TableCell>
                    <TableCell>{data(a.criado_em)}</TableCell>
                  </TableRow>
                ))}
                {!dados.itens.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhuma renovação automática.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </>
  );
}
