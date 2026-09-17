import { Link as RouterLink } from "react-router-dom";
import { Alert, Box, Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import { get } from "../api";
import { brl, dataHora, PLANOS, MODALIDADES } from "../format";
import { Cabecalho, Carregando, Erro, StatusChip, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";

function Numero({ rotulo, valor, detalhe, to }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%", ...(to && { cursor: "pointer", "&:hover": { borderColor: "primary.light" } }) }} component={to ? RouterLink : "div"} to={to} style={{ textDecoration: "none", display: "block" }}>
      <Typography variant="overline" color="text.secondary">{rotulo}</Typography>
      <Typography sx={{ fontSize: 30, fontWeight: 700, lineHeight: 1.1, color: "text.primary" }}>{valor}</Typography>
      {detalhe && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{detalhe}</Typography>}
    </Paper>
  );
}

function ReceitaMensal({ porMes }) {
  const meses = [];
  const hoje = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const achado = porMes.find((m) => m.mes === chave);
    meses.push({ chave, rotulo: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), total: achado?.total || 0, n: achado?.n || 0 });
  }
  const max = Math.max(...meses.map((m) => m.total), 1);
  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ mb: 0.5 }}>Receita confirmada</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Últimos 12 meses, sem estornos</Typography>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 1, alignItems: "end", height: 180 }} role="img" aria-label="Receita por mês">
        {meses.map((m) => (
          <Box key={m.chave} sx={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }} title={`${m.rotulo}: ${brl(m.total)} (${m.n} pagamentos)`}>
            <Box sx={{ width: "100%", maxWidth: 28, height: `${Math.max((m.total / max) * 100, m.total ? 3 : 1)}%`, bgcolor: m.total ? "primary.main" : "divider", borderRadius: "4px 4px 0 0" }} />
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>{m.rotulo}</Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

export default function Painel() {
  const { usuario } = useSessao();
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/painel"), []);

  if (carregando) return <Carregando />;
  const l = dados?.licencas, v = dados?.vendas, s = dados?.sistema, sp = dados?.suporte;
  const totalAtivas = l ? l.porPlano.reduce((a, p) => a + p.n, 0) : 0;

  return (
    <>
      <Cabecalho titulo={`Olá, ${usuario.nome.split(" ")[0]}`} subtitulo="Resumo das licenças e vendas." />
      <Erro erro={erro} onTentar={recarregar} />

      {s && (s.simulador || !s.mercadoPago || !s.smtp || s.eventosComErro > 0) && (
        <Stack spacing={1} sx={{ mb: 3 }}>
          {s.simulador && <Alert severity="error" variant="filled">Ambiente de HOMOLOGAÇÃO: pagamentos usam o simulador do Mercado Pago. Nenhuma cobrança é real.</Alert>}
          {!s.mercadoPago && <Alert severity="warning" action={<Button component={RouterLink} to="/sistema" color="inherit" size="small">Ver</Button>}>Mercado Pago não configurado — o site não consegue vender.</Alert>}
          {!s.smtp && <Alert severity="warning" action={<Button component={RouterLink} to="/sistema" color="inherit" size="small">Ver</Button>}>E-mail (SMTP) não configurado — as chaves não estão sendo enviadas aos clientes.</Alert>}
          {s.eventosComErro > 0 && <Alert severity="error" action={<Button component={RouterLink} to="/sistema" color="inherit" size="small">Ver</Button>}>{s.eventosComErro} notificação(ões) do Mercado Pago com erro de processamento.</Alert>}
        </Stack>
      )}

      <Grid container spacing={2} sx={{ mb: 3 }}>
        {sp && (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Chamados sem resposta" valor={sp.semResposta} detalhe={`${sp.aberto + sp.em_andamento} em atendimento`} to="/suporte" /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Aguardando o cliente" valor={sp.aguardando_cliente} detalhe="Fecham sozinhos após 7 dias sem resposta" to="/suporte?status=aguardando_cliente" /></Grid>
          </>
        )}
        {v && (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Vendas no mês" valor={brl(v.mes.total)} detalhe={`${v.mes.n} pedido(s) pago(s)`} to="/pedidos?status=pago" /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Aguardando pagamento" valor={v.pendentes} detalhe="Pix, boleto ou checkout aberto" to="/pedidos?status=pendente" /></Grid>
          </>
        )}
        {l && (
          <>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Licenças ativas" valor={totalAtivas} detalhe={l.porPlano.map((p) => `${PLANOS[p.plano] || p.plano}: ${p.n}`).join(" · ") || "Nenhuma"} to="/licencas?status=ativa" /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Vencem em 30 dias" valor={l.vencendo30} detalhe={v ? `${v.assinaturasAtivas} com renovação automática` : `${l.suspensas} suspensa(s)`} to="/licencas?vencendo=30" /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Computadores ativos" valor={l.maquinasAtivas} /></Grid>
            <Grid size={{ xs: 12, sm: 6, lg: 3 }}><Numero rotulo="Testes (30 dias)" valor={l.trials30} /></Grid>
          </>
        )}
      </Grid>

      {v && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, lg: 5 }}><ReceitaMensal porMes={v.porMes} /></Grid>
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper sx={{ p: 2.5, overflowX: "auto" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6">Pedidos recentes</Typography>
                <Button component={RouterLink} to="/pedidos" size="small">Ver todos</Button>
              </Stack>
              <Table size="small">
                <TableHead><TableRow><TableCell>Cliente</TableCell><TableCell>Plano</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell><TableCell>Data</TableCell></TableRow></TableHead>
                <TableBody>
                  {v.recentes.map((p) => (
                    <TableRow key={p.id} hover component={RouterLink} to={`/pedidos/${p.id}`} sx={{ textDecoration: "none" }}>
                      <TableCell>{p.nome || p.email}</TableCell>
                      <TableCell>{p.tipo === "renovacao" ? "Renovação " : ""}{PLANOS[p.plano]}<Typography variant="caption" display="block" color="text.secondary">{MODALIDADES[p.modalidade]}</Typography></TableCell>
                      <TableCell align="right">{brl(p.valor_centavos)}</TableCell>
                      <TableCell><StatusChip status={p.status} /></TableCell>
                      <TableCell>{dataHora(p.criado_em)}</TableCell>
                    </TableRow>
                  ))}
                  {!v.recentes.length && <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 4 }}>Nenhum pedido ainda.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </Paper>
          </Grid>
        </Grid>
      )}
    </>
  );
}
