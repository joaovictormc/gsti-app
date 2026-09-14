import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Alert, Button, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { get, post } from "../api";
import { brl, data, dataHora, MODALIDADES, PLANOS } from "../format";
import { Cabecalho, Carregando, Confirmar, Erro, StatusChip, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";
import { Campo, Historico } from "./LicencaDetalhe";

const METODOS = { credit_card: "Cartão de crédito", debit_card: "Cartão de débito", ticket: "Boleto", bank_transfer: "Pix", pix: "Pix", account_money: "Saldo Mercado Pago" };

export default function PedidoDetalhe() {
  const { id } = useParams();
  const { pode } = useSessao();
  const [aviso, avisar] = useAviso();
  const [dialogo, setDialogo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/pedidos/${id}`), [id]);

  if (carregando) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;
  const { pedido: p, cliente, pagamentos, assinatura, historico } = dados;

  const reconciliar = async () => {
    setOcupado(true);
    try {
      await post(`/pedidos/${p.id}/reconciliar`);
      avisar("Situação atualizada com o Mercado Pago.");
      recarregar();
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      <Cabecalho
        voltar={<Button component={RouterLink} to="/pedidos" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1, ml: -1 }}>Pedidos</Button>}
        titulo={`${p.tipo === "renovacao" ? "Renovação" : "Licença"} ${PLANOS[p.plano]} · ${brl(p.valor_centavos)}`}
        subtitulo={<>{cliente.nome ? `${cliente.nome} · ` : ""}<Link component={RouterLink} to={`/clientes/${cliente.id}`}>{cliente.email}</Link></>}
        acoes={<>
          <StatusChip status={p.status} />
          {pode("pedidos.editar") && <Button variant="outlined" onClick={reconciliar} disabled={ocupado}>{ocupado ? "Consultando…" : "Atualizar com o Mercado Pago"}</Button>}
        </>}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Modalidade">{MODALIDADES[p.modalidade]}</Campo></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Criado">{dataHora(p.criado_em)}</Campo></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Pago">{dataHora(p.pago_em)}</Campo></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Licença">{p.licenca_id ? <Link component={RouterLink} to={`/licencas/${p.licenca_id}`}>Abrir licença</Link> : "Ainda não emitida"}</Campo></Grid>
              <Grid size={12}><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>pedido {p.id}{p.mp_preference_id ? ` · preferência ${p.mp_preference_id}` : ""}{p.mp_preapproval_id ? ` · assinatura ${p.mp_preapproval_id}` : ""}</Typography></Grid>
            </Grid>
            {p.status === "pendente" && (
              <Alert severity="info" sx={{ mt: 2 }}>
                Aguardando pagamento. Boletos podem levar até 3 dias úteis; pedidos sem pagamento expiram em 3 dias. {p.checkout_url && <Link href={p.checkout_url} target="_blank" rel="noopener">Link do checkout</Link>}
              </Alert>
            )}
          </Paper>

          <Paper sx={{ p: 3, mb: 2, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Pagamentos</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Método</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell><TableCell>Efeito</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {pagamentos.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell sx={{ whiteSpace: "nowrap" }}>{dataHora(g.criado_em)}<Typography variant="caption" display="block" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>MP {g.mp_payment_id}</Typography></TableCell>
                    <TableCell>{METODOS[g.metodo] || g.metodo || "—"}{g.parcelas > 1 ? ` · ${g.parcelas}x` : ""}</TableCell>
                    <TableCell align="right">{brl(g.valor_centavos)}</TableCell>
                    <TableCell><StatusChip status={g.status} /></TableCell>
                    <TableCell>{g.estornado_em ? `Estornado ${data(g.estornado_em)}` : g.aplicado_em ? (g.emitiu_licenca ? "Emitiu a licença" : "Renovou +12 meses") : "—"}</TableCell>
                    <TableCell align="right">
                      {pode("pagamentos.reembolsar") && g.status === "approved" && !g.estornado_em && (
                        <Button size="small" color="error" onClick={() => setDialogo({
                          titulo: "Reembolsar pagamento",
                          texto: `Devolve ${brl(g.valor_centavos)} ao cliente pelo Mercado Pago. ${g.emitiu_licenca ? "A licença será revogada." : "Os 12 meses desta renovação serão removidos da validade."}`,
                          cor: "error", rotuloConfirmar: "Reembolsar",
                          acao: async () => { await post(`/pagamentos/${g.mp_payment_id}/reembolsar`); avisar("Reembolso solicitado."); recarregar(); },
                        })}>Reembolsar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!pagamentos.length && <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>Nenhum pagamento registrado.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 3, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Histórico</Typography>
            <Historico itens={historico} />
          </Paper>
        </Grid>

        {assinatura && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Renovação automática</Typography>
              <Stack spacing={2}>
                <Campo rotulo="Situação"><StatusChip status={assinatura.status} /></Campo>
                <Campo rotulo="Valor anual">{brl(assinatura.valor_centavos)}</Campo>
                <Campo rotulo="Próxima cobrança">{data(assinatura.proxima_cobranca)}</Campo>
                {pode("pedidos.editar") && ["authorized", "paused", "pending"].includes(assinatura.status) && (
                  <Button variant="outlined" color="error" onClick={() => setDialogo({
                    titulo: "Cancelar renovação automática",
                    texto: "Interrompe as próximas cobranças no Mercado Pago. A licença continua válida até o fim do período já pago.",
                    cor: "error", rotuloConfirmar: "Cancelar renovação",
                    acao: async () => { await post(`/assinaturas/${assinatura.id}/cancelar`); avisar("Renovação automática cancelada."); recarregar(); },
                  })}>Cancelar renovação automática</Button>
                )}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
      <Confirmar aberto={!!dialogo} {...(dialogo || {})} onFechar={() => setDialogo(null)} acao={dialogo?.acao || (async () => {})} />
      {aviso}
    </>
  );
}
