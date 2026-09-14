import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button, Paper, Stack, TablePagination, TextField } from "@mui/material";
import { get, qs } from "../api";
import { Cabecalho, Carregando, Erro, useCarregar } from "../components/comum";
import { Historico } from "./LicencaDetalhe";

export default function Auditoria() {
  const [params, setParams] = useSearchParams();
  const atual = { ator: params.get("ator") || "", acao: params.get("acao") || "", alvo: params.get("alvo") || "", pagina: Number(params.get("pagina") || 1) };
  const [f, setF] = useState(atual);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/auditoria${qs(atual)}`), [params.toString()]);
  const aplicar = (m) => setParams(Object.fromEntries(Object.entries({ ...f, pagina: 1, ...m }).filter(([, v]) => v !== "" && v !== 1)));

  return (
    <>
      <Cabecalho titulo="Auditoria" subtitulo="Registro de ações da equipe, do app, dos clientes e do Mercado Pago." />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); aplicar({}); }}>
          <TextField label="Quem (e-mail, app, mercadopago)" value={f.ator} onChange={(e) => setF({ ...f, ator: e.target.value })} sx={{ flex: 1 }} />
          <TextField label="Ação" value={f.acao} onChange={(e) => setF({ ...f, acao: e.target.value })} sx={{ flex: 1 }} />
          <TextField label="Alvo (id)" value={f.alvo} onChange={(e) => setF({ ...f, alvo: e.target.value })} sx={{ flex: 1 }} />
          <Button type="submit" variant="outlined">Filtrar</Button>
        </Stack>
      </Paper>
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper sx={{ overflowX: "auto" }}>
          <Historico itens={dados.itens} />
          <TablePagination component="div" count={dados.total} page={atual.pagina - 1} rowsPerPage={dados.porPagina} rowsPerPageOptions={[dados.porPagina]} onPageChange={(_e, p) => aplicar({ ...atual, pagina: p + 1 })} />
        </Paper>
      )}
    </>
  );
}
