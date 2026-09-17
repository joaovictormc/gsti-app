import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Button, Chip, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow,
  TextField, ToggleButton, ToggleButtonGroup, Typography,
} from "@mui/material";
import { get, qs } from "../api";
import { dataHora } from "../format";
import { Cabecalho, Carregando, Erro, StatusChip, useCarregar } from "../components/comum";

export const COR_PRIORIDADE = { baixa: "default", normal: "default", alta: "warning", urgente: "error" };

export default function Chamados() {
  const navegar = useNavigate();
  const [params, setParams] = useSearchParams();
  const f = {
    busca: params.get("busca") || "",
    status: params.get("status") ?? "ativos",
    categoria: params.get("categoria") || "",
    atribuido: params.get("atribuido") || "",
    pagina: Number(params.get("pagina") || 1),
  };
  const [busca, setBusca] = useState(f.busca);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/suporte/chamados${qs(f)}`), [params.toString()]);
  // "status" vazio (todos) precisa ir para a URL, senão volta ao padrão "ativos"
  const alterar = (m) => setParams(Object.fromEntries(Object.entries({ ...f, pagina: 1, ...m }).filter(([k, v]) => (k === "status" ? v !== "ativos" : v !== "" && v !== 1))));

  const c = dados?.contagens;
  return (
    <>
      <Cabecalho
        titulo="Suporte"
        subtitulo={c ? `${c.porStatus.aberto + c.porStatus.em_andamento} em atendimento · ${c.semResposta} aguardando resposta da equipe · ${c.porStatus.aguardando_cliente} aguardando o cliente` : "Chamados abertos pelo site, pela área do cliente e pelo app."}
      />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} component="form" onSubmit={(e) => { e.preventDefault(); alterar({ busca }); }}>
          <TextField label="Buscar por nº, assunto, nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} sx={{ flex: 1 }} />
          <TextField select label="Situação" value={f.status} onChange={(e) => alterar({ status: e.target.value })} sx={{ minWidth: 190 }}>
            <MenuItem value="ativos">Em aberto (todos)</MenuItem>
            <MenuItem value="">Todas</MenuItem>
            {dados && Object.entries(dados.status).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <TextField select label="Tipo" value={f.categoria} onChange={(e) => alterar({ categoria: e.target.value })} sx={{ minWidth: 190 }}>
            <MenuItem value="">Todos</MenuItem>
            {dados && Object.entries(dados.categorias).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}
          </TextField>
          <Button type="submit" variant="outlined">Buscar</Button>
        </Stack>
        <ToggleButtonGroup size="small" exclusive value={f.atribuido} onChange={(_e, v) => v !== null && alterar({ atribuido: v })} sx={{ mt: 2 }}>
          <ToggleButton value="">Todos</ToggleButton>
          <ToggleButton value="eu">Comigo</ToggleButton>
          <ToggleButton value="ninguem">Sem responsável</ToggleButton>
        </ToggleButtonGroup>
      </Paper>
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Nº</TableCell><TableCell>Assunto</TableCell><TableCell>Cliente</TableCell><TableCell>Situação</TableCell><TableCell>Responsável</TableCell><TableCell>Atualizado</TableCell></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((ch) => (
                  <TableRow key={ch.id} hover sx={{ cursor: "pointer" }} onClick={() => navegar(`/suporte/${ch.id}`)}>
                    <TableCell sx={{ fontFamily: "JetBrains Mono, monospace" }}>#{ch.id}</TableCell>
                    <TableCell>
                      <Typography fontWeight={600}>{ch.assunto}</Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.5 }} flexWrap="wrap" useFlexGap>
                        <Typography variant="caption" color="text.secondary">{dados.categorias[ch.categoria]} · {dados.origens[ch.origem]}</Typography>
                        {ch.prioridade !== "normal" && <Chip size="small" label={dados.prioridades[ch.prioridade]} color={COR_PRIORIDADE[ch.prioridade]} sx={{ height: 20 }} />}
                        {["aberto", "em_andamento"].includes(ch.status) && ch.ultimo_autor === "cliente" && <Chip size="small" label="Aguardando equipe" color="secondary" sx={{ height: 20 }} />}
                      </Stack>
                    </TableCell>
                    <TableCell><Typography>{ch.nome || "—"}</Typography><Typography variant="body2" color="text.secondary">{ch.email}</Typography></TableCell>
                    <TableCell><StatusChip status={ch.status} /></TableCell>
                    <TableCell>{ch.atribuido_nome || <Typography variant="body2" color="text.secondary">—</Typography>}</TableCell>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{dataHora(ch.atualizado_em)}</TableCell>
                  </TableRow>
                ))}
                {!dados.itens.length && <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6, color: "text.secondary" }}>Nenhum chamado encontrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={dados.total} page={f.pagina - 1} rowsPerPage={dados.porPagina} rowsPerPageOptions={[dados.porPagina]} onPageChange={(_e, p) => alterar({ ...f, pagina: p + 1 })} />
        </Paper>
      )}
    </>
  );
}
