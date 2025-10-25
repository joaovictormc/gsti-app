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
  const [activeStep, setActiveStep] = useState(0); // 0: DB Config, 1: Admin Config

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
      setActiveStep(1); // Avança para o próximo passo se a conexão for bem-sucedida
    }
  };

  // Função para salvar tudo e criar admin
  const handleSaveAndCreate = async () => {
    setAdminStatus({ saving: true, error: "" });
    // Validação extra no frontend (opcional, backend já valida)
    if (adminUser.password !== adminUser.confirmPassword) {
      setAdminStatus({ saving: false, error: "As senhas não coincidem." });
      return;
    }
    if (
      !adminUser.nome ||
      !adminUser.email ||
      !adminUser.login ||
      !adminUser.password
    ) {
      setAdminStatus({
        saving: false,
        error: "Todos os campos do administrador são obrigatórios.",
      });
      return;
    }

    const result = await window.api.saveInitialConfig({ dbConfig, adminUser });
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
          {/* Passo 1: Configuração do Banco */}
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
                onClick={() => setActiveStep(0)} // Botão para voltar
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
