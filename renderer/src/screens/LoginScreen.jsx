import { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Link as MuiLink,
} from "@mui/material";
import ForgotPasswordScreen from "./ForgotPasswordScreen";
import ResetPasswordScreen from "./ResetPasswordScreen";

// O prop 'onLoginSuccess' será uma função passada pelo App.jsx (ou quem gerencia o estado global)
// para informar que o login foi bem-sucedido e passar os dados do usuário.
function LoginScreen({ onLoginSuccess }) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("login"); // 'login', 'forgot', 'reset'
  const [emailForReset, setEmailForReset] = useState(""); // Guarda o email para passar para ResetPasswordScreen

  // --- NOVO ESTADO para controlar a tela ---
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  // --- FIM NOVO ESTADO ---

  // --- Imagem de fundo configurável (whitelabel) ---
  const [backgroundImage, setBackgroundImage] = useState(null);

  useEffect(() => {
    let mounted = true;
    const loadBackground = async () => {
      try {
        const result = await window.api.getAppSettings();
        const bgPath = result?.settings?.branding?.backgroundPath;
        if (!bgPath) return;
        const img = await window.api.loadBackgroundImage(bgPath);
        if (mounted && img?.success && img.imageData) {
          setBackgroundImage(img.imageData);
        }
      } catch (err) {
        console.error("Erro ao carregar imagem de fundo do login:", err);
      }
    };
    loadBackground();
    return () => {
      mounted = false;
    };
  }, []);

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

  // --- Função para navegar para ForgotPassword ---
  const navigateToForgotPassword = () => {
    setError("");
    setViewMode("forgot");
  };

  const handleSuccessAndGoToReset = (email) => {
    setEmailForReset(email); // Guarda o email (opcional)
    setViewMode("reset"); // Muda a view para a tela de reset
  };

  // --- Função para voltar do ForgotPassword ---
  const navigateBackToLogin = () => {
    setError("");
    setViewMode("login");
    setEmailForReset("");
  };

  // Renderiza condicionalmente
  if (viewMode === "forgot") {
    // Passa a nova função handleSuccessAndGoToReset
    return (
      <ForgotPasswordScreen
        onBackToLogin={navigateBackToLogin}
        onSuccessGoToReset={handleSuccessAndGoToReset}
      />
    );
  }
  if (viewMode === "reset") {
    // Passa a função para voltar ao login e opcionalmente o email
    return (
      <ResetPasswordScreen
        onBackToLogin={navigateBackToLogin}
        onSuccess={navigateBackToLogin}
        email={emailForReset}
      />
    );
  }

  // Senão, renderiza a tela de login normal

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        ...(backgroundImage
          ? {
              backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.55), rgba(15, 23, 42, 0.55)), url(${backgroundImage})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : {
              background: "linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)",
            }),
      }}
    >
      <Paper
        elevation={8}
        sx={{
          padding: 4,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
          maxWidth: "420px",
          borderRadius: 3,
          bgcolor: "background.paper",
        }}
      >
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 2,
            bgcolor: "primary.main",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <Typography variant="h5" sx={{ color: "white", fontWeight: 700 }}>
            G
          </Typography>
        </Box>
        <Typography component="h1" variant="h5" sx={{ mb: 0.5, fontWeight: 700 }}>
          GSTI App
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Faça login para continuar
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

        {/* --- LINK PARA ESQUECI SENHA --- */}
        <MuiLink
          component="button"
          variant="body2"
          onClick={navigateToForgotPassword}
          sx={{ cursor: "pointer", mt: 1 }}
          disabled={loading}
        >
          Esqueceu sua senha?
        </MuiLink>
        {/* --- FIM DO LINK --- */}
      </Paper>
    </Box>
  );
}

export default LoginScreen;
