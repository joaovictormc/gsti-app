import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";

// O prop 'onLoginSuccess' será uma função passada pelo App.jsx (ou quem gerencia o estado global)
// para informar que o login foi bem-sucedido e passar os dados do usuário.
function LoginScreen({ onLoginSuccess }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError(""); // Limpa erros antigos
    setLoading(true);

    if (!login || !password) {
      setError("Por favor, preencha o login e a senha.");
      setLoading(false);
      return;
    }

    try {
      const result = await window.api.login({ login, password });

      if (result.success && result.user) {
        // Chama a função passada como prop para atualizar o estado global
        onLoginSuccess(result.user);
      } else {
        setError(result.error || "Erro desconhecido durante o login.");
      }
    } catch (err) {
      console.error("Erro ao chamar API de login:", err);
      setError("Não foi possível conectar ao servidor de autenticação.");
    } finally {
      setLoading(false);
    }
  };

  // Permite login com Enter
  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !loading) {
      handleLogin();
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh", // Ocupa a tela inteira
        backgroundColor: "#f5f5f5", // Um fundo suave
      }}
    >
      <Paper
        elevation={3}
        sx={{
          padding: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: "400px", // Limita a largura do formulário
        }}
      >
        <Typography component="h1" variant="h5" sx={{ mb: 3 }}>
          Login - GSTI App
        </Typography>

        {error && (
          <Alert severity="error" sx={{ width: "100%", mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          margin="normal"
          required
          fullWidth
          id="login"
          label="Login"
          name="login"
          autoComplete="username"
          autoFocus
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          onKeyPress={handleKeyPress} // Adiciona listener de tecla
          disabled={loading}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Senha"
          type="password"
          id="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handleKeyPress} // Adiciona listener de tecla
          disabled={loading}
        />
        <Button
          type="button" // Evita submit de formulário padrão
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2, position: "relative" }}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading && (
            <CircularProgress
              size={24}
              color="inherit"
              sx={{
                position: "absolute",
                top: "50%",
                left: "50%",
                marginTop: "-12px",
                marginLeft: "-12px",
              }}
            />
          )}
          Entrar
        </Button>
      </Paper>
    </Box>
  );
}

export default LoginScreen;
