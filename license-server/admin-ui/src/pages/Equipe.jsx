import { useState } from "react";
import {
  Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, FormGroup,
  Paper, Stack, Switch, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/PersonAddAlt";
import { get, post, put } from "../api";
import { dataHora, PAPEIS_DESC } from "../format";
import { Cabecalho, Carregando, Confirmar, Erro, SegredoUnico, useAviso, useCarregar } from "../components/comum";
import { useSessao } from "../sessao";

function FormUsuario({ usuario, papeis, onFechar, onSalvo }) {
  const novo = !usuario;
  const [f, setF] = useState({ nome: usuario?.nome || "", email: usuario?.email || "", papeis: usuario?.papeis || ["conteudo"], ativo: usuario ? usuario.ativo : true });
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const alternar = (p) => setF({ ...f, papeis: f.papeis.includes(p) ? f.papeis.filter((x) => x !== p) : [...f.papeis, p] });

  const salvar = async () => {
    setErro("");
    setOcupado(true);
    try {
      const r = novo ? await post("/usuarios", f) : await put(`/usuarios/${usuario.id}`, { nome: f.nome, papeis: f.papeis, ativo: f.ativo });
      onSalvo(r);
    } catch (e) {
      setErro(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Dialog open onClose={() => !ocupado && onFechar()} maxWidth="sm" fullWidth>
      <DialogTitle>{novo ? "Convidar pessoa" : `Editar ${usuario.nome}`}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField label="Nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} autoFocus />
          <TextField label="E-mail" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} disabled={!novo} />
          <Typography variant="subtitle2">Papéis</Typography>
          <FormGroup>
            {Object.entries(papeis).map(([k, rotulo]) => (
              <FormControlLabel key={k} control={<Checkbox checked={f.papeis.includes(k)} onChange={() => alternar(k)} />}
                label={<><Typography fontWeight={600} component="span">{rotulo}</Typography> <Typography variant="body2" color="text.secondary" component="span">— {PAPEIS_DESC[k]}</Typography></>} />
            ))}
          </FormGroup>
          {!novo && <FormControlLabel control={<Switch checked={f.ativo} onChange={(e) => setF({ ...f, ativo: e.target.checked })} />} label="Acesso ativo" />}
          {novo && <Alert severity="info">Uma senha temporária será exibida para você repassar à pessoa. Ela deve trocá-la em Minha conta.</Alert>}
          {erro && <Alert severity="error">{erro}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onFechar} disabled={ocupado}>Cancelar</Button>
        <Button variant="contained" onClick={salvar} disabled={ocupado || !f.nome || !f.email || !f.papeis.length}>{ocupado ? "Salvando…" : novo ? "Criar acesso" : "Salvar"}</Button>
      </DialogActions>
    </Dialog>
  );
}

export default function Equipe() {
  const { usuario: eu } = useSessao();
  const [aviso, avisar] = useAviso();
  const [form, setForm] = useState(null);
  const [senha, setSenha] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/usuarios"), []);

  return (
    <>
      <Cabecalho titulo="Equipe" subtitulo="Pessoas com acesso ao painel e o que cada uma pode fazer." acoes={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setForm({ novo: true })}>Convidar pessoa</Button>} />
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead><TableRow><TableCell>Pessoa</TableCell><TableCell>Papéis</TableCell><TableCell>2FA</TableCell><TableCell>Último acesso</TableCell><TableCell /></TableRow></TableHead>
              <TableBody>
                {dados.itens.map((u) => (
                  <TableRow key={u.id} sx={{ opacity: u.ativo ? 1 : 0.55 }}>
                    <TableCell><Typography fontWeight={600}>{u.nome}{u.id === eu.id ? " (você)" : ""}</Typography><Typography variant="body2" color="text.secondary">{u.email}{!u.ativo && " · acesso desativado"}</Typography></TableCell>
                    <TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>{u.papeis.map((p) => <Chip key={p} size="small" label={dados.papeis[p]} color={p === "admin" ? "primary" : "default"} />)}</Stack></TableCell>
                    <TableCell>{u.totpAtivo ? <Chip size="small" color="success" label="Ativo" /> : <Chip size="small" variant="outlined" label="Desligado" />}</TableCell>
                    <TableCell>{dataHora(u.ultimoLoginEm)}</TableCell>
                    <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                      <Button size="small" onClick={() => setForm(u)}>Editar</Button>
                      <Button size="small" onClick={() => setDialogo({ titulo: "Redefinir senha", texto: `Gera uma senha temporária para ${u.nome} e encerra as sessões abertas.`, rotuloConfirmar: "Redefinir", acao: async () => { const r = await post(`/usuarios/${u.id}/redefinir-senha`); setSenha({ nome: u.nome, valor: r.senhaTemporaria }); } })}>Senha</Button>
                      {u.totpAtivo && <Button size="small" color="warning" onClick={() => setDialogo({ titulo: "Remover 2FA", texto: `Use quando ${u.nome} perder o celular. A pessoa poderá configurar de novo.`, cor: "warning", rotuloConfirmar: "Remover", acao: async () => { await post(`/usuarios/${u.id}/resetar-2fa`); avisar("Verificação em duas etapas removida."); recarregar(); } })}>2FA</Button>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
      {form && dados && (
        <FormUsuario
          usuario={form.novo ? null : form}
          papeis={dados.papeis}
          onFechar={() => setForm(null)}
          onSalvo={(r) => { setForm(null); if (r.senhaTemporaria) setSenha({ nome: r.usuario.nome, valor: r.senhaTemporaria }); else avisar("Salvo."); recarregar(); }}
        />
      )}
      <Confirmar aberto={!!dialogo} {...(dialogo || {})} onFechar={() => setDialogo(null)} acao={dialogo?.acao || (async () => {})} />
      <SegredoUnico aberto={!!senha} titulo="Senha temporária" rotulo={`Para ${senha?.nome || ""}`} valor={senha?.valor || ""} aviso="Envie por um canal seguro. A pessoa deve trocá-la no primeiro acesso." onFechar={() => setSenha(null)} />
      {aviso}
    </>
  );
}
