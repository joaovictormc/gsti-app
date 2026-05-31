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

function SettingsScreen() {
  const { currentUser } = useAuth();
  const [settings, setSettings] = useState({
    email: { host: "", port: 587, secure: false, user: "", pass: "", from: "" },
    branding: { companyName: "", logoPath: null },
    emailNotifications: { notifyOnFinalize: false, notifyOnCreate: false, technicianEmail: "" },
    permissions: { funcionario: { canSeeFinancial: false, canSeeReports: false } },
    autoBackup: { enabled: false, scheduledDays: [1,2,3,4,5], scheduledHour: 2, destinationPath: "", retentionDays: 30 },
  });
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
          const defaultBranding = { companyName: "GSTI App", logoPath: null };
          const defaultNotifications = { notifyOnFinalize: false, notifyOnCreate: false, technicianEmail: "" };
          const defaultPerms = { canSeeFinancial: false, canSeeReports: false };
          const defaultAutoBackup = { enabled: false, scheduledDays: [1,2,3,4,5], scheduledHour: 2, destinationPath: "", retentionDays: 30 };
          setSettings({
            email: { ...defaultEmail, ...(result.settings.email || {}) },
            branding: { ...defaultBranding, ...(result.settings.branding || {}) },
            emailNotifications: { ...defaultNotifications, ...(result.settings.emailNotifications || {}) },
            permissions: {
              funcionario: { ...defaultPerms, ...(result.settings.permissions?.funcionario || {}) },
            },
            autoBackup: { ...defaultAutoBackup, ...(result.settings.autoBackup || {}) },
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

      {/* --- Permissões de Funcionário --- */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <LockPersonIcon color="primary" />
          <Typography variant="h6">Permissões de Funcionário</Typography>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Controle quais módulos são visíveis para usuários com perfil Funcionário.
          Administradores sempre têm acesso completo.
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={settings.permissions.funcionario.canSeeFinancial}
              onChange={(e) =>
                handlePermChange("funcionario", "canSeeFinancial", e.target.checked)
              }
              disabled={saving}
            />
          }
          label="Pode visualizar Módulo Financeiro (Despesas, Receitas, Dashboard)"
        />
        <FormControlLabel
          sx={{ display: "block", mt: 0.5 }}
          control={
            <Switch
              checked={settings.permissions.funcionario.canSeeReports}
              onChange={(e) =>
                handlePermChange("funcionario", "canSeeReports", e.target.checked)
              }
              disabled={saving}
            />
          }
          label="Pode visualizar Relatórios"
        />
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
