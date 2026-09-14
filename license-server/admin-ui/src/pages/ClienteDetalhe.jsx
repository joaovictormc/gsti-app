import { useEffect, useState } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import { Alert, Button, Grid, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { get, post, put } from "../api";
import { brl, data, dataHora, MODALIDADES, PLANOS, validade } from "../format";
import { Cabecalho, Carregando, Confirmar, Erro, StatusChip, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";
import { statusLicenca } from "./Licencas";

export default function ClienteDetalhe() {
  const { id } = useParams();
  const { pode } = useSessao();
  const [aviso, avisar] = useAviso();
  const [form, setForm] = useState(null);
  const [erroForm, setErroForm] = useState("");
  const [confirmarLink, setConfirmarLink] = useState(false);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get(`/clientes/${id}`), [id]);

  useEffect(() => {
    if (dados) setForm({ nome: dados.cliente.nome || "", documento: dados.cliente.documento || "", telefone: dados.cliente.telefone || "" });
  }, [dados]);

  if (carregando) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;
  const { cliente: c, licencas, pedidos } = dados;
  const editar = pode("clientes.editar");

  const salvar = async (e) => {
    e.preventDefault();
    setErroForm("");
    try {
      await put(`/clientes/${c.id}`, form);
      avisar("Dados salvos.");
      recarregar();
    } catch (err) {
      setErroForm(err.message);
    }
  };

  return (
    <>
      <Cabecalho
        voltar={<Button component={RouterLink} to="/clientes" startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1, ml: -1 }}>Clientes</Button>}
        titulo={c.nome || c.email}
        subtitulo={`${c.email} · cliente desde ${data(c.criado_em)}`}
        acoes={editar && <Button variant="outlined" onClick={() => setConfirmarLink(true)}>Enviar link do portal</Button>}
      />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3, mb: 2, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Licenças</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Plano</TableCell><TableCell>Chave</TableCell><TableCell>Validade</TableCell><TableCell>Computadores</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
              <TableBody>
                {licencas.map((l) => (
                  <TableRow key={l.id} hover component={RouterLink} to={`/licencas/${l.id}`} sx={{ textDecoration: "none" }}>
                    <TableCell>{PLANOS[l.plano] || l.plano}</TableCell>
                    <TableCell sx={{ fontFamily: "JetBrains Mono, monospace", whiteSpace: "nowrap" }}>…{l.chave_final}</TableCell>
                    <TableCell>{validade(l.valida_ate)}</TableCell>
                    <TableCell>{l.maquinas} / {l.max_maquinas}</TableCell>
                    <TableCell><StatusChip status={statusLicenca(l)} /></TableCell>
                  </TableRow>
                ))}
                {!licencas.length && <TableRow><TableCell colSpan={5} align="center" sx={{ color: "text.secondary", py: 3 }}>Nenhuma licença.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
          <Paper sx={{ p: 3, overflowX: "auto" }}>
            <Typography variant="h6" sx={{ mb: 1 }}>Pedidos</Typography>
            <Table size="small">
              <TableHead><TableRow><TableCell>Data</TableCell><TableCell>Descrição</TableCell><TableCell align="right">Valor</TableCell><TableCell>Situação</TableCell></TableRow></TableHead>
              <TableBody>
                {pedidos.map((p) => (
                  <TableRow key={p.id} hover component={RouterLink} to={`/pedidos/${p.id}`} sx={{ textDecoration: "none" }}>
                    <TableCell>{dataHora(p.criado_em)}</TableCell>
                    <TableCell>{p.tipo === "renovacao" ? "Renovação" : "Licença"} {PLANOS[p.plano]} · {MODALIDADES[p.modalidade]}</TableCell>
                    <TableCell align="right">{brl(p.valor_centavos)}</TableCell>
                    <TableCell><StatusChip status={p.status} /></TableCell>
                  </TableRow>
                ))}
                {!pedidos.length && <TableRow><TableCell colSpan={4} align="center" sx={{ color: "text.secondary", py: 3 }}>Nenhum pedido.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          {form && (
            <Paper component="form" onSubmit={salvar} sx={{ p: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Dados</Typography>
              <Stack spacing={2}>
                <TextField label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} disabled={!editar} />
                <TextField label="CPF / CNPJ" value={form.documento} onChange={(e) => setForm({ ...form, documento: e.target.value })} disabled={!editar} />
                <TextField label="Telefone" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} disabled={!editar} />
                <TextField label="E-mail" value={c.email} disabled helperText="O e-mail identifica o cliente e não pode ser alterado." />
                {erroForm && <Alert severity="error">{erroForm}</Alert>}
                {editar && <Button type="submit" variant="contained">Salvar</Button>}
              </Stack>
            </Paper>
          )}
        </Grid>
      </Grid>
      <Confirmar
        aberto={confirmarLink}
        titulo="Enviar link do portal"
        texto={`Envia para ${c.email} um link de acesso ao portal do cliente (válido por 30 minutos).`}
        rotuloConfirmar="Enviar"
        onFechar={() => setConfirmarLink(false)}
        acao={async () => { await post(`/clientes/${c.id}/link-acesso`); avisar("Link enviado."); }}
      />
      {aviso}
    </>
  );
}
