import { useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import {
  Box, Button, Grid, Link, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { get, post } from "../api";
import { brl, data, dataHora, PLANOS, validade, MODALIDADES } from "../format";
import { Cabecalho, Carregando, Confirmar, Erro, SegredoUnico, StatusChip, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";
import { statusLicenca } from "./Licencas";

export function Campo({ rotulo, children }) {
  return (
    <Box>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>{rotulo}</Typography>
      <Typography component="div" sx={{ fontWeight: 500 }}>{children ?? "—"}</Typography>
    </Box>
  );
}

export function Historico({ itens }) {
  if (!itens?.length) return <Typography color="text.secondary">Sem registros.</Typography>;
  return (
    <Table size="small">
      <TableHead><TableRow><TableCell>Quando</TableCell><TableCell>Quem</TableCell><TableCell>Ação</TableCell><TableCell>Detalhes</TableCell></TableRow></TableHead>
      <TableBody>
        {itens.map((a) => (
          <TableRow key={a.id}>
            <TableCell sx={{ whiteSpace: "nowrap" }}>{dataHora(a.criado_em)}</TableCell>
            <TableCell>{a.ator}</TableCell>
            <TableCell>{a.acao}</TableCell>
            <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", fontSize: 12, color: "text.secondary", maxWidth: 360, wordBreak: "break-word" }}>{a.dados || ""}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function LicencaDetalhe() {
  const { id } = useParams();
  const { pode } = useSessao();
  const editar = pode("licencas.editar");
  const [aviso, avisar] = useAviso();
  const [dialogo, setDialogo] = useState(null);
  const [chave, setChave] = useState(null);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/licencas/${id}`), [id]);

  if (carregando) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;
  const { licenca: l, cliente, ativacoes, pedidos, assinaturas, historico } = dados;
  const ativas = ativacoes.filter((a) => !a.desativado_em);
  const acao = (rota, corpo, msg) => async () => {
    await post(rota, corpo);
    avisar(msg);
    recarregar();
  };

  const dialogos = {
    estender: { titulo: "Estender validade", texto: "Soma dias à validade atual (ou a partir de hoje, se já venceu).", rotuloConfirmar: "Estender", campo: { rotulo: "Dias", obrigatorio: true, props: { type: "number" } }, acao: (v) => acao(`/licencas/${l.id}/estender`, { dias: Number(v) }, "Validade estendida.")() },
    vitalicia: { titulo: "Tornar sem expiração", texto: "A licença deixa de ter data de validade.", acao: acao(`/licencas/${l.id}/estender`, { vitalicia: true }, "Licença sem expiração.") },
    maquinas: { titulo: "Limite de computadores", rotuloConfirmar: "Salvar", campo: { rotulo: "Quantidade", obrigatorio: true, inicial: l.max_maquinas, props: { type: "number" } }, acao: (v) => acao(`/licencas/${l.id}/maquinas`, { max: Number(v) }, "Limite atualizado.")() },
    suspender: { titulo: "Suspender licença", texto: "O app bloqueia na próxima verificação online. Pode ser reativada depois.", cor: "warning", rotuloConfirmar: "Suspender", campo: { rotulo: "Motivo (exibido ao cliente)" }, acao: (v) => acao(`/licencas/${l.id}/status`, { status: "suspensa", motivo: v }, "Licença suspensa.")() },
    revogar: { titulo: "Revogar licença", texto: "Bloqueio definitivo na próxima verificação online.", cor: "error", rotuloConfirmar: "Revogar", campo: { rotulo: "Motivo (exibido ao cliente)" }, acao: (v) => acao(`/licencas/${l.id}/status`, { status: "revogada", motivo: v }, "Licença revogada.")() },
    reativar: { titulo: "Reativar licença", texto: "A licença volta a funcionar na próxima verificação online.", rotuloConfirmar: "Reativar", acao: acao(`/licencas/${l.id}/status`, { status: "ativa" }, "Licença reativada.") },
    chave: {
      titulo: "Gerar nova chave", texto: "A chave atual deixa de ativar novos computadores; os já ativados continuam. A nova chave será enviada por e-mail ao cliente.", rotuloConfirmar: "Gerar e enviar",
      acao: async () => { const r = await post(`/licencas/${l.id}/regenerar-chave`, { enviarEmail: true }); setChave(r.chave); recarregar(); },
    },
  };
  const d = dialogo && (typeof dialogo === "string" ? dialogos[dialogo] : dialogo);

  return (
    <>
      <Cabecalho
        voltar={<Button component={RouterLink} to="/licencas" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1, ml: -1 }}>Licenças</Button>}
        titulo={`Licença ${PLANOS[l.plano] || l.plano}`}
        subtitulo={<>{l.nome ? `${l.nome} · ` : ""}<Link component={RouterLink} to={`/clientes/${cliente.id}`}>{l.email}</Link></>}
        acoes={<StatusChip status={statusLicenca(l)} />}
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Chave"><span style={{ fontFamily: "JetBrains Mono, monospace" }}>GSTI-…-{l.chave_final}</span></Campo></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Validade">{validade(l.valida_ate)}</Campo></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Computadores">{ativas.length} de {l.max_maquinas}</Campo></Grid>
              <Grid size={{ xs: 6, md: 3 }}><Campo rotulo="Emitida em">{data(l.criado_em)}</Campo></Grid>
              {l.motivo_status && <Grid size={12}><Campo rotulo="Motivo da situação">{l.motivo_status}</Campo></Grid>}
              {l.observacao && <Grid size={12}><Campo rotulo="Observação">{l.observacao}</Campo></Grid>}
              <Grid size={12}><Typography variant="caption" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>id {l.id}</Typography></Grid>
            </Grid>
          </Paper>

          <Paper sx={{ p: 3, mb: 2, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Computadores</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Nome</TableCell><TableCell>Versão</TableCell><TableCell>Ativado</TableCell><TableCell>Último contato</TableCell><TableCell>Situação</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {ativacoes.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell>{a.nome_maquina || "—"}<Typography variant="caption" display="block" color="text.secondary" sx={{ fontFamily: "JetBrains Mono, monospace" }}>{a.maquina_id.slice(0, 12)}…</Typography></TableCell>
                    <TableCell>{a.app_versao || "—"}</TableCell>
                    <TableCell>{data(a.ativado_em)}</TableCell>
                    <TableCell>{dataHora(a.ultimo_contato)}</TableCell>
                    <TableCell>{a.desativado_em ? `Desvinculado ${data(a.desativado_em)}` : "Ativo"}</TableCell>
                    <TableCell align="right">
                      {!a.desativado_em && editar && (
                        <Button size="small" color="warning" onClick={() => setDialogo({ titulo: "Desvincular computador", texto: `Libera a vaga de "${a.nome_maquina || "computador"}". O app pedirá a chave novamente nele.`, cor: "warning", rotuloConfirmar: "Desvincular", acao: acao(`/ativacoes/${a.id}/desativar`, {}, "Computador desvinculado.") })}>
                          Desvincular
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {!ativacoes.length && <TableRow><TableCell colSpan={6} align="center" sx={{ color: "text.secondary", py: 3 }}>Ainda não foi ativada em nenhum computador.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>

          <Paper sx={{ p: 3, mb: 2, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Pedidos</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Tipo</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id} hover component={RouterLink} to={`/pedidos/${p.id}`} sx={{ textDecoration: "none" }}>
                    <TableCell>{dataHora(p.criado_em)}</TableCell>
                    <TableCell>{p.tipo === "renovacao" ? "Renovação" : "Compra"} · {MODALIDADES[p.modalidade]}</TableCell>
                    <TableCell align="right">{brl(p.valor_centavos)}</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                  </TableRow>
                ))}
                {!pedidos.length && <TableRow><TableCell colSpan={4} align="center" sx={{ color: "text.secondary", py: 3 }}>Emitida manualmente (sem pedido).</TableCell></TableRow>}
              </TableBody>
            </Table>
            {assinaturas.map((a) => (
              <Typography key={a.id} variant="body2" sx={{ mt: 2 }}>
                Renovação automática: <StatusChip status={a.status} /> {a.proxima_cobranca && a.status === "authorized" ? `· próxima cobrança em ${data(a.proxima_cobranca)}` : ""}
              </Typography>
            ))}
          </Paper>

          <Paper sx={{ p: 3, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Histórico</Typography>
            <Historico itens={historico} />
          </Paper>
        </Grid>

        {editar && (
          <Grid size={{ xs: 12, lg: 4 }}>
            <Paper sx={{ p: 3, position: { lg: "sticky" }, top: 88 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Ações</Typography>
              <Stack spacing={1}>
                <Button variant="outlined" onClick={() => setDialogo("estender")}>Estender validade</Button>
                {l.valida_ate && <Button variant="outlined" onClick={() => setDialogo("vitalicia")}>Tornar sem expiração</Button>}
                <Button variant="outlined" onClick={() => setDialogo("maquinas")}>Alterar limite de computadores</Button>
                <Button variant="outlined" onClick={() => setDialogo("chave")} disabled={l.status === "revogada"}>Gerar nova chave e enviar</Button>
                {l.status !== "ativa" && <Button variant="contained" onClick={() => setDialogo("reativar")}>Reativar</Button>}
                {l.status === "ativa" && <Button variant="outlined" color="warning" onClick={() => setDialogo("suspender")}>Suspender</Button>}
                {l.status !== "revogada" && <Button variant="outlined" color="error" onClick={() => setDialogo("revogar")}>Revogar</Button>}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>

      <Confirmar aberto={!!d} {...(d || {})} onFechar={() => setDialogo(null)} acao={d?.acao || (async () => {})} />
      <SegredoUnico aberto={!!chave} titulo="Nova chave gerada" rotulo="Enviada por e-mail ao cliente" valor={chave || ""} onFechar={() => setChave(null)} />
      {aviso}
    </>
  );
}
