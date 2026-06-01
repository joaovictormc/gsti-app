import { useState } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from "@mui/material";

const InitialSetupScreen = ({ onSetupComplete }) => {
  const [activeStep, setActiveStep] = useState(0); // 0: Ativação, 1: DB Config, 2: Admin Config

  // Estado para Ativação (licença vinculada ao e-mail de contratação)
  const [license, setLicense] = useState({ email: "", key: "" });
  const [licenseStatus, setLicenseStatus] = useState({
    validating: false,
    valid: false,
    error: "",
  });

  // Estado para Configuração do Banco
  const [dbConfig, setDbConfig] = useState({
    host: "localhost",
    port: 3306,
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

  // Estado para Criação do Admin
  const [adminUser, setAdminUser] = useState({
    nome: "",
    email: "",
    login: "",
    password: "",
    confirmPassword: "",
  });
  const [adminStatus, setAdminStatus] = useState({ saving: false, error: "" });

  // Handlers para inputs
  const handleLicenseChange = (e) => {
    const { name, value } = e.target;
    setLicense((prev) => ({ ...prev, [name]: value }));
    setLicenseStatus({ validating: false, valid: false, error: "" });
  };

  const handleValidateLicense = async () => {
    setLicenseStatus({ validating: true, valid: false, error: "" });
    if (!license.email || !license.key) {
      setLicenseStatus({
        validating: false,
        valid: false,
        error: "Informe o e-mail de contratação e a chave de ativação.",
      });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(license.email.trim())) {
      setLicenseStatus({
        validating: false,
        valid: false,
        error: "Informe um e-mail de contratação válido.",
      });
      return;
    }
    try {
      const result = await window.api.validateLicense({
        email: license.email,
        key: license.key,
      });
      if (result.success) {
        setLicenseStatus({ validating: false, valid: true, error: "" });
        setActiveStep(1); // Avança para a configuração do banco
      } else {
        setLicenseStatus({
          validating: false,
          valid: false,
          error: result.error || "Ativação inválida.",
        });
      }
    } catch (error) {
      setLicenseStatus({
        validating: false,
        valid: false,
        error: "Erro ao validar a ativação. Tente novamente.",
      });
    }
  };

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
      setActiveStep(2); // Avança para a criação do admin se a conexão for bem-sucedida
    }
  };

  // Função para salvar tudo e criar admin
  const handleSaveAndCreate = async () => {
    setAdminStatus({ saving: true, error: "" });
    // Validação extra no frontend (opcional, backend já valida)
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

    const result = await window.api.saveInitialConfig({ dbConfig, adminUser, license });
    if (result.success) {
      alert(
        "Configuração salva e usuário administrador criado com sucesso! O aplicativo será reiniciado ou você será redirecionado para o login."
      );
      // Chama a função passada pelo App.jsx para indicar que o setup terminou
      if (onSetupComplete) {
        onSetupComplete();
      }
      // O ideal aqui seria forçar um reload da aplicação ou redirecionar programaticamente
      // window.location.reload(); // Força reload (pode precisar ajustar dependendo do fluxo)
    } else {
      setAdminStatus({
        saving: false,
        error: result.error || "Erro desconhecido ao salvar configuração.",
      });
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        p: 2,
        bgcolor: "background.default",
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: "600px" }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Configuração Inicial - GSTI App
        </Typography>
        <Typography variant="body1" align="center" gutterBottom sx={{ mb: 3 }}>
          Bem-vindo! Por favor, configure a conexão com o banco de dados e crie
          o usuário administrador.
        </Typography>

        <Stepper activeStep={activeStep} orientation="vertical">
          {/* Passo 1: Ativação do Sistema */}
          <Step key="license">
            <StepLabel>Ativação do Sistema</StepLabel>
            <StepContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Informe o e-mail usado na contratação e a chave de ativação que
                você recebeu. A chave é vinculada ao e-mail.
              </Typography>
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
                  name="email"
                  label="E-mail de Contratação"
                  type="email"
                  value={license.email}
                  onChange={handleLicenseChange}
                  required
                />
                <TextField
                  name="key"
                  label="Chave de Ativação"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={license.key}
                  onChange={handleLicenseChange}
                  required
                />
              </Box>
              {licenseStatus.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {licenseStatus.error}
                </Alert>
              )}
              {licenseStatus.valid && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Ativação validada!
                </Alert>
              )}
              <Button
                variant="contained"
                onClick={handleValidateLicense}
                disabled={licenseStatus.validating}
                startIcon={
                  licenseStatus.validating ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : null
                }
              >
                Validar Ativação
              </Button>
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

          {/* Passo 2: Criar Admin */}
          <Step key="adminConfig">
            <StepLabel>Criar Conta de Administrador</StepLabel>
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
              {adminStatus.error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {adminStatus.error}
                </Alert>
              )}
              <Button
                variant="contained"
                color="primary"
                onClick={handleSaveAndCreate}
                disabled={!dbStatus.success || adminStatus.saving} // Habilita só se DB OK e não estiver salvando
                startIcon={
                  adminStatus.saving ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : null
                }
              >
                Salvar Configuração e Criar Admin
              </Button>
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
