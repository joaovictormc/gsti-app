import { useState } from "react";
import { Alert, Box, Button, Chip, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from "@mui/material";
import SettingsIcon from "@mui/icons-material/TuneOutlined";
import ConfigCredenciais from "./ConfigCredenciais";
import { get, post } from "../api";
import { dataHora } from "../format";
import { Cabecalho, Carregando, Erro, StatusChip, useAviso, useCarregar } from "../components/comum";

function Item({ rotulo, ok, detalhe }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography fontWeight={600}>{rotulo}</Typography>
        <Chip size="small" label={ok ? "OK" : "Pendente"} color={ok ? "success" : "warning"} />
      </Stack>
      <Typography variant="body2" color="text.secondary" component="div">{detalhe}</Typography>
    </Paper>
  );
}

const mono = { fontFamily: "JetBrains Mono, monospace", fontSize: 13, wordBreak: "break-all" };

export default function Sistema() {
  const [aviso, avisar] = useAviso();
  const [config, setConfig] = useState(false);
  const [testando, setTestando] = useState(false);
  const { dados: s, erro, carregando, recarregar } = useCarregar(() => get("/sistema"), []);
  if (carregando) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;

  const reprocessar = async (id) => {
    try {
      const r = await post(`/sistema/eventos/${id}/reprocessar`);
      avisar(r.evento.erro ? `Falhou de novo: ${r.evento.erro}` : "Evento processado.", r.evento.erro ? "error" : "success");
      recarregar();
    } catch (e) {
      avisar(e.message, "error");
    }
  };

  const enviarTeste = async () => {
    setTestando(true);
    try {
      const r = await post("/sistema/email-teste");
      avisar(`E-mail de teste enviado para ${r.para}.`);
    } catch (e) {
      avisar(e.message, "error");
    } finally {
      setTestando(false);
    }
  };

  return (
    <>
      <Cabecalho
        titulo="Sistema"
        subtitulo={`Plataforma v${s.versao} · ${s.publicUrl}`}
        acoes={<>
          {s.podeConfigurar && <Button variant="contained" startIcon={<SettingsIcon />} onClick={() => setConfig(true)}>Configurar credenciais</Button>}
          <Button variant="outlined" onClick={recarregar}>Atualizar</Button>
        </>}
      />
      {s.podeConfigurar && (
        <Alert severity="info" sx={{ mb: 2 }} action={s.smtp.configurado && <Button color="inherit" size="small" onClick={enviarTeste} disabled={testando}>{testando ? "Enviando…" : "Enviar e-mail de teste"}</Button>}>
          Mercado Pago e e-mail podem ser configurados aqui pelo painel (guardados cifrados no servidor) ou por variáveis de ambiente — nesse caso, o servidor tem prioridade.
        </Alert>
      )}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Item
            rotulo="Mercado Pago"
            ok={s.mercadoPago.configurado && !s.mercadoPago.simulador}
            detalhe={s.mercadoPago.simulador ? `SIMULADOR de homologação (${s.mercadoPago.simulador})` : s.mercadoPago.configurado ? `Credenciais ${s.mercadoPago.sandbox ? "de TESTE (sandbox)" : "de produção"}` : "Defina MP_ACCESS_TOKEN"}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Item rotulo="Webhook" ok={s.mercadoPago.assinaturaWebhook} detalhe={<><Box sx={mono}>{s.webhookUrl}</Box>{!s.mercadoPago.assinaturaWebhook && "Defina MP_WEBHOOK_SECRET"}</>} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Item rotulo="E-mail (SMTP)" ok={s.smtp.configurado} detalhe={s.smtp.configurado ? `Remetente: ${s.smtp.remetente}` : "Defina SMTP_HOST, SMTP_USER e SMTP_PASS"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <Item rotulo="Chaves de licença" ok={s.chaves.length > 0} detalhe={<>Assinando com <Box component="span" sx={mono}>{s.chaveAtiva}</Box>{s.chaves.length > 1 && ` · aceitas: ${s.chaves.join(", ")}`}</>} />
        </Grid>
        <Grid size={12}>
          {!/^https:/.test(s.publicUrl) && <Alert severity="warning">PUBLIC_URL não usa HTTPS: o Mercado Pago não envia notificações para este endereço. A conciliação automática (a cada 30 min) continua funcionando.</Alert>}
        </Grid>
      </Grid>

      <Typography variant="h6" sx={{ mb: 1 }}>Notificações do Mercado Pago</Typography>
      <Paper sx={{ mb: 3 }}>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Recebido</TableCell><TableCell>Tipo</TableCell><TableCell>Recurso</TableCell><TableCell>Situação</TableCell><TableCell /></TableRow></TableHead>
            <TableBody>
              {s.eventos.map((e) => (
                <TableRow key={e.id}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dataHora(e.recebido_em)}</TableCell>
                  <TableCell>{e.tipo}<Typography variant="caption" display="block" color="text.secondary">{e.acao}</Typography></TableCell>
                  <TableCell sx={mono}>{e.recurso_id}</TableCell>
                  <TableCell>
                    {e.processado_em && !e.erro ? <Chip size="small" color="success" label="Processado" /> : e.erro ? <Chip size="small" color="error" label={`Erro (${e.tentativas}x)`} /> : <Chip size="small" color="warning" label="Na fila" />}
                    {e.erro && <Typography variant="caption" display="block" color="error">{e.erro}</Typography>}
                  </TableCell>
                  <TableCell align="right">{(e.erro || !e.processado_em) && <Button size="small" onClick={() => reprocessar(e.id)}>Reprocessar</Button>}</TableCell>
                </TableRow>
              ))}
              {!s.eventos.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: "text.secondary" }}>Nenhuma notificação recebida.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Typography variant="h6" sx={{ mb: 1 }}>E-mails enviados</Typography>
      <Paper>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell>Quando</TableCell><TableCell>Para</TableCell><TableCell>Assunto</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
            <TableBody>
              {s.emails.map((m) => (
                <TableRow key={m.id}>
                  <TableCell sx={{ whiteSpace: "nowrap" }}>{dataHora(m.criado_em)}</TableCell>
                  <TableCell>{m.para}</TableCell>
                  <TableCell>{m.assunto}</TableCell>
                  <TableCell><StatusChip status={m.status} />{m.erro && <Typography variant="caption" display="block" color="error">{m.erro}</Typography>}</TableCell>
                </TableRow>
              ))}
              {!s.emails.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4, color: "text.secondary" }}>Nenhum e-mail enviado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      <ConfigCredenciais aberto={config} onFechar={() => setConfig(false)} onSalvo={recarregar} />
      {aviso}
    </>
  );
}
