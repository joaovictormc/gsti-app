import { useState } from "react";
import { Alert, Box, Button, Chip, Grid, Paper, Stack, TextField, Typography } from "@mui/material";
import { post } from "../api";
import { Cabecalho, useAviso } from "../components/comum";
import { useSessao } from "../sessao";

function TrocarSenha({ avisar }) {
  const [f, setF] = useState({ senhaAtual: "", novaSenha: "", confirmar: "" });
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro("");
    if (f.novaSenha !== f.confirmar) return setErro("As senhas não coincidem.");
    setOcupado(true);
    try {
      await post("/me/senha", { senhaAtual: f.senhaAtual, novaSenha: f.novaSenha });
      setF({ senhaAtual: "", novaSenha: "", confirmar: "" });
      avisar("Senha alterada.");
    } catch (err) {
      setErro(err.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Paper component="form" onSubmit={enviar} sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Senha</Typography>
      <Stack spacing={2}>
        <TextField label="Senha atual" type="password" autoComplete="current-password" value={f.senhaAtual} onChange={(e) => setF({ ...f, senhaAtual: e.target.value })} />
        <TextField label="Nova senha" type="password" autoComplete="new-password" value={f.novaSenha} onChange={(e) => setF({ ...f, novaSenha: e.target.value })} helperText="Mínimo de 10 caracteres, com letras e números." />
        <TextField label="Confirmar nova senha" type="password" autoComplete="new-password" value={f.confirmar} onChange={(e) => setF({ ...f, confirmar: e.target.value })} />
        {erro && <Alert severity="error">{erro}</Alert>}
        <Button type="submit" variant="contained" disabled={ocupado || !f.senhaAtual || !f.novaSenha} sx={{ alignSelf: "flex-start" }}>Alterar senha</Button>
      </Stack>
    </Paper>
  );
}

function DoisFatores({ ativo, onMudou, avisar }) {
  const [config, setConfig] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [senha, setSenha] = useState("");
  const [desativando, setDesativando] = useState(false);
  const [erro, setErro] = useState("");

  const executar = (fn) => async () => {
    setErro("");
    try {
      await fn();
    } catch (e) {
      setErro(e.message);
    }
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="h6">Verificação em duas etapas</Typography>
        <Chip size="small" label={ativo ? "Ativa" : "Desligada"} color={ativo ? "success" : "default"} />
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pede um código do celular (Google Authenticator, Authy, 1Password…) ao entrar. Recomendado para quem gerencia pagamentos e licenças.
      </Typography>

      {!ativo && !config && <Button variant="contained" onClick={executar(async () => setConfig(await post("/me/2fa/iniciar")))}>Configurar</Button>}

      {!ativo && config && (
        <Stack spacing={2}>
          <Typography variant="body2">1. Escaneie o QR code no aplicativo autenticador:</Typography>
          <Box sx={{ width: 220, height: 220, bgcolor: "#fff", p: 1, borderRadius: 2, border: "1px solid", borderColor: "divider", "& svg": { width: "100%", height: "100%" } }} dangerouslySetInnerHTML={{ __html: config.qrSvg }} />
          <Typography variant="caption" color="text.secondary">Ou digite a chave: <Box component="span" sx={{ fontFamily: "JetBrains Mono, monospace", wordBreak: "break-all" }}>{config.segredo}</Box></Typography>
          <Typography variant="body2">2. Digite o código de 6 dígitos gerado:</Typography>
          <Stack direction="row" spacing={1}>
            <TextField value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" slotProps={{ htmlInput: { inputMode: "numeric", style: { fontFamily: "JetBrains Mono, monospace", letterSpacing: "0.3em" } } }} />
            <Button variant="contained" disabled={codigo.length !== 6} onClick={executar(async () => { await post("/me/2fa/confirmar", { codigo }); setConfig(null); setCodigo(""); avisar("Verificação em duas etapas ativada."); onMudou(); })}>Ativar</Button>
          </Stack>
        </Stack>
      )}

      {ativo && !desativando && <Button color="warning" variant="outlined" onClick={() => setDesativando(true)}>Desativar</Button>}
      {ativo && desativando && (
        <Stack spacing={2}>
          <TextField label="Senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          <TextField label="Código do aplicativo" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))} />
          <Stack direction="row" spacing={1}>
            <Button onClick={() => setDesativando(false)}>Cancelar</Button>
            <Button color="warning" variant="contained" disabled={!senha || codigo.length !== 6} onClick={executar(async () => { await post("/me/2fa/desativar", { senha, codigo }); setDesativando(false); setSenha(""); setCodigo(""); avisar("Verificação em duas etapas desativada."); onMudou(); })}>Confirmar</Button>
          </Stack>
        </Stack>
      )}
      {erro && <Alert severity="error" sx={{ mt: 2 }}>{erro}</Alert>}
    </Paper>
  );
}

export default function MinhaConta() {
  const { usuario, papeis, recarregar } = useSessao();
  const [aviso, avisar] = useAviso();
  return (
    <>
      <Cabecalho titulo="Minha conta" subtitulo={`${usuario.email} · ${usuario.papeis.map((p) => papeis[p]).join(", ")}`} />
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><TrocarSenha avisar={avisar} /></Grid>
        <Grid size={{ xs: 12, md: 6 }}><DoisFatores ativo={usuario.totpAtivo} onMudou={recarregar} avisar={avisar} /></Grid>
      </Grid>
      {aviso}
    </>
  );
}
