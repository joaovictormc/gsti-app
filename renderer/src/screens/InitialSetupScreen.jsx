import { useEffect, useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import LoginIcon from "@mui/icons-material/Login";
import LicenseActivationForm from "../components/LicenseActivationForm";
import { useAuth } from "../contexts/AuthContext";

const InitialSetupScreen = ({ onSetupComplete }) => {
  const { login } = useAuth();
  const [activeStep, setActiveStep] = useState(0); // 0: Ativação, 1: Banco, 2: Acesso
  const [licenseInfo, setLicenseInfo] = useState(null); // { tipo, plano, diasRestantes, ... }

  // Se a licença já foi ativada antes (ex.: app fechado no meio do setup), pula a ativação.
  useEffect(() => {
    window.api
      .getLicenseStatus()
      .then((r) => {
        if (r?.status?.active) {
          setLicenseInfo(r.status);
          setActiveStep((step) => (step === 0 ? 1 : step));
        }
      })
      .catch(() => {});
  }, []);

  // Estado para Configuração do Banco
  const [dbConfig, setDbConfig] = useState({
    host: "localhost",
    port: 5432,
    database: "gsti_db",
    user: "",
    password: "",
  });
  const [dbStatus, setDbStatus] = useState({
    testing: false,
    tested: false,
    success: false,
    error: "",
  });

  // Passo 3: "new" = criar administrador | "existing" = já tenho cadastro
  const [accessMode, setAccessMode] = useState("new");
  const [adminUser, setAdminUser] = useState({
    nome: "",
    email: "",
    login: "",
    password: "",
    confirmPassword: "",
  });
  const [existingUser, setExistingUser] = useState({ login: "", password: "" });
  const [adminStatus, setAdminStatus] = useState({ saving: false, error: "" });

  const handleDbChange = (e) => {
    const { name, value } = e.target;
    setDbConfig((prev) => ({ ...prev, [name]: value }));
    setDbStatus({ testing: false, tested: false, success: false, error: "" }); // Reseta status do teste
  };

  const handleAdminChange = (e) => {
    const { name, value } = e.target;
    setAdminUser((prev) => ({ ...prev, [name]: value }));
    setAdminStatus({ saving: false, error: "" }); // Limpa erro ao digitar
  };

  const handleExistingChange = (e) => {
    const { name, value } = e.target;
    setExistingUser((prev) => ({ ...prev, [name]: value }));
    setAdminStatus({ saving: false, error: "" });
  };

  // Função para testar conexão com o BD
  const handleTestConnection = async () => {
    setDbStatus({ testing: true, tested: false, success: false, error: "" });
    const result = await window.api.testDbConnection(dbConfig);
    setDbStatus({
      testing: false,
      tested: true,
      success: result.success,
      error: result.error || "",
    });
    if (result.success) {
      setActiveStep(2); // Avança para o acesso se a conexão for bem-sucedida
    }
  };

  // Cria o primeiro administrador
  const handleSaveAndCreate = async () => {
    setAdminStatus({ saving: true, error: "" });
    if (!adminUser.nome || !adminUser.email || !adminUser.login || !adminUser.password) {
      setAdminStatus({ saving: false, error: "Todos os campos do administrador são obrigatórios." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminUser.email)) {
      setAdminStatus({ saving: false, error: "Informe um email válido para o administrador." });
      return;
    }
    if (adminUser.password.length < 6) {
      setAdminStatus({ saving: false, error: "A senha deve ter no mínimo 6 caracteres." });
      return;
    }
    if (adminUser.password !== adminUser.confirmPassword) {
      setAdminStatus({ saving: false, error: "As senhas não coincidem." });
      return;
    }

    const result = await window.api.saveInitialConfig({ dbConfig, adminUser });
    if (result.success) {
      alert("Configuração salva e usuário administrador criado com sucesso!");
      onSetupComplete?.();
    } else {
      setAdminStatus({
        saving: false,
        error: result.error || "Erro desconhecido ao salvar configuração.",
      });
    }
  };

  // Nova instalação apontando para um banco que já tem cadastro: valida e entra direto
  const handleExistingLogin = async (e) => {
    e?.preventDefault();
    if (!existingUser.login || !existingUser.password) {
      setAdminStatus({ saving: false, error: "Informe login e senha." });
      return;
    }
    setAdminStatus({ saving: true, error: "" });
    const result = await window.api.saveInitialConfigExistingUser({
      dbConfig,
      login: existingUser.login.trim(),
      password: existingUser.password,
    });
    if (result.success) {
      login(result.user); // Sessão persiste no reload feito por onSetupComplete
      onSetupComplete?.();
    } else {
      setAdminStatus({ saving: false, error: result.error || "Não foi possível validar o cadastro." });
    }
  };

  const loginDuplicado = /já existe/i.test(adminStatus.error);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "var(--gsti-vh)",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: "600px" }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Configuração Inicial - GSTI App
        </Typography>
        <Typography variant="body1" align="center" gutterBottom sx={{ mb: 3 }}>
          Bem-vindo! Ative o sistema, conecte ao banco de dados e crie o
          administrador — ou entre com um cadastro que já existe no banco.
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Passo 1: Ativação do Sistema */}
          <Step key="license">
            <StepLabel
              optional={
                licenseInfo && activeStep > 0 ? (
                  <Typography variant="caption" color="success.main">
                    {licenseInfo.tipo === "trial"
                      ? `Teste ativo — ${licenseInfo.diasRestantes ?? ""} dia(s) restantes`
                      : "Licença ativada"}
                  </Typography>
                ) : null
              }
            >
              Ativação do Sistema
            </StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Informe a chave de licença recebida por e-mail após a compra, ou
                inicie um período de teste gratuito.
              </Typography>
              <LicenseActivationForm
                onActivated={(license) => {
                  setLicenseInfo(license);
                  setTimeout(() => setActiveStep(1), 600);
                }}
              />
            </StepContent>
          </Step>

          {/* Passo 2: Configuração do Banco */}
          <Step key="dbConfig">
            <StepLabel>Configuração do Banco de Dados</StepLabel>
            <StepContent>
              <Box
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  mt: 1,
                  mb: 2,
                }}
              >
                <TextField
                  name="host"
                  label="Host do Banco"
                  value={dbConfig.host}
                  onChange={handleDbChange}
                  required
                />
                <TextField
                  name="port"
                  label="Porta"
                  type="number"
                  value={dbConfig.port}
                  onChange={handleDbChange}
                  required
                />
                <TextField
                  name="database"
                  label="Nome do Banco de Dados"
                  value={dbConfig.database}
                  onChange={handleDbChange}
                  required
                />
                <TextField
                  name="user"
                  label="Usuário do Banco"
                  value={dbConfig.user}
                  onChange={handleDbChange}
                  required
                />
                <TextField
                  name="password"
                  label="Senha do Banco"
                  type="password"
                  value={dbConfig.password}
                  onChange={handleDbChange}
                />
              </Box>
              {dbStatus.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {dbStatus.error}
                </Alert>
              )}
              {dbStatus.tested && dbStatus.success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Conexão bem-sucedida!
                </Alert>
              )}
              <Button
                variant="contained"
                onClick={handleTestConnection}
                disabled={dbStatus.testing}
                startIcon={
                  dbStatus.testing ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : null
                }
              >
                Testar Conexão
              </Button>
            </StepContent>
          </Step>

          {/* Passo 3: Acesso — criar administrador ou usar cadastro existente */}
          <Step key="adminConfig">
            <StepLabel>Acesso ao Sistema</StepLabel>
            <StepContent>
              <ToggleButtonGroup
                value={accessMode}
                exclusive
                fullWidth
                size="small"
                color="primary"
                disabled={adminStatus.saving}
                onChange={(_e, v) => {
                  if (!v) return;
                  setAccessMode(v);
                  setAdminStatus({ saving: false, error: "" });
                }}
                sx={{ mt: 1, mb: 2 }}
              >
                <ToggleButton value="new">
                  <PersonAddIcon fontSize="small" sx={{ mr: 1 }} /> Criar novo administrador
                </ToggleButton>
                <ToggleButton value="existing">
                  <LoginIcon fontSize="small" sx={{ mr: 1 }} /> Já tenho cadastro
                </ToggleButton>
              </ToggleButtonGroup>

              {accessMode === "new" ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}>
                  <TextField
                    name="nome"
                    label="Nome Completo"
                    value={adminUser.nome}
                    onChange={handleAdminChange}
                    required
                  />
                  <TextField
                    name="email"
                    label="Email"
                    type="email"
                    value={adminUser.email}
                    onChange={handleAdminChange}
                    required
                  />
                  <TextField
                    name="login"
                    label="Login de Acesso"
                    value={adminUser.login}
                    onChange={handleAdminChange}
                    required
                  />
                  <TextField
                    name="password"
                    label="Senha"
                    type="password"
                    value={adminUser.password}
                    onChange={handleAdminChange}
                    required
                  />
                  <TextField
                    name="confirmPassword"
                    label="Confirmar Senha"
                    type="password"
                    value={adminUser.confirmPassword}
                    onChange={handleAdminChange}
                    required
                  />
                </Box>
              ) : (
                <Box
                  component="form"
                  onSubmit={handleExistingLogin}
                  sx={{ display: "flex", flexDirection: "column", gap: 2, mb: 2 }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Use esta opção ao reinstalar o GSTI App ou instalá-lo em outro
                    computador que usa o mesmo banco de dados. Entre com um usuário
                    já cadastrado — nenhum dado será alterado.
                  </Typography>
                  <TextField
                    name="login"
                    label="Login"
                    value={existingUser.login}
                    onChange={handleExistingChange}
                    autoComplete="username"
                    required
                  />
                  <TextField
                    name="password"
                    label="Senha"
                    type="password"
                    value={existingUser.password}
                    onChange={handleExistingChange}
                    autoComplete="current-password"
                    required
                  />
                  {/* Permite Enter para enviar */}
                  <button type="submit" hidden />
                </Box>
              )}

              {adminStatus.error && (
                <Alert
                  severity="error"
                  sx={{ mb: 2 }}
                  action={
                    accessMode === "new" && loginDuplicado ? (
                      <Button color="inherit" size="small" onClick={() => setAccessMode("existing")}>
                        Já tenho cadastro
                      </Button>
                    ) : null
                  }
                >
                  {adminStatus.error}
                </Alert>
              )}

              {accessMode === "new" ? (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleSaveAndCreate}
                  disabled={!dbStatus.success || adminStatus.saving}
                  startIcon={adminStatus.saving ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  Salvar Configuração e Criar Admin
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleExistingLogin}
                  disabled={!dbStatus.success || adminStatus.saving}
                  startIcon={adminStatus.saving ? <CircularProgress size={20} color="inherit" /> : null}
                >
                  Validar e Entrar
                </Button>
              )}
              <Button
                variant="text"
                onClick={() => setActiveStep(1)} // Botão para voltar ao Banco
                sx={{ ml: 1 }}
                disabled={adminStatus.saving}
              >
                Voltar (Banco)
              </Button>
            </StepContent>
          </Step>
        </Stepper>
      </Paper>
    </Box>
  );
};

export default InitialSetupScreen;
