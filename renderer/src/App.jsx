import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Box,
  CssBaseline,
  ThemeProvider,
  createTheme,
  IconButton,
  Typography,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Collapse,
  CircularProgress,
} from "@mui/material";
import {
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon, // Tema
  People as PeopleIcon,
  Inventory2 as InventoryIcon,
  Assignment as AssignmentIcon, // Ícones Menu
  Assessment as AssessmentIcon,
  AttachMoney as AttachMoneyIcon,
  BarChart as BarChartIcon, // Ícones Menu
  ExpandLess,
  ExpandMore, // Ícones Submenu
  Home as HomeIcon, // Ícone Home
  Logout as LogoutIcon, // Ícone Logout
  Settings as SettingsIcon, // Ícone Gerenciar Usuários (Exemplo)
} from "@mui/icons-material";
import { useAuth } from "./contexts/AuthContext";

import LoginScreen from "./screens/LoginScreen";
import CustomerGrid from "./components/CustomerGrid";
import ProductServiceGrid from "./components/ProductServiceGrid";
import OSGrid from "./components/OSGrid";
import ExpensesGrid from "./components/ExpensesGrid";
import FinancialDashboard from "./components/FinancialPages/FinancialDashboard";
import MiscRevenueGrid from "./components/MiscRevenueGrid";
import OSReportClient from "./components/OSReportClient";
import OSReportStatus from "./components/OSReportStatus";
import MostUsedServicesReport from "./components/MostUsedServicesReport";
import EquipmentHistoryReport from "./components/EquipmentHistoryReport";
import DetailedRevenueReport from "./components/DetailedRevenueReport";
import UserManagement from "./components/UserManagement";
import InitialSetupScreen from "./screens/InitialSetupScreen";
import SettingsScreen from "./components/SettingsScreen";

// Componente HomeScreen Simples
const HomeScreen = () => {
  const { currentUser } = useAuth();
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Bem-vindo ao GSTI, {currentUser?.nome || "Usuário"}!
      </Typography>
      <Typography variant="body1">
        Utilize o menu à esquerda para navegar pelas funcionalidades do sistema.
      </Typography>
      {/* Adicionar mais informações ou links rápidos aqui se desejar */}
    </Box>
  );
};

const drawerWidth = 240; // Largura da Sidebar

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
  SettingsScreen,
  // Adicione uma tela inicial se desejar
  HomeScreen: () => (
    <Typography variant="h5" sx={{ textAlign: "center", mt: 4 }}>
      Bem-vindo ao GSTI!
    </Typography>
  ),
};

// Componente Sidebar usando MUI Drawer
function AppSidebar({
  onNavigate,
  userRole,
  currentThemeMode,
  toggleTheme,
  companyName,
  logoData,
}) {
  const { logout, currentUser } = useAuth();
  const [reportsOpen, setReportsOpen] = useState(false); // Estado para submenu Relatórios

  const handleReportsClick = () => {
    setReportsOpen(!reportsOpen);
  };

  const menuItems = [
    { label: "Início", component: "HomeScreen", icon: <HomeIcon /> },
    { label: "Clientes", component: "CustomerGrid", icon: <PeopleIcon /> },
    {
      label: "Produtos/Serviços",
      component: "ProductServiceGrid",
      icon: <InventoryIcon />,
    },
    {
      label: "Ordens de Serviço",
      component: "OSGrid",
      icon: <AssignmentIcon />,
    },
    {
      label: "Despesas",
      component: "ExpensesGrid",
      icon: <AttachMoneyIcon sx={{ color: "red" }} />,
    }, // Exemplo cor
    {
      label: "Receitas Avulsas",
      component: "MiscRevenueGrid",
      icon: <AttachMoneyIcon sx={{ color: "green" }} />,
    }, // Exemplo cor
    {
      label: "Resumo Financeiro",
      component: "FinancialDashboard",
      icon: <BarChartIcon />,
    },
    // Item de Menu para Relatórios (com submenu)
    {
      label: "Relatórios",
      icon: <AssessmentIcon />,
      subItems: [
        { label: "OS por Cliente", component: "OSReportClient" },
        { label: "OS por Status", component: "OSReportStatus" },
        { label: "Serviços Mais Usados", component: "MostUsedServicesReport" },
        { label: "Histórico Equipamento", component: "EquipmentHistoryReport" },
        { label: "Receitas Detalhadas", component: "DetailedRevenueReport" },
      ],
    },
    // Item visível apenas para Admin
    ...(userRole === "Admin"
      ? [
          {
            label: "Gerenciar Usuários",
            component: "UserManagement",
            icon: <SettingsIcon />,
          },
          {
            label: "Configurações",
            component: "SettingsScreen",
            icon: <SettingsIcon />,
          },
        ]
      : []),
  ];
  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: "border-box" },
      }}
    >
      <Box
        sx={{
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          height: "100%",
        }}
      >
        {/* --- Exibe Logo e Nome da Empresa --- */}
        <Box sx={{ textAlign: "center", my: 2, px: 1 }}>
          {logoData && (
            <img
              src={logoData} // Usa a string Base64
              alt={`${companyName || "Logo"} Logo`}
              style={{
                maxHeight: "40px",
                maxWidth: "80%",
                marginBottom: "8px",
              }}
            />
          )}
          <Typography variant="h6" noWrap>
            {companyName || "GSTI App"} {/* Usa o nome da config ou o padrão */}
          </Typography>
        </Box>
        <Divider />
        <List sx={{ flexGrow: 1 }}>
          {menuItems.map((item) => {
            // Se o item tiver subItems, renderiza o botão com Collapse
            if (item.subItems) {
              // Verifica se é o item de Relatórios (poderia ser mais genérico se houvesse mais submenus)
              const isOpen = item.label === "Relatórios" ? reportsOpen : false;
              const handleClick =
                item.label === "Relatórios" ? handleReportsClick : () => {};

              return (
                // Usa React.Fragment para agrupar sem adicionar nó extra no DOM
                <React.Fragment key={item.label}>
                  <ListItemButton onClick={handleClick}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems.map((subItem) => (
                        <ListItemButton
                          key={subItem.label}
                          sx={{ pl: 4 }}
                          onClick={() => onNavigate(subItem.component)}
                        >
                          <ListItemIcon>
                            {subItem.icon || <Box sx={{ width: 24 }} />}
                          </ListItemIcon>
                          <ListItemText
                            primary={subItem.label}
                            primaryTypographyProps={{ fontSize: "0.9rem" }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            }
            // Se não tiver subItems, renderiza um item de navegação simples
            else {
              return (
                <ListItem key={item.label} disablePadding>
                  <ListItemButton onClick={() => onNavigate(item.component)}>
                    <ListItemIcon>
                      {item.icon || <Box sx={{ width: 24 }} />}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              );
            }
          })}
        </List>
        {/* --- FIM DA SEÇÃO CORRIGIDA --- */}
        <Divider />
        {/* Controles na parte inferior */}
        <Box
          sx={{
            p: 1,
            mt: "auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="caption">{currentUser?.nome}</Typography>
            <Button
              variant="outlined"
              color="error"
              onClick={logout}
              size="small"
              startIcon={<LogoutIcon />}
              sx={{ display: "block", mt: 0.5 }}
            >
              {" "}
              Logout{" "}
            </Button>
          </Box>
          <IconButton
            onClick={toggleTheme}
            color="inherit"
            title={currentThemeMode === "dark" ? "Tema claro" : "Tema escuro"}
          >
            {currentThemeMode === "dark" ? (
              <Brightness7Icon />
            ) : (
              <Brightness4Icon />
            )}
          </IconButton>
        </Box>
      </Box>
    </Drawer>
  );
}

function App() {
  const { currentUser, login } = useAuth();
  const [activeComponent, setActiveComponent] = useState("HomeScreen"); // Inicia na HomeScreen
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("themeMode") || "light"
  );
  const [needsSetup, setNeedsSetup] = useState(null); // null = verificando, true = precisa, false = não precisa
  const [checkingSetup, setCheckingSetup] = useState(true); // Para mostrar loading inicial

  const [brandingConfig, setBrandingConfig] = useState({
    companyName: "GSTI App",
    logoData: null,
  });
  const [loadingBranding, setLoadingBranding] = useState(false);
  // --- EFEITO PARA VERIFICAR SETUP INICIAL (Roda 1x) ---
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const setupNeeded = await window.api.isInitialSetupNeeded();
        console.log("Setup needed check result:", setupNeeded);
        setNeedsSetup(setupNeeded);
      } catch (error) {
        console.error("Erro ao verificar necessidade de setup:", error);
        // Em caso de erro, assume que precisa de setup para segurança
        setNeedsSetup(true);
        alert("Erro ao verificar a configuração inicial. Verifique o console.");
      } finally {
        setCheckingSetup(false); // Terminou a verificação
      }
    };
    checkSetup();
  }, []);
  // --- FIM EFEITO SETUP ---

  // --- NOVO EFEITO: Carregar Configurações de Branding após Login ---
  useEffect(() => {
    const loadBranding = async () => {
      // Só executa se o setup estiver completo E houver um usuário logado
      if (needsSetup === false && currentUser) {
        console.log("[App] Carregando configurações de branding...");
        setLoadingBranding(true);
        let currentCompanyName = "GSTI App"; // Padrão
        let currentLogoData = null;

        try {
          const result = await window.api.getAppSettings();
          if (result.success && result.settings?.branding) {
            currentCompanyName =
              result.settings.branding.companyName || "GSTI App";
            const logoPath = result.settings.branding.logoPath;

            // Se houver um caminho para a logo, tenta carregá-la
            if (logoPath) {
              console.log("[App] Tentando carregar logo do path:", logoPath);
              const logoResult = await window.api.loadLogoImage(logoPath);
              if (logoResult.success && logoResult.imageData) {
                currentLogoData = logoResult.imageData;
                console.log("[App] Logo carregada com sucesso.");
              } else {
                console.warn("[App] Falha ao carregar logo:", logoResult.error);
                // Mantém currentLogoData como null
              }
            }
          } else {
            console.warn(
              "[App] Não foi possível carregar configurações de branding:",
              result?.error
            );
          }
        } catch (error) {
          console.error("[App] Erro ao carregar branding:", error);
        } finally {
          setBrandingConfig({
            companyName: currentCompanyName,
            logoData: currentLogoData,
          });
          setLoadingBranding(false);
          console.log("[App] Configuração de branding definida:", {
            companyName: currentCompanyName,
            logoData: currentLogoData ? "[Base64 Data]" : null,
          });
        }
      }
    };

    loadBranding();
    // Depende de needsSetup e currentUser para rodar QUANDO o login acontece
  }, [needsSetup, currentUser]);
  // --- FIM NOVO EFEITO ---

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
  }, [themeMode]);

  const toggleThemeMode = () => {
    setThemeMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
  };

  const theme = useMemo(
    () => createTheme({ palette: { mode: themeMode } }),
    [themeMode]
  );

  // --- FUNÇÃO PARA MARCAR SETUP COMO COMPLETO ---
  // Será passada para InitialSetupScreen
  const handleSetupComplete = () => {
    console.log(
      "Setup complete, marking as done and forcing reload/redirect..."
    );
    setNeedsSetup(false); // Marca como feito no estado
    // Força um reload para que o main.js releia a config e inicialize o DB
    // Ou redireciona para login (reload é mais garantido para o backend)
    window.location.reload();
  };

  // --- RENDERIZAÇÃO CONDICIONAL PRINCIPAL ---

  // 1. Mostra loading enquanto verifica o setup
  if (checkingSetup || (currentUser && loadingBranding)) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
          }}
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Verificando configuração...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // 2. Se precisa de setup, mostra a tela de setup
  if (needsSetup === true) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <InitialSetupScreen onSetupComplete={handleSetupComplete} />
      </ThemeProvider>
    );
  }

  // 3. Se não precisa de setup E não está logado, mostra login
  if (needsSetup === false && !currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <LoginScreen onLoginSuccess={login} />
      </ThemeProvider>
    );
  }

  // 4. Se não precisa de setup E está logado, mostra interface principal
  if (needsSetup === false && currentUser) {
    const ComponentToRender =
      componentMap[activeComponent] ||
      (() => (
        <Typography>Componente '{activeComponent}' não encontrado.</Typography>
      ));
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{ display: "flex" }}>
          <AppSidebar
            onNavigate={setActiveComponent}
            userRole={currentUser.role}
            currentThemeMode={themeMode}
            toggleTheme={toggleThemeMode}
            companyName={brandingConfig.companyName}
            logoData={brandingConfig.logoData}
          />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              bgcolor: "background.default",
              p: 3,
              height: "100vh",
              overflowY: "auto",
            }}
          >
            <ComponentToRender />
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  // Fallback (não deve acontecer se a lógica acima estiver correta)
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Typography>Erro inesperado no estado da aplicação.</Typography>
    </ThemeProvider>
  );
}

export default App;
