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
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Select,
  InputLabel,
  FormControl as MuiFormControl,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ToggleButtonGroup,
  ToggleButton,
  Chip,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@mui/material";
import BackupIcon from "@mui/icons-material/Backup";
import RestoreIcon from "@mui/icons-material/Restore";
import StorageIcon from "@mui/icons-material/Storage";
import NotificationsIcon from "@mui/icons-material/Notifications";
import LockPersonIcon from "@mui/icons-material/LockPerson";
import SchoolIcon from "@mui/icons-material/School";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import Switch from "@mui/material/Switch";
import { useAuth } from "../contexts/AuthContext"; // Para verificar se é admin
import { PERFIS_CONFIGURAVEIS, PERMISSOES } from "../constants/perfis";

// Pré-visualização de uma imagem escolhida em Configurações (logo ou fundo do login)
function MiniaturaImagem({ caminho, tipo, largura, altura, vazio }) {
  const [dados, setDados] = useState(null);
  useEffect(() => {
    let ativo = true;
    setDados(null);
    if (caminho) {
      const carregar = tipo === "logo" ? window.api.loadLogoImage : window.api.loadBackgroundImage;
      carregar(caminho)
        .then((r) => { if (ativo && r?.success) setDados(r.imageData); })
        .catch(() => {});
    }
    return () => { ativo = false; };
  }, [caminho, tipo]);
  return (
    <Box
      sx={{
        width: largura, height: altura, borderRadius: 1.5, flexShrink: 0,
        border: 1, borderColor: "divider", bgcolor: "action.hover", overflow: "hidden",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
    >
      {dados ? (
        <img
          src={dados}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: tipo === "logo" ? "contain" : "cover" }}
        />
      ) : (
        <Typography variant="caption" color="textSecondary" align="center" sx={{ px: 1 }}>
          {caminho ? "Carregando…" : vazio}
        </Typography>
      )}
    </Box>
  );
}

function SettingsScreen() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState({
    email: { host: "", port: 587, secure: false, user: "", pass: "", from: "" },
    branding: { companyName: "", logoPath: null, backgroundPath: null, logoComoIcone: false, loginSubtitulo: "", creditoExibir: true, creditoNome: "" },
    emailNotifications: { notifyOnFinalize: false, notifyOnCreate: false, technicianEmail: "", notifyClientStatus: false, clientStatuses: [] },
    permissions: { funcionario: {}, tecnico: {} },
    autoBackup: { enabled: false, scheduledDays: [1,2,3,4,5], scheduledHour: 2, destinationPath: "", retentionDays: 30 },
    empresa: { documento: "", telefone: "", email: "", endereco: "", site: "" },
    documentos: { condicoesEntrada: "", termoGarantia: "" },
    mensagensStatus: {},
  });
  const [padroes, setPadroes] = useState(null);
  const [statusMensagem, setStatusMensagem] = useState("Finalizado");
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [licenseMsg, setLicenseMsg] = useState({ type: "", text: "" });
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [migrationDialogOpen, setMigrationDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState({
    type: "",
    text: "",
  });
  const [saveStatus, setSaveStatus] = useState({ type: "", text: "" });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupStatus, setBackupStatus] = useState({ type: "", text: "" });

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
          const defaultEmail = { host: "", port: 587, secure: false, user: "", pass: "", from: "" };
          const defaultBranding = { companyName: "GSTI App", logoPath: null, backgroundPath: null, logoComoIcone: false, loginSubtitulo: "", creditoExibir: true, creditoNome: "" };
          const defaultNotifications = {
            notifyOnFinalize: false, notifyOnCreate: false, technicianEmail: "",
            notifyClientStatus: false, clientStatuses: result.padroes?.statusAviso || [],
          };
          setPadroes(result.padroes || null);
          const defaultAutoBackup = { enabled: false, scheduledDays: [1,2,3,4,5], scheduledHour: 2, destinationPath: "", retentionDays: 30 };
          setSettings({
            email: { ...defaultEmail, ...(result.settings.email || {}) },
            branding: { ...defaultBranding, ...(result.settings.branding || {}) },
            emailNotifications: { ...defaultNotifications, ...(result.settings.emailNotifications || {}) },
            // O processo principal já completa as permissões com os padrões de cada perfil
            permissions: { funcionario: {}, tecnico: {}, ...(result.settings.permissions || {}) },
            autoBackup: { ...defaultAutoBackup, ...(result.settings.autoBackup || {}) },
            empresa: { documento: "", telefone: "", email: "", endereco: "", site: "", ...(result.settings.empresa || {}) },
            documentos: { condicoesEntrada: "", termoGarantia: "", ...(result.settings.documentos || {}) },
            mensagensStatus: { ...(result.settings.mensagensStatus || {}) },
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

  // Carrega o status atual da licença (somente leitura)
  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.getLicenseStatus();
        if (result?.success) setLicenseStatus(result.status);
      } catch (_) {
        setLicenseStatus(null);
      }
    })();
  }, []);

  // Revalida a licença no servidor (aplica renovação/revogação)
  const handleRevalidateLicense = async () => {
    setLicenseBusy(true);
    setLicenseMsg({ type: "", text: "" });
    try {
      const r = await window.api.revalidateLicense();
      if (r?.status) setLicenseStatus(r.status);
      setLicenseMsg(
        r?.online
          ? { type: "success", text: "Licença verificada com o servidor." }
          : { type: "warning", text: "Servidor de licenças indisponível. O status local foi mantido." }
      );
    } catch {
      setLicenseMsg({ type: "error", text: "Não foi possível verificar a licença." });
    } finally {
      setLicenseBusy(false);
    }
  };

  // Libera este computador na licença e volta para a tela de ativação
  const handleTransferLicense = async () => {
    setLicenseBusy(true);
    try {
      const r = await window.api.deactivateLicense();
      if (r?.success) {
        window.location.reload();
      } else {
        setTransferDialogOpen(false);
        setLicenseMsg({ type: "error", text: r?.error || "Não foi possível transferir a licença." });
      }
    } finally {
      setLicenseBusy(false);
    }
  };

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

  const handleAutoBackupChange = useCallback((field, value) => {
    setSettings((prev) => ({
      ...prev,
      autoBackup: { ...prev.autoBackup, [field]: value },
    }));
    setSaveStatus({ type: "", text: "" });
  }, []);

  const handleSelectBackupFolder = async () => {
    const result = await window.api.selectBackupFolder();
    if (result.success && result.folderPath) {
      handleAutoBackupChange("destinationPath", result.folderPath);
    }
  };

  const handlePermChange = useCallback((role, field, value) => {
    setSettings((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [role]: { ...prev.permissions[role], [field]: value },
      },
    }));
    setSaveStatus({ type: "", text: "" });
  }, []);

  // Função para salvar todas as configurações
  const handleSaveSettings = async () => {
    setSaving(true);
    setSaveStatus({ type: "", text: "" });
    try {
      // Passa o objeto completo (ou apenas as seções que podem ser alteradas)
      const settingsToSave = {
        email: settings.email,
        branding: settings.branding,
        emailNotifications: settings.emailNotifications,
        permissions: settings.permissions,
        autoBackup: settings.autoBackup,
        empresa: settings.empresa,
        documentos: settings.documentos,
        mensagensStatus: settings.mensagensStatus,
      };
      const result = await window.api.saveAppSettings(settingsToSave);
      if (result.success) {
        setSaveStatus({
          type: "success",
          text: "Configurações salvas com sucesso!",
        });
        // Menu, título da janela e permissões da sessão são recarregados
        window.dispatchEvent(new Event("gsti:configuracoes-salvas"));
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

  const handleBackup = async () => {
    setIsBackingUp(true);
    setBackupStatus({ type: "", text: "" });
    const result = await window.api.backupDatabase();
    setIsBackingUp(false);
    if (result.canceled) return;
    setBackupStatus(
      result.success
        ? { type: "success", text: `Backup salvo em: ${result.path}` }
        : { type: "error", text: result.error || "Erro ao gerar backup." }
    );
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setBackupStatus({ type: "", text: "" });
    const result = await window.api.restoreDatabase();
    setIsRestoring(false);
    if (result.canceled) return;
    setBackupStatus(
      result.success
        ? { type: "success", text: "Banco restaurado com sucesso! Reinicie o aplicativo para garantir consistência dos dados." }
        : { type: "error", text: result.error || "Erro ao restaurar backup." }
    );
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

  // --- Selecionar / Remover imagem de fundo da tela de login ---
  const handleSelectBackground = async () => {
    setSaveStatus({ type: "", text: "" });
    setTestEmailStatus({ type: "", text: "" });
    try {
      const result = await window.api.selectBackgroundFile();
      if (result.success && result.filePath) {
        handleInputChange("branding", "backgroundPath", result.filePath);
        setSaveStatus({
          type: "info",
          text: `Nova imagem de fundo selecionada: ${result.filePath}. Clique em Salvar para aplicar.`,
        });
      } else if (result.error) {
        setSaveStatus({
          type: "warning",
          text: `Seleção de imagem de fundo: ${result.error}`,
        });
      }
    } catch (error) {
      console.error("Erro ao chamar API selectBackgroundFile:", error);
      setSaveStatus({
        type: "error",
        text: "Erro ao tentar selecionar imagem de fundo.",
      });
    }
  };

  const handleRemoveLogo = () => {
    setSettings((prev) => ({
      ...prev,
      branding: { ...prev.branding, logoPath: null, logoComoIcone: false },
    }));
    setSaveStatus({ type: "info", text: "Logo removida. Clique em Salvar para aplicar." });
  };

  const logoAceitaComoIcone = /\.(png|jpe?g)$/i.test(settings.branding.logoPath || "");

  const handleRemoveBackground = () => {
    handleInputChange("branding", "backgroundPath", null);
    setSaveStatus({
      type: "info",
      text: "Imagem de fundo removida. Clique em Salvar para aplicar.",
    });
  };

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
          enviar e-mails de recuperação de senha e notificações de OS.
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

      {/* --- Personalização da marca --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Personalização da marca
        </Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
          Defina como o nome e a imagem da sua empresa aparecem no sistema.
        </Typography>

        <TextField
          label="Nome da empresa"
          name="companyName"
          value={settings.branding.companyName}
          onChange={(e) => handleInputChange("branding", "companyName", e.target.value)}
          fullWidth
          size="small"
          disabled={saving || testingEmail}
          helperText="Aparece no menu lateral, na tela de login e no título da janela."
        />

        <Divider sx={{ my: 3 }} />

        {/* Logo */}
        <Typography variant="subtitle1" fontWeight={600}>Logo da empresa</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
          Aparece no topo do menu lateral e na tela de login. PNG ou JPG, até 2 MB.
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <MiniaturaImagem caminho={settings.branding.logoPath} tipo="logo" largura={96} altura={64} vazio="Sem logo" />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={handleSelectLogo} disabled={saving || testingEmail}>
              {settings.branding.logoPath ? "Trocar logo" : "Selecionar logo"}
            </Button>
            {settings.branding.logoPath && (
              <Button variant="text" color="error" onClick={handleRemoveLogo} disabled={saving || testingEmail}>
                Remover
              </Button>
            )}
          </Stack>
        </Box>
        <FormControlLabel
          sx={{ mt: 1.5, display: "flex" }}
          control={
            <Checkbox
              checked={!!settings.branding.logoComoIcone && logoAceitaComoIcone}
              onChange={(e) => handleInputChange("branding", "logoComoIcone", e.target.checked)}
              disabled={!logoAceitaComoIcone || saving || testingEmail}
            />
          }
          label="Usar a logo também como ícone da janela e da barra de tarefas"
        />
        <Typography variant="caption" color="textSecondary" sx={{ display: "block", ml: 4 }}>
          {settings.branding.logoPath && !logoAceitaComoIcone
            ? "Disponível apenas para logo em PNG ou JPG."
            : "O atalho da Área de Trabalho e o instalador continuam com o ícone do GSTI App. Prefira uma imagem quadrada."}
        </Typography>

        <Divider sx={{ my: 3 }} />

        {/* Tela de login */}
        <Typography variant="subtitle1" fontWeight={600}>Tela de login</Typography>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1.5 }}>
          A tela de login mostra a logo, o nome da empresa e a mensagem abaixo.
        </Typography>
        <TextField
          label="Mensagem abaixo do nome"
          value={settings.branding.loginSubtitulo}
          onChange={(e) => handleInputChange("branding", "loginSubtitulo", e.target.value)}
          fullWidth
          size="small"
          placeholder="Faça login para continuar"
          disabled={saving || testingEmail}
          inputProps={{ maxLength: 80 }}
        />
        <Typography variant="body2" sx={{ mt: 2.5, mb: 1 }}>
          Imagem de fundo da tela de login
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
          <MiniaturaImagem caminho={settings.branding.backgroundPath} tipo="fundo" largura={160} altura={90} vazio="Fundo padrão" />
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={handleSelectBackground} disabled={saving || testingEmail}>
              {settings.branding.backgroundPath ? "Trocar imagem de fundo" : "Selecionar imagem de fundo"}
            </Button>
            {settings.branding.backgroundPath && (
              <Button variant="text" color="error" onClick={handleRemoveBackground} disabled={saving || testingEmail}>
                Remover
              </Button>
            )}
          </Stack>
        </Box>
        <Typography variant="caption" sx={{ display: "block", mt: 1 }} color="textSecondary">
          Fica atrás do formulário de login (não é o ícone do app). Prefira uma imagem em boa
          resolução, até 5 MB. Sem imagem, é usado o fundo padrão.
        </Typography>
        <FormControlLabel
          sx={{ mt: 2, display: "flex" }}
          control={
            <Switch
              checked={!!settings.branding.creditoExibir}
              onChange={(e) => handleInputChange("branding", "creditoExibir", e.target.checked)}
              disabled={saving || testingEmail}
            />
          }
          label={'Exibir "Desenvolvido por" no rodapé da tela de login'}
        />
        {settings.branding.creditoExibir && (
          <TextField
            label="Desenvolvido por"
            value={settings.branding.creditoNome}
            onChange={(e) => handleInputChange("branding", "creditoNome", e.target.value)}
            size="small"
            sx={{ mt: 1, width: { xs: "100%", sm: 360 } }}
            disabled={saving || testingEmail}
            inputProps={{ maxLength: 80 }}
          />
        )}
      </Paper>

      {/* --- Dados da empresa e textos dos documentos --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Dados da Empresa nos Documentos
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Aparecem no cabeçalho do comprovante de entrada e do recibo de saída, e no rodapé dos avisos por e-mail.
        </Typography>
        <Grid container spacing={2}>
          {[
            ["documento", "CNPJ / CPF", 4],
            ["telefone", "Telefone / WhatsApp", 4],
            ["email", "E-mail", 4],
            ["endereco", "Endereço", 8],
            ["site", "Site ou Instagram", 4],
          ].map(([campo, rotulo, largura]) => (
            <Grid key={campo} size={{ xs: 12, md: largura }}>
              <TextField
                label={rotulo}
                value={settings.empresa[campo] || ""}
                onChange={(e) => handleInputChange("empresa", campo, e.target.value)}
                fullWidth
                size="small"
                disabled={saving}
              />
            </Grid>
          ))}
        </Grid>

        <Typography variant="subtitle1" sx={{ mt: 3, fontWeight: 600 }}>
          Textos dos documentos
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Deixe em branco para usar o texto padrão.
        </Typography>
        <TextField
          label="Condições de serviço (comprovante de entrada)"
          value={settings.documentos.condicoesEntrada}
          placeholder={padroes?.condicoesEntrada}
          onChange={(e) => handleInputChange("documentos", "condicoesEntrada", e.target.value)}
          fullWidth
          multiline
          minRows={4}
          margin="normal"
          disabled={saving}
          inputProps={{ maxLength: 1200 }}
          helperText={`${(settings.documentos.condicoesEntrada || "").length}/1200 — o quadro do comprovante comporta cerca de 1.100 caracteres`}
        />
        <TextField
          label="Termo de garantia (recibo de saída)"
          value={settings.documentos.termoGarantia}
          placeholder={padroes?.termoGarantia}
          onChange={(e) => handleInputChange("documentos", "termoGarantia", e.target.value)}
          fullWidth
          multiline
          minRows={4}
          margin="normal"
          disabled={saving}
          inputProps={{ maxLength: 3000 }}
          helperText="Variáveis: {dias}, {data_entrega}, {data_expiracao}"
        />
      </Paper>
      {/* --- FIM Dados da empresa --- */}

      {/* --- Licenciamento e Ativação --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Licenciamento e Ativação
        </Typography>

        {licenseStatus && (() => {
          const d = licenseStatus.detalhes || {};
          const fmt = (iso) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : null);
          const planos = { mensal: "Mensal", anual: "Anual", vitalicia: "Vitalícia", cortesia: "Cortesia", trial: "Teste grátis" };
          const linhas = [
            ["Plano", planos[licenseStatus.plano] || licenseStatus.plano],
            ["E-mail", licenseStatus.email],
            ["Chave", d.chaveFinal ? `GSTI-••••-••••-••••-${d.chaveFinal}` : null],
            [
              "Validade",
              licenseStatus.validade
                ? `${fmt(licenseStatus.validade)}${licenseStatus.diasRestantes != null ? ` (${licenseStatus.diasRestantes} dia(s) restantes)` : ""}`
                : licenseStatus.tipo ? "Sem expiração" : null,
            ],
            ["Computadores", d.maxMaquinas ? `${d.maquinasAtivas ?? "?"} de ${d.maxMaquinas} em uso` : null],
            ["Última verificação", licenseStatus.lastSeen ? new Date(licenseStatus.lastSeen).toLocaleString("pt-BR") : null],
            ["Verificar online até", fmt(licenseStatus.revalidarAte)],
          ].filter(([, v]) => v);
          return (
            <>
              <Box sx={{ mb: 2, display: "flex", gap: 1.5, flexWrap: "wrap", alignItems: "center" }}>
                <Chip
                  label={licenseStatus.active ? (licenseStatus.tipo === "trial" ? "Teste ativo" : "Licença ativa") : "Inativa"}
                  color={licenseStatus.active ? "success" : "error"}
                  size="small"
                />
                {!licenseStatus.active && licenseStatus.motivo && (
                  <Typography variant="body2" color="error">
                    {licenseStatus.motivo}
                  </Typography>
                )}
              </Box>
              {linhas.length > 0 && (
                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {linhas.map(([rotulo, valor]) => (
                    <Grid key={rotulo} size={{ xs: 12, sm: 6 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {rotulo}
                      </Typography>
                      <Typography variant="body2">{valor}</Typography>
                    </Grid>
                  ))}
                </Grid>
              )}
            </>
          );
        })()}

        {licenseMsg.text && (
          <Alert severity={licenseMsg.type || "info"} sx={{ mb: 2 }} onClose={() => setLicenseMsg({ type: "", text: "" })}>
            {licenseMsg.text}
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
          <Button
            variant="outlined"
            onClick={handleRevalidateLicense}
            disabled={licenseBusy}
            startIcon={licenseBusy ? <CircularProgress size={18} color="inherit" /> : null}
          >
            Verificar agora
          </Button>
          <Button variant="outlined" onClick={() => window.api.openLicenseSite?.(licenseStatus?.tipo === "full" ? "cliente" : "planos")}>
            {licenseStatus?.tipo === "full" ? "Renovar ou gerenciar (área do cliente)" : "Comprar licença"}
          </Button>
          {licenseStatus?.tipo === "full" && (
            <Button variant="outlined" color="warning" onClick={() => setTransferDialogOpen(true)} disabled={licenseBusy}>
              Transferir para outro computador
            </Button>
          )}
        </Stack>
      </Paper>

      <Dialog open={transferDialogOpen} onClose={() => !licenseBusy && setTransferDialogOpen(false)}>
        <DialogTitle>Transferir licença</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Este computador será desvinculado da licença e o sistema voltará para a
            tela de ativação. Use a mesma chave de licença para ativar no novo
            computador.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Os dados continuam no banco de dados — nada é apagado. É necessário
            estar conectado à internet.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTransferDialogOpen(false)} disabled={licenseBusy}>
            Cancelar
          </Button>
          <Button color="warning" variant="contained" onClick={handleTransferLicense} disabled={licenseBusy}>
            Transferir
          </Button>
        </DialogActions>
      </Dialog>
      {/* --- FIM Licenciamento --- */}

      {/* --- Permissões por perfil --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <LockPersonIcon color="primary" />
          <Typography variant="h6">Permissões por perfil</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Defina o que cada perfil pode fazer. O perfil de cada pessoa é escolhido em
          Gerenciar Usuários. Administradores sempre têm acesso completo.
        </Typography>
        <Box sx={{ overflowX: "auto" }}>
          <Table size="small" sx={{ minWidth: 520 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Permissão</TableCell>
                {PERFIS_CONFIGURAVEIS.map((perfil) => (
                  <TableCell key={perfil.chave} align="center" sx={{ fontWeight: 600, width: 120 }}>
                    {perfil.rotulo}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {PERMISSOES.map((permissao) => (
                <TableRow key={permissao.chave} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight={500}>{permissao.rotulo}</Typography>
                    <Typography variant="caption" color="text.secondary">{permissao.descricao}</Typography>
                  </TableCell>
                  {PERFIS_CONFIGURAVEIS.map((perfil) => (
                    <TableCell key={perfil.chave} align="center">
                      <Switch
                        checked={!!settings.permissions[perfil.chave]?.[permissao.chave]}
                        onChange={(e) => handlePermChange(perfil.chave, permissao.chave, e.target.checked)}
                        disabled={saving}
                        inputProps={{ "aria-label": `${permissao.rotulo} — ${perfil.rotulo}` }}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </Paper>
      {/* --- Fim Permissões --- */}

      {/* --- Notificações por E-mail --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <NotificationsIcon color="primary" />
          <Typography variant="h6">Notificações por E-mail</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Requer a configuração SMTP preenchida e salva acima.
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={settings.emailNotifications.notifyOnCreate}
              onChange={(e) =>
                handleInputChange("emailNotifications", "notifyOnCreate", e.target.checked)
              }
              disabled={saving}
            />
          }
          label="Notificar técnico quando uma nova OS for criada"
        />

        {settings.emailNotifications.notifyOnCreate && (
          <TextField
            label="E-mail do Técnico"
            type="email"
            value={settings.emailNotifications.technicianEmail}
            onChange={(e) =>
              handleInputChange("emailNotifications", "technicianEmail", e.target.value)
            }
            fullWidth
            size="small"
            margin="dense"
            sx={{ ml: 4, width: "calc(100% - 32px)" }}
            disabled={saving}
          />
        )}

        <FormControlLabel
          sx={{ mt: 1, display: "block" }}
          control={
            <Checkbox
              checked={settings.emailNotifications.notifyOnFinalize}
              onChange={(e) =>
                handleInputChange("emailNotifications", "notifyOnFinalize", e.target.checked)
              }
              disabled={saving}
            />
          }
          label="Notificar cliente quando a OS for finalizada (requer e-mail cadastrado no cliente)"
        />

        <Divider sx={{ my: 2 }} />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          Aviso ao cliente sobre o andamento
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          As mensagens abaixo são usadas no e-mail automático e no botão de WhatsApp da lista de OS
          (que abre a conversa com a mensagem pronta para você enviar).
        </Typography>
        <FormControlLabel
          control={
            <Checkbox
              checked={!!settings.emailNotifications.notifyClientStatus}
              onChange={(e) => handleInputChange("emailNotifications", "notifyClientStatus", e.target.checked)}
              disabled={saving}
            />
          }
          label="Enviar e-mail ao cliente quando a OS mudar para um dos status marcados"
        />
        {settings.emailNotifications.notifyClientStatus && padroes?.statusOS && (
          <Box sx={{ ml: 4, display: "flex", flexWrap: "wrap", gap: 1 }}>
            {padroes.statusOS.map((st) => {
              const marcados = settings.emailNotifications.clientStatuses || [];
              const ativo = marcados.includes(st);
              return (
                <Chip
                  key={st}
                  label={st}
                  color={ativo ? "primary" : "default"}
                  variant={ativo ? "filled" : "outlined"}
                  onClick={() =>
                    handleInputChange(
                      "emailNotifications",
                      "clientStatuses",
                      ativo ? marcados.filter((x) => x !== st) : [...marcados, st]
                    )
                  }
                  disabled={saving}
                />
              );
            })}
          </Box>
        )}

        {padroes?.statusOS && (
          <Box sx={{ mt: 2 }}>
            <MuiFormControl size="small" sx={{ minWidth: 260 }}>
              <InputLabel>Mensagem para o status</InputLabel>
              <Select value={statusMensagem} label="Mensagem para o status" onChange={(e) => setStatusMensagem(e.target.value)}>
                {padroes.statusOS.map((st) => (
                  <MenuItem key={st} value={st}>{st}</MenuItem>
                ))}
              </Select>
            </MuiFormControl>
            <TextField
              label={`Mensagem — ${statusMensagem}`}
              value={settings.mensagensStatus[statusMensagem] || ""}
              placeholder={padroes.mensagensStatus[statusMensagem]}
              onChange={(e) => handleInputChange("mensagensStatus", statusMensagem, e.target.value)}
              fullWidth
              multiline
              minRows={2}
              margin="normal"
              disabled={saving}
              inputProps={{ maxLength: 600 }}
              helperText="Em branco = mensagem padrão. Variáveis: {cliente}, {os}, {equipamento}, {status}, {valor}, {empresa}, {telefone_empresa}"
            />
          </Box>
        )}
      </Paper>
      {/* --- Fim Notificações --- */}

      {/* --- Backup e Restauração --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6">Backup e Restauração</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Exporte o banco de dados para um arquivo <code>.sql</code> ou restaure
          a partir de um backup anterior. A restauração{" "}
          <strong>substituirá todos os dados atuais</strong>.
        </Typography>

        {backupStatus.text && (
          <Alert
            severity={backupStatus.type || "info"}
            sx={{ mb: 2 }}
            onClose={() => setBackupStatus({ type: "", text: "" })}
          >
            {backupStatus.text}
          </Alert>
        )}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
          <Button
            variant="outlined"
            color="primary"
            startIcon={
              isBackingUp ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <BackupIcon />
              )
            }
            onClick={handleBackup}
            disabled={isBackingUp || isRestoring}
          >
            {isBackingUp ? "Gerando backup..." : "Fazer Backup"}
          </Button>

          <Button
            variant="outlined"
            color="warning"
            startIcon={
              isRestoring ? (
                <CircularProgress size={18} color="inherit" />
              ) : (
                <RestoreIcon />
              )
            }
            onClick={handleRestore}
            disabled={isBackingUp || isRestoring}
          >
            {isRestoring ? "Restaurando..." : "Restaurar Backup"}
          </Button>
        </Stack>

        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
          Requer <code>pg_dump</code> e <code>psql</code> instalados. O backup é gerado como arquivo <code>.zip</code> e o restore aceita <code>.zip</code> ou <code>.sql</code>.
        </Typography>

        <Divider sx={{ my: 2 }} />

        {/* Backup automático */}
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Backup Automático
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={settings.autoBackup.enabled}
              onChange={(e) => handleAutoBackupChange("enabled", e.target.checked)}
              disabled={saving}
            />
          }
          label="Ativar backup automático agendado"
        />
        {settings.autoBackup.enabled && (
          <Box sx={{ mt: 1.5, display: "flex", flexDirection: "column", gap: 2 }}>

            {/* Dias da semana */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.75 }}>
                Dias da semana
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={settings.autoBackup.scheduledDays}
                onChange={(_, newDays) => {
                  if (newDays.length > 0) handleAutoBackupChange("scheduledDays", newDays);
                }}
                disabled={saving}
              >
                {[["Dom",0],["Seg",1],["Ter",2],["Qua",3],["Qui",4],["Sex",5],["Sáb",6]].map(([label, val]) => (
                  <ToggleButton key={val} value={val} sx={{ px: 1.5, py: 0.5, fontSize: "0.75rem" }}>
                    {label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>

            {/* Horário */}
            <MuiFormControl size="small" sx={{ maxWidth: 180 }}>
              <InputLabel>Horário</InputLabel>
              <Select
                value={settings.autoBackup.scheduledHour}
                label="Horário"
                onChange={(e) => handleAutoBackupChange("scheduledHour", e.target.value)}
                disabled={saving}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </MenuItem>
                ))}
              </Select>
            </MuiFormControl>

            {/* Pasta de destino */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <TextField
                size="small"
                label="Pasta de destino"
                value={settings.autoBackup.destinationPath}
                fullWidth
                disabled={saving}
                placeholder="Selecione uma pasta..."
                InputProps={{ readOnly: true }}
              />
              <Button
                variant="outlined"
                size="small"
                startIcon={<FolderOpenIcon />}
                onClick={handleSelectBackupFolder}
                disabled={saving}
                sx={{ whiteSpace: "nowrap" }}
              >
                Selecionar
              </Button>
            </Box>

            {/* Política de retenção */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>
                Manter backups dos últimos
              </Typography>
              <TextField
                size="small"
                type="number"
                value={settings.autoBackup.retentionDays}
                onChange={(e) => handleAutoBackupChange("retentionDays", Math.max(0, Number(e.target.value)))}
                disabled={saving}
                inputProps={{ min: 0 }}
                sx={{ width: 80 }}
              />
              <Typography variant="body2" color="text.secondary">
                dias <Typography component="span" variant="caption">(0 = manter todos)</Typography>
              </Typography>
            </Box>

            <Typography variant="caption" color="text.secondary">
              Para backup na nuvem, selecione uma pasta sincronizada pelo Google Drive, OneDrive ou Dropbox.
            </Typography>
          </Box>
        )}
      </Paper>
      {/* --- Fim Backup e Restauração --- */}

      {/* --- Migração de Banco de Dados --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <StorageIcon color="primary" />
          <Typography variant="h6">Migração de Banco de Dados</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          O GSTI utiliza PostgreSQL. Para migrar para um novo servidor ou ambiente,
          use as ferramentas de Backup e Restauração acima.
        </Typography>
        <Button
          variant="outlined"
          startIcon={<SchoolIcon />}
          onClick={() => setMigrationDialogOpen(true)}
        >
          Ver tutorial de migração
        </Button>
      </Paper>
      {/* --- Fim Migração --- */}

      {/* Dialog Tutorial */}
      <Dialog open={migrationDialogOpen} onClose={() => setMigrationDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SchoolIcon color="primary" />
            <Typography variant="h6" component="span">Tutorial de Migração PostgreSQL</Typography>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Siga os passos abaixo para migrar o banco de dados do GSTI para outro servidor PostgreSQL.
          </Typography>
          <List dense>
            {[
              { label: "Fazer Backup", desc: 'Clique em "Fazer Backup" na seção acima. Um arquivo .zip será gerado contendo o dump completo do banco.' },
              { label: "Configurar o novo servidor", desc: "Instale o PostgreSQL no novo ambiente. Crie o banco de dados gsti_db e um usuário com permissões completas sobre ele." },
              { label: "Restaurar o Backup", desc: 'No novo ambiente, clique em "Restaurar Backup" e selecione o arquivo .zip gerado no passo 1. O banco será recriado automaticamente.' },
              { label: "Atualizar a conexão", desc: 'Vá em Configurações > Banco de Dados e insira os dados do novo servidor (host, porta, usuário e senha).' },
              { label: "Testar e verificar", desc: "Faça login no GSTI e confira se os dados aparecem corretamente. Em caso de erro, verifique as credenciais e permissões do usuário PostgreSQL." },
            ].map((step, i) => (
              <ListItem key={i} alignItems="flex-start" sx={{ px: 0 }}>
                <ListItemIcon sx={{ minWidth: 36, mt: 0.5 }}>
                  <CheckCircleIcon color="primary" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={<Typography variant="body2" fontWeight={600}>{`${i + 1}. ${step.label}`}</Typography>}
                  secondary={step.desc}
                />
              </ListItem>
            ))}
          </List>
          <Alert severity="warning" sx={{ mt: 1 }}>
            A restauração sobrescreve todos os dados existentes no banco de destino. Certifique-se de ter um backup antes de prosseguir.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMigrationDialogOpen(false)}>Fechar</Button>
        </DialogActions>
      </Dialog>

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
