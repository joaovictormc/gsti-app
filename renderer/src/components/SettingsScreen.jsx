import { useState, useEffect, useCallback } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Stack,
  FormControlLabel,
  Checkbox,
  Grid,
} from "@mui/material";
import { useAuth } from "../contexts/AuthContext"; // Para verificar se é admin

function SettingsScreen() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState({
    // Estado para guardar todas as configurações
    email: { host: "", port: 587, secure: false, user: "", pass: "", from: "" },
    branding: { companyName: "", logoPath: null },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState({
    type: "",
    text: "",
  });
  const [saveStatus, setSaveStatus] = useState({ type: "", text: "" });

  // Busca as configurações atuais ao carregar
  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setSaveStatus({ type: "", text: "" }); // Limpa status de salvamento
      setTestEmailStatus({ type: "", text: "" }); // Limpa status de teste
      try {
        const result = await window.api.getAppSettings();
        if (result.success && result.settings) {
          // Mescla com um objeto padrão para garantir que todos os campos existam
          const defaultEmail = {
            host: "",
            port: 587,
            secure: false,
            user: "",
            pass: "",
            from: "",
          };
          const defaultBranding = { companyName: "GSTI App", logoPath: null }; // Default name aqui também
          setSettings({
            email: { ...defaultEmail, ...(result.settings.email || {}) },
            branding: {
              ...defaultBranding,
              ...(result.settings.branding || {}),
            },
          });
        } else {
          console.error("Erro ao carregar configurações:", result?.error);
          setSaveStatus({
            type: "error",
            text: "Erro ao carregar configurações.",
          });
        }
      } catch (error) {
        console.error("Erro API getAppSettings:", error);
        setSaveStatus({
          type: "error",
          text: "Erro ao conectar com backend para carregar configurações.",
        });
      } finally {
        setLoading(false);
      }
    };
    loadSettings();
  }, []); // Roda só uma vez ao montar

  // Handler genérico para mudanças nos inputs
  const handleInputChange = useCallback((section, field, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
    // Limpa mensagens de status ao editar
    setSaveStatus({ type: "", text: "" });
    setTestEmailStatus({ type: "", text: "" });
  }, []);

  // Handler específico para o Checkbox 'secure'
  const handleSecureChange = (event) => {
    handleInputChange("email", "secure", event.target.checked);
  };

  // Função para testar as configurações de email
  const handleTestEmail = async () => {
    setTestingEmail(true);
    setTestEmailStatus({ type: "", text: "" });
    try {
      // Passa apenas a seção de email para a API
      const result = await window.api.testEmailSettings(settings.email);
      if (result.success) {
        setTestEmailStatus({
          type: "success",
          text: "E-mail de teste enviado com sucesso! Verifique a caixa de entrada do remetente.",
        });
      } else {
        setTestEmailStatus({
          type: "error",
          text: `Falha no teste: ${result.error || "Erro desconhecido"}`,
        });
      }
    } catch (error) {
      setTestEmailStatus({
        type: "error",
        text: `Erro ao chamar API de teste: ${error.message}`,
      });
    } finally {
      setTestingEmail(false);
    }
  };

  // Função para salvar todas as configurações
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveStatus({ type: "", text: "" });
    try {
      // Passa o objeto completo (ou apenas as seções que podem ser alteradas)
      const settingsToSave = {
        email: settings.email,
        branding: settings.branding,
      };
      const result = await window.api.saveAppSettings(settingsToSave);
      if (result.success) {
        setSaveStatus({
          type: "success",
          text: "Configurações salvas com sucesso!",
        });
      } else {
        setSaveStatus({
          type: "error",
          text: `Erro ao salvar: ${result.error || "Erro desconhecido"}`,
        });
      }
    } catch (error) {
      setSaveStatus({
        type: "error",
        text: `Erro ao chamar API de salvar: ${error.message}`,
      });
    } finally {
      setSaving(false);
    }
  };

  // --- NOVA FUNÇÃO: Selecionar Logo ---
  const handleSelectLogo = async () => {
    // Limpa mensagens
    setSaveStatus({ type: "", text: "" });
    setTestEmailStatus({ type: "", text: "" });
    try {
      // Chama uma nova função do backend (que criaremos depois)
      const result = await window.api.selectLogoFile();
      if (result.success && result.filePath) {
        // Atualiza o estado apenas com o caminho do arquivo selecionado
        handleInputChange("branding", "logoPath", result.filePath);
        setSaveStatus({
          type: "info",
          text: `Nova logo selecionada: ${result.filePath}. Clique em Salvar para aplicar.`,
        });
      } else if (result.error) {
        setSaveStatus({
          type: "warning",
          text: `Seleção de logo: ${result.error}`,
        });
      }
      // Se o usuário cancelou (result.filePath é null ou undefined), não faz nada
    } catch (error) {
      console.error("Erro ao chamar API selectLogoFile:", error);
      setSaveStatus({
        type: "error",
        text: "Erro ao tentar selecionar arquivo de logo.",
      });
    }
  };
  // --- FIM NOVA FUNÇÃO ---

  // Segurança: Apenas Admin pode ver esta tela
  if (currentUser?.role !== "Admin") {
    return (
      <Typography color="error">
        Acesso negado. Apenas administradores podem acessar as configurações.
      </Typography>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <>
      <Typography variant="h4" gutterBottom>
        Configurações da Aplicação
      </Typography>

      {/* --- Seção de Configuração de E-mail --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Configuração de E-mail (SMTP)
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Configure um servidor SMTP (Ex: Brevo, Gmail com Senha de App) para
          enviar e-mails de recuperação de senha.
        </Typography>

        {testEmailStatus.text && (
          <Alert
            severity={testEmailStatus.type || "info"}
            sx={{ mb: 2 }}
            onClose={() => setTestEmailStatus({ type: "", text: "" })}
          >
            {testEmailStatus.text}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} sm={8}>
            <TextField
              label="Servidor SMTP (Host)"
              name="host"
              value={settings.email.host}
              onChange={(e) =>
                handleInputChange("email", "host", e.target.value)
              }
              fullWidth
              margin="dense"
              size="small"
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <TextField
              label="Porta"
              name="port"
              type="number"
              value={settings.email.port}
              onChange={(e) =>
                handleInputChange("email", "port", e.target.value)
              }
              fullWidth
              margin="dense"
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Usuário SMTP (Email)"
              name="user"
              type="email"
              value={settings.email.user}
              onChange={(e) =>
                handleInputChange("email", "user", e.target.value)
              }
              fullWidth
              margin="dense"
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              label="Senha SMTP / Chave API"
              name="pass"
              type="password"
              value={settings.email.pass} // Mostra vazio por segurança (vem vazio do backend)
              onChange={(e) =>
                handleInputChange("email", "pass", e.target.value)
              }
              fullWidth
              margin="dense"
              size="small"
              helperText="Deixe em branco se não quiser alterar"
            />
          </Grid>
          <Grid item xs={12} sm={8}>
            <TextField
              label="E-mail Remetente (Verificado)"
              name="from"
              type="email"
              value={settings.email.from}
              onChange={(e) =>
                handleInputChange("email", "from", e.target.value)
              }
              fullWidth
              margin="dense"
              size="small"
            />
          </Grid>
          <Grid
            item
            xs={6}
            sm={4}
            sx={{ display: "flex", alignItems: "center" }}
          >
            <FormControlLabel
              control={
                <Checkbox
                  name="secure"
                  checked={settings.email.secure}
                  onChange={handleSecureChange}
                />
              }
              label="Usar SSL/TLS (Secure)"
              sx={{ ml: 1 }}
            />
            <Typography variant="caption">(Marque para porta 465)</Typography>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
          <Button
            variant="outlined"
            onClick={handleTestEmail}
            disabled={testingEmail || saving}
            startIcon={
              testingEmail ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
          >
            Testar Envio
          </Button>
        </Box>
      </Paper>

      {/* --- NOVA SEÇÃO: Whitelabeling --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Personalização (Whitelabel)
        </Typography>
        <TextField
          label="Nome da Empresa"
          name="companyName"
          value={settings.branding.companyName}
          onChange={(e) =>
            handleInputChange("branding", "companyName", e.target.value)
          }
          fullWidth
          margin="normal"
          size="small" // Ajustado margin/size
          disabled={saving || testingEmail}
        />
        <Box sx={{ mt: 2, display: "flex", alignItems: "center", gap: 2 }}>
          <Button
            variant="outlined"
            onClick={handleSelectLogo}
            disabled={saving || testingEmail}
          >
            Selecionar Logo da Empresa
          </Button>
          {/* Mostra o caminho da logo selecionada (ou a salva) */}
          {settings.branding.logoPath && (
            <Typography
              variant="caption"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Logo atual: {settings.branding.logoPath}
            </Typography>
          )}
          {!settings.branding.logoPath && (
            <Typography variant="caption" color="textSecondary">
              Nenhuma logo definida.
            </Typography>
          )}
        </Box>
        <Typography
          variant="caption"
          sx={{ display: "block", mt: 1 }}
          color="textSecondary"
        >
          * A logo será exibida na Sidebar e futuramente nos PDFs. Use um
          formato comum (PNG, JPG).
        </Typography>
      </Paper>
      {/* --- FIM NOVA SEÇÃO --- */}

      {/* --- Botão Salvar Geral --- */}
      {saveStatus.text && (
        <Alert
          severity={saveStatus.type || "info"}
          sx={{ mb: 2 }}
          onClose={() => setSaveStatus({ type: "", text: "" })}
        >
          {saveStatus.text}
        </Alert>
      )}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 3 }}>
        <Button
          variant="contained"
          color="primary"
          onClick={handleSaveSettings}
          disabled={saving || testingEmail} // Desabilita enquanto salva ou testa
          startIcon={
            saving ? <CircularProgress size={20} color="inherit" /> : null
          }
        >
          Salvar Todas as Configurações
        </Button>
      </Box>
    </>
  );
}

export default SettingsScreen;
