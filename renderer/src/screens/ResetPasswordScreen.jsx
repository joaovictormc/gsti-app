import { useState } from "react";
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

// O prop 'onBackToLogin' volta para a tela de login
// O prop 'onSuccess' (opcional) poderia ser chamado após redefinição bem-sucedida
function ResetPasswordScreen({ onBackToLogin, onSuccess, email }) {
  const [token, setToken] = useState(""); // Armazena o código de 6 dígitos
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" }); // Para feedback
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async () => {
    setMessage({ type: "", text: "" });
    setLoading(true);

    if (!token || !password || !confirmPassword) {
      setMessage({ type: "error", text: "Todos os campos são obrigatórios." });
      setLoading(false);
      return;
    }
    if (password !== confirmPassword) {
      setMessage({ type: "error", text: "As senhas não coincidem." });
      setLoading(false);
      return;
    }
    // TODO: Adicionar validação de complexidade de senha, se desejado

    try {
      // Chama a função do backend
      const result = await window.api.resetPassword({
        token,
        password,
        confirmPassword,
      });

      if (result.success) {
        setMessage({
          type: "success",
          text: "Senha redefinida com sucesso! Você já pode fazer login com a nova senha.",
        });
        // Limpa os campos após sucesso
        setToken("");
        setPassword("");
        setConfirmPassword("");
        // Opcional: Chamar onSuccess se precisar fazer algo extra (ex: redirecionar)
        if (onSuccess) onSuccess();
        // Poderia adicionar um botão extra ou um delay para voltar ao login automaticamente
      } else {
        setMessage({
          type: "error",
          text: result.error || "Ocorreu um erro ao redefinir a senha.",
        });
      }
    } catch (err) {
      console.error("Erro ao chamar API resetPassword:", err);
      setMessage({
        type: "error",
        text: "Não foi possível conectar ao servidor. Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Permite submit com Enter
  const handleKeyPress = (event) => {
    if (event.key === "Enter" && !loading) {
      handleResetPassword();
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "var(--gsti-vh)",
        backgroundColor: "#f5f5f5",
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
          maxWidth: "450px",
        }}
      >
        <Typography component="h1" variant="h5" sx={{ mb: 1 }}>
          Redefinir Senha
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ mb: 3, textAlign: "center" }}
        >
          {/* Mostra o email se ele foi passado */}
          Digite o código de 6 dígitos enviado para{" "}
          {email ? <strong>{email}</strong> : "seu e-mail"} e sua nova senha.
        </Typography>

        {message.text && (
          <Alert
            severity={message.type || "info"}
            sx={{ width: "100%", mb: 2 }}
          >
            {message.text}
          </Alert>
        )}

        <TextField
          margin="normal"
          required
          fullWidth
          id="token"
          label="Código de 6 Dígitos"
          name="token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
          autoFocus
          inputProps={{ maxLength: 6 }} // Limita a 6 caracteres
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="password"
          label="Nova Senha"
          type="password"
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <TextField
          margin="normal"
          required
          fullWidth
          name="confirmPassword"
          label="Confirmar Nova Senha"
          type="password"
          id="confirmPassword"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={loading}
        />
        <Button
          type="button"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2, position: "relative" }}
          onClick={handleResetPassword}
          disabled={loading}
        >
          {loading && (
            <CircularProgress
              size={24}
              color="inherit"
              sx={{ position: "absolute" }}
            />
          )}
          Redefinir Senha
        </Button>
        {/* Mostra o link para voltar APENAS se a senha NÃO foi redefinida com sucesso */}
        {message.type !== "success" && (
          <MuiLink
            component="button"
            variant="body2"
            onClick={onBackToLogin}
            sx={{ mt: 1, cursor: "pointer" }}
            disabled={loading}
          >
            Voltar para o Login
          </MuiLink>
        )}
        {/* Mostra o link para voltar DEPOIS do sucesso */}
        {message.type === "success" && (
          <MuiLink
            component="button"
            variant="body2"
            onClick={onBackToLogin}
            sx={{ mt: 1, cursor: "pointer" }}
          >
            Ir para o Login
          </MuiLink>
        )}
      </Paper>
    </Box>
  );
}

export default ResetPasswordScreen;
