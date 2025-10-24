import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  IconButton,
  Typography,
  Button,
} from "@mui/material";
import Brightness4Icon from "@mui/icons-material/Brightness4"; // Ícone Lua (Dark Mode)
import Brightness7Icon from "@mui/icons-material/Brightness7"; // Ícone Sol (Light Mode)
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "./contexts/AuthContext";

import LoginScreen from "./screens/LoginScreen";
import CustomerGrid from "./components/CustomerGrid";
import ProductServiceGrid from "./components/ProductServiceGrid";
import OSGrid from "./components/OSGrid";
import ExpensesGrid from "./components/ExpensesGrid";
import FinancialDashboard from "./components/FinancialDashboard";
import MiscRevenueGrid from "./components/MiscRevenueGrid";
import OSReportClient from "./components/OSReportClient";
import OSReportStatus from "./components/OSReportStatus";
import MostUsedServicesReport from "./components/MostUsedServicesReport";
import EquipmentHistoryReport from "./components/EquipmentHistoryReport";
import DetailedRevenueReport from "./components/DetailedRevenueReport";
import UserManagement from "./components/UserManagement";



// Componente Sidebar (com botão de tema e logout)
function Sidebar({ onNavigate, userRole, currentThemeMode, toggleTheme }) {
  // Recebe props do tema
  const { logout } = useAuth();
  const [openSubmenu, setOpenSubmenu] = useState(null);

  const menuItems = [
    { label: "Clientes", component: "CustomerGrid" },
    { label: "Produtos/Serviços", component: "ProductServiceGrid" },
    { label: "Ordens de Serviço", component: "OSGrid" },
    { label: "Despesas", component: "ExpensesGrid" },
    { label: "Receitas Avulsas", component: "MiscRevenueGrid" },
    { label: "Resumo Financeiro", component: "FinancialDashboard" },
    {
      label: "Relatórios",
      subItems: [
        { label: "OS por Cliente", component: "OSReportClient" },
        { label: "OS por Status", component: "OSReportStatus" },
        { label: "Serviços Mais Usados", component: "MostUsedServicesReport" },
        { label: "Histórico Equipamento", component: "EquipmentHistoryReport" },
        { label: "Receitas Detalhadas", component: "DetailedRevenueReport" },
      ],
    },
    ...(userRole === "Admin"
      ? [{ label: "Gerenciar Usuários", component: "UserManagement" }]
      : []),
  ];

  return (
    <Box
      sx={{
        width: 240,
        height: "100vh",
        borderRight: 1,
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        p: 1,
        overflowY: "auto",
      }}
    >
      <Typography variant="h6" sx={{ textAlign: "center", mb: 2 }}>
        GSTI App
      </Typography>
      <Box sx={{ flexGrow: 1 }}>
        {" "}
        {/* Faz o menu ocupar o espaço disponível */}
        {menuItems.map((item /* ... Seu código de mapeamento do menu ... */) =>
          item.subItems ? (
            <Box key={item.label}>
              {" "}
              <Button
                fullWidth
                onClick={() =>
                  setOpenSubmenu(openSubmenu === item.label ? null : item.label)
                }
                sx={{ justifyContent: "flex-start", mb: 0.5 }}
              >
                {" "}
                {item.label}{" "}
              </Button>{" "}
              {openSubmenu === item.label && (
                <Box sx={{ pl: 2 }}>
                  {" "}
                  {item.subItems.map((subItem) => (
                    <Button
                      key={subItem.label}
                      fullWidth
                      onClick={() => onNavigate(subItem.component)}
                      sx={{
                        justifyContent: "flex-start",
                        mb: 0.5,
                        fontSize: "0.8rem",
                      }}
                    >
                      {" "}
                      {subItem.label}{" "}
                    </Button>
                  ))}{" "}
                </Box>
              )}{" "}
            </Box>
          ) : (
            <Button
              key={item.label}
              fullWidth
              onClick={() => onNavigate(item.component)}
              sx={{ justifyContent: "flex-start", mb: 0.5 }}
            >
              {" "}
              {item.label}{" "}
            </Button>
          )
        )}
      </Box>

      {/* Controles na parte inferior da Sidebar */}
      <Box
        sx={{
          mt: "auto",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          p: 1,
        }}
      >
        <Button variant="outlined" color="error" onClick={logout} size="small">
          {" "}
          Logout{" "}
        </Button>
        {/* Botão para alternar tema */}
        <IconButton
          onClick={toggleTheme}
          color="inherit"
          title={
            currentThemeMode === "dark"
              ? "Mudar para tema claro"
              : "Mudar para tema escuro"
          }
        >
          {currentThemeMode === "dark" ? (
            <Brightness7Icon />
          ) : (
            <Brightness4Icon />
          )}
        </IconButton>
      </Box>
    </Box>
  );
}

// Mapeia nomes de componentes
const componentMap = {
  CustomerGrid,
  ProductServiceGrid,
  OSGrid,
  ExpensesGrid,
  MiscRevenueGrid,
  FinancialDashboard,
  OSReportClient,
  OSReportStatus,
  MostUsedServicesReport,
  EquipmentHistoryReport,
  DetailedRevenueReport,
  UserManagement,
  // Adicione uma tela inicial se desejar
  HomeScreen: () => (
    <Typography variant="h5" sx={{ textAlign: "center", mt: 4 }}>
      Bem-vindo ao GSTI!
    </Typography>
  ),
};

function App() {
  const { currentUser, login } = useAuth();
  const [activeComponent, setActiveComponent] = useState("HomeScreen"); // Inicia na HomeScreen

  // --- LÓGICA DO TEMA ---
  // Tenta ler o tema salvo no localStorage, ou usa 'light' como padrão
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("themeMode") || "light"
  );

  // Salva a preferência no localStorage sempre que o tema mudar
  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  // Função para alternar o tema
  const toggleThemeMode = () => {
    setThemeMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  // Cria o objeto de tema MUI com base no modo atual (usando useMemo para performance)
  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          // Você pode adicionar mais customizações aqui se desejar
          // primary: { main: '#1976d2' },
          // secondary: { main: '#dc004e' },
        },
      }),
    [themeMode] // Recria o tema apenas se themeMode mudar
  );
  // --- FIM LÓGICA DO TEMA ---

  // Se não houver usuário logado, mostra a tela de login (fora do ThemeProvider principal, pode ter seu próprio tema se quiser)
  if (!currentUser) {
    return (
      <ThemeProvider theme={theme}>
        {" "}
        {/* Aplica tema também na tela de login */}
        <CssBaseline />
        <LoginScreen onLoginSuccess={login} />
      </ThemeProvider>
    );
  }

  // Se houver usuário logado, mostra a interface principal
  const ComponentToRender =
    componentMap[activeComponent] ||
    (() => (
      <Typography>Componente não encontrado: {activeComponent}</Typography>
    ));

  return (
    // Envolve toda a UI logada com o ThemeProvider
    <ThemeProvider theme={theme}>
      <CssBaseline />{" "}
      {/* Normaliza estilos E aplica cores de fundo/texto do tema */}
      <Box sx={{ display: "flex" }}>
        {/* Passa o modo atual e a função de toggle para a Sidebar */}
        <Sidebar
          onNavigate={setActiveComponent}
          userRole={currentUser.role}
          currentThemeMode={themeMode}
          toggleTheme={toggleThemeMode}
        />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: 3,
            height: "100vh",
            overflowY: "auto",
            bgcolor: "background.default",
          }}
        >
          {" "}
          {/* Usa cor de fundo do tema */}
          <ComponentToRender />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
