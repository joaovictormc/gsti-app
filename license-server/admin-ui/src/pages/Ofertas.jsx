import { useState } from "react";
import {
  Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, InputAdornment, Paper,
  Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import { get, put } from "../api";
import { brl, MODALIDADES, PLANOS } from "../format";
import { Cabecalho, Carregando, Erro, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";
import { ChipsModulos, DialogoModulos, SeletorModulos } from "../components/Modulos";

function EditarOferta({ oferta, catalogo, onFechar, onSalva }) {
  const [modulos, setModulos] = useState(oferta.modulos || []);
  const [f, setF] = useState(() => ({
    nome: oferta.nome, descricao: oferta.descricao || "", preco: (oferta.preco_centavos / 100).toFixed(2).replace(".", ","),
    parcelasMax: oferta.parcelas_max, maxMaquinas: oferta.max_maquinas, destaque: !!oferta.destaque, ativo: !!oferta.ativo, ordem: oferta.ordem,
  }));
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const centavos = Math.round(Number(String(f.preco).replace(/\./g, "").replace(",", ".")) * 100);

  const salvar = async () => {
    setErro("");
    if (!Number.isFinite(centavos) || centavos < 100) return setErro("Informe um preço válido.");
    setOcupado(true);
    try {
      await put(`/ofertas/${oferta.id}`, {
        nome: f.nome, descricao: f.descricao, precoCentavos: centavos, parcelasMax: Number(f.parcelasMax),
        maxMaquinas: Number(f.maxMaquinas), destaque: f.destaque, ativo: f.ativo, ordem: Number(f.ordem), modulos,
      });
      onSalva();
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };
  const campo = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });

  return (
    <Dialog open onClose={() => !ocupado && onFechar()} maxWidth="sm" fullWidth>
      <DialogTitle>{PLANOS[oferta.plano]} · {MODALIDADES[oferta.modalidade]}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nome exibido" {...campo("nome")} />
          <TextField label="Benefícios (um por linha)" multiline minRows={3} {...campo("descricao")} />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField label="Preço" fullWidth {...campo("preco")} slotProps={{ input: { startAdornment: <InputAdornment position="start">R$</InputAdornment> } }} helperText={Number.isFinite(centavos) ? brl(centavos) : " "} />
            <TextField label="Parcelas máx." type="number" fullWidth {...campo("parcelasMax")} disabled={oferta.modalidade === "assinatura"} helperText={oferta.modalidade === "assinatura" ? "Assinatura: cobrança anual" : "1 a 12"} />
            <TextField label="Computadores" type="number" fullWidth {...campo("maxMaquinas")} />
          </Stack>
          <TextField label="Ordem de exibição" type="number" {...campo("ordem")} sx={{ maxWidth: 180 }} />
          <Typography variant="subtitle2">Módulos incluídos</Typography>
          <SeletorModulos catalogo={catalogo} valor={modulos} onChange={setModulos} disabled={ocupado} />
          <FormControlLabel control={<Switch checked={f.destaque} onChange={(e) => setF({ ...f, destaque: e.target.checked })} />} label="Destacar como recomendado" />
          <FormControlLabel control={<Switch checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />} label="Disponível para venda no site" />
          <Alert severity="info">Mudanças de preço e de módulos valem para novos pedidos. Renovações automáticas já contratadas mantêm o valor original; ao renovar por um plano com mais módulos, a licença recebe os módulos novos.</Alert>
          {erro && <Alert severity="error">{erro}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" onClick={salvar} disabled={ocupado}>{ocupado ? "Salvando…" : "Salvar"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Ofertas() {
  const { pode } = useSessao();
  const [aviso, avisar] = useAviso();
  const [editando, setEditando] = useState(null);
  const [editandoTrial, setEditandoTrial] = useState(false);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/ofertas"), []);
  const editar = pode("ofertas.editar");

  return (
    <>
      <Cabecalho titulo="Planos e preços" subtitulo="O que aparece na seção de planos do site e é cobrado no Mercado Pago." />
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <>
        <Paper sx={{ p: 2.5, mb: 2, display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <Typography fontWeight={600}>Teste grátis</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Módulos liberados durante o período de teste.</Typography>
            <ChipsModulos catalogo={dados.catalogoModulos} valor={dados.modulosTrial} />
          </div>
          {editar && <Button size="small" onClick={() => setEditandoTrial(true)}>Alterar módulos</Button>}
        </Paper>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Plano</TableCell><TableCell align="right">Preço</TableCell><TableCell>Módulos</TableCell><TableCell>Pagamento</TableCell><TableCell>Computadores</TableCell><TableCell>No site</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell>
                      <Typography fontWeight={600}>{o.nome} {!!o.destaque && <Chip size="small" label="Recomendado" color="secondary" sx={{ ml: 1 }} />}</Typography>
                      <Typography variant="body2" color="text.secondary">{PLANOS[o.plano]} · {MODALIDADES[o.modalidade]}</Typography>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600 }}>{brl(o.preco_centavos)}</TableCell>
                    <TableCell sx={{ maxWidth: 280 }}><ChipsModulos catalogo={dados.catalogoModulos} valor={o.modulos} /></TableCell>
                    <TableCell>{o.modalidade === "assinatura" ? "Cartão, cobrança anual" : `Pix, boleto ou cartão até ${o.parcelas_max}x`}</TableCell>
                    <TableCell>{o.max_maquinas}</TableCell>
                    <TableCell><Chip size="small" label={o.ativo ? "Disponível" : "Oculto"} color={o.ativo ? "success" : "default"} variant={o.ativo ? "filled" : "outlined"} /></TableCell>
                    <TableCell align="right">{editar && <Button size="small" onClick={() => setEditando(o)}>Editar</Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        </>
      )}
      {editando && <EditarOferta oferta={editando} catalogo={dados.catalogoModulos} onFechar={() => setEditando(null)} onSalva={() => { setEditando(null); avisar("Plano atualizado."); recarregar(); }} />}
      {dados && (
        <DialogoModulos
          aberto={editandoTrial}
          titulo="Módulos do teste grátis"
          texto="Valem para testes iniciados a partir de agora."
          catalogo={dados.catalogoModulos}
          inicial={dados.modulosTrial}
          onFechar={() => setEditandoTrial(false)}
          onSalvar={async (modulos) => { await put("/ofertas-trial/modulos", { modulos }); avisar("Módulos do teste atualizados."); recarregar(); }}
        />
      )}
      {aviso}
    </>
  );
}
