import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Link as MuiLink, // Importa Link do MUI
} from "@mui/material";

// O prop 'onBackToLogin' será uma função para voltar à tela de login
// O prop 'onSuccessGoToReset' será uma função para ir para a tela de inserir código (opcional)
function ForgotPasswordScreen({ onBackToLogin, onSuccessGoToReset }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState({ type: "", text: "" }); // Para feedback (sucesso/erro)
  const [loading, setLoading] = useState(false);

  const handleSendRequest = async () => {
    setMessage({ type: "", text: "" }); // Limpa mensagens antigas
    setLoading(true);

    if (!email) {
      setMessage({ type: "error", text: "Por favor, preencha o seu e-mail." });
      setLoading(false);
      return;
    }

    try {
      // Chama a função do backend
      const result = await window.api.forgotPassword({ email });

      if (result.success) {
        // --- ALTERAÇÃO: Chama a função para ir para a próxima tela ---
        // Mostra uma mensagem breve antes de navegar (opcional)
        setMessage({ type: "success", text: "Verifique seu e-mail..." });
        // Chama a função passada pelo LoginScreen para mudar a view
        if (onSuccessGoToReset) {
          onSuccessGoToReset(email); // Passa o email para a próxima tela (opcional)
        }
        // Não precisa mais setar a mensagem aqui se formos navegar imediatamente
        // --- FIM ALTERAÇÃO ---
      } else {
        // Mostra um erro genérico por segurança (não confirma se o email existe)
        setMessage({
          type: "error",
          text: result.error || "Ocorreu um erro ao processar sua solicitação.",
        });
      }
    } catch (err) {
      console.error("Erro ao chamar API forgotPassword:", err);
      setMessage({
        type: "error",
        text: "Não foi possível conectar ao servidor. Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
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
          maxWidth: "450px", // Um pouco maior para o texto
        }}
      >
        <Typography component="h1" variant="h5" sx={{ mb: 1 }}>
          Recuperar Senha
        </Typography>
        <Typography
          variant="body2"
          color="textSecondary"
          sx={{ mb: 3, textAlign: "center" }}
        >
          Digite o e-mail associado à sua conta. Enviaremos um código para
          redefinição da senha.
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
          id="email"
          label="Seu E-mail"
          name="email"
          type="email" // Ajuda na validação do navegador/mobile
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
        <Button
          type="button"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2, position: "relative" }}
          onClick={handleSendRequest}
          disabled={loading}
        >
          {loading && (
            <CircularProgress
              size={24}
              color="inherit"
              sx={{ position: "absolute" }}
            />
          )}
          Enviar E-mail de Recuperação
        </Button>
        <MuiLink
          component="button" // Faz o Link se comportar como botão
          variant="body2"
          onClick={onBackToLogin} // Chama a função para voltar
          sx={{ mt: 1, cursor: "pointer" }}
          disabled={loading}
        >
          Voltar para o Login
        </MuiLink>
      </Paper>
    </Box>
  );
}

export default ForgotPasswordScreen;
