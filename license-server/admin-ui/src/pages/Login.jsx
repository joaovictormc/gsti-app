import { useState } from "react";
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from "@mui/material";
import { post } from "../api";
import { useSessao } from "../sessao";

export default function Login() {
  const { recarregar } = useSessao();
  const [etapa, setEtapa] = useState("senha");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const enviar = async (e) => {
    e.preventDefault();
    setErro("");
    setOcupado(true);
    try {
      if (etapa === "senha") {
        const r = await post("/login", { email, senha });
        if (r.precisa2fa) {
          setEtapa("2fa");
          return;
        }
      } else {
        await post("/login/2fa", { codigo });
      }
      await recarregar();
    } catch (err) {
      setErro(err.message);
      if (err.codigo === "SESSAO") { setEtapa("senha"); setCodigo(""); }
    } finally {
      setOcupado(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "grid", placeItems: "center", p: 2, bgcolor: "#10213a" }}>
      <Paper component="form" onSubmit={enviar} sx={{ p: { xs: 3, sm: 5 }, width: "100%", maxWidth: 420, border: "none" }}>
        <Typography variant="overline" color="text.secondary">GSTI App · Painel</Typography>
        <Typography variant="h4" component="h1" sx={{ mb: 1 }}>{etapa === "senha" ? "Entrar" : "Verificação em duas etapas"}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {etapa === "senha" ? "Acesso restrito à equipe." : "Digite o código de 6 dígitos do seu aplicativo autenticador."}
        </Typography>
        <Stack spacing={2}>
          {etapa === "senha" ? (
            <>
              <TextField label="E-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus size="medium" />
              <TextField label="Senha" type="password" autoComplete="current-password" value={senha} onChange={(e) => setSenha(e.target.value)} required size="medium" />
            </>
          ) : (
            <TextField
              label="Código"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, "").slice(0, 6))}
              autoFocus
              size="medium"
              slotProps={{ htmlInput: { inputMode: "numeric", autoComplete: "one-time-code", style: { letterSpacing: "0.4em", fontSize: 22, fontFamily: "JetBrains Mono, monospace" } } }}
            />
          )}
          {erro && <Alert severity="error">{erro}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={ocupado || (etapa === "2fa" && codigo.length !== 6)}>
            {ocupado ? "Entrando…" : etapa === "senha" ? "Entrar" : "Confirmar"}
          </Button>
          {etapa === "2fa" && <Button onClick={() => { setEtapa("senha"); setCodigo(""); setErro(""); }}>Voltar</Button>}
        </Stack>
      </Paper>
    </Box>
  );
}
