import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  Avatar,
  Box,
  Collapse,
  CssBaseline,
  GlobalStyles,
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

const getSidebarTheme = (mode) => {
  const isLight = mode === 'light';
  return {
    bg:          isLight ? '#ffffff'                : '#0c1424',
    text:        isLight ? '#1e293b'                : 'rgba(255,255,255,0.85)',
    subtext:     isLight ? '#64748b'                : 'rgba(255,255,255,0.55)',
    divider:     isLight ? '#e2e8f0'                : 'rgba(255,255,255,0.08)',
    hover:       isLight ? 'rgba(99,102,241,0.08)'  : 'rgba(255,255,255,0.06)',
    shadow:      isLight ? '2px 0 8px rgba(0,0,0,0.06)' : '2px 0 16px rgba(0,0,0,0.5)',
    border:      isLight ? '1px solid #e2e8f0'      : 'none',
    expenseIcon: isLight ? '#dc2626'                : '#f87171',
    revenueIcon: isLight ? '#16a34a'                : '#4ade80',
  };
};

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase();
};

// Componente Sidebar usando MUI Drawer
function AppSidebar({
  onNavigate,
  currentView,
  userRole,
  currentThemeMode,
  toggleTheme,
  companyName,
  logoData,
}) {
  const { logout, currentUser } = useAuth();
  const [reportsOpen, setReportsOpen] = useState(false);
  const st = getSidebarTheme(currentThemeMode);

  const menuItems = [
    { label: "Início", component: "HomeScreen", icon: <HomeIcon /> },
    { label: "Clientes", component: "CustomerGrid", icon: <PeopleIcon /> },
    { label: "Produtos/Serviços", component: "ProductServiceGrid", icon: <InventoryIcon /> },
    { label: "Ordens de Serviço", component: "OSGrid", icon: <AssignmentIcon /> },
    { label: "Despesas", component: "ExpensesGrid", icon: <AttachMoneyIcon sx={{ color: st.expenseIcon }} /> },
    { label: "Receitas Avulsas", component: "MiscRevenueGrid", icon: <AttachMoneyIcon sx={{ color: st.revenueIcon }} /> },
    { label: "Resumo Financeiro", component: "FinancialDashboard", icon: <BarChartIcon /> },
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
    ...(userRole === "Admin"
      ? [
          { label: "Gerenciar Usuários", component: "UserManagement", icon: <SettingsIcon /> },
          { label: "Configurações", component: "SettingsScreen", icon: <SettingsIcon /> },
        ]
      : []),
  ];

  const activeItemSx = (component) => ({
    mx: 1,
    borderRadius: 2,
    color: st.text,
    mb: 0.25,
    '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 36 },
    '&:hover': { bgcolor: st.hover },
    ...(currentView === component && {
      bgcolor: 'primary.main',
      color: 'white',
      '& .MuiListItemIcon-root': { color: 'white', minWidth: 36 },
      '&:hover': { bgcolor: 'primary.dark' },
    }),
  });

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        [`& .MuiDrawer-paper`]: {
          width: drawerWidth,
          boxSizing: 'border-box',
          bgcolor: st.bg,
          borderRight: st.border,
          boxShadow: st.shadow,
        },
      }}
    >
      <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header: Logo + Nome */}
        <Box sx={{ py: 3, px: 2, textAlign: 'center', borderBottom: `1px solid ${st.divider}` }}>
          {logoData && (
            <img
              src={logoData}
              alt={`${companyName || 'Logo'}`}
              style={{ maxHeight: 48, maxWidth: '80%', marginBottom: 8, objectFit: 'contain' }}
            />
          )}
          <Typography variant="h6" noWrap sx={{ color: st.text, fontWeight: 700, letterSpacing: 0.5 }}>
            {companyName || 'GSTI App'}
          </Typography>
        </Box>

        {/* Navegação */}
        <List sx={{ flexGrow: 1, pt: 1, px: 0 }}>
          {menuItems.map((item) => {
            if (item.subItems) {
              const isOpen = item.label === 'Relatórios' ? reportsOpen : false;
              const handleClick = item.label === 'Relatórios' ? () => setReportsOpen((r) => !r) : () => {};
              const anySubActive = item.subItems.some((s) => s.component === currentView);

              return (
                <React.Fragment key={item.label}>
                  <ListItemButton
                    onClick={handleClick}
                    sx={{
                      mx: 1,
                      borderRadius: 2,
                      mb: 0.25,
                      color: anySubActive ? 'primary.main' : st.text,
                      '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 36 },
                      '&:hover': { bgcolor: st.hover },
                    }}
                  >
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {isOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={isOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems.map((subItem) => (
                        <ListItemButton
                          key={subItem.label}
                          onClick={() => onNavigate(subItem.component)}
                          sx={{
                            pl: 5,
                            mx: 1,
                            borderRadius: 2,
                            mb: 0.25,
                            color: st.subtext,
                            '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 28 },
                            '&:hover': { bgcolor: st.hover, color: st.text },
                            ...(currentView === subItem.component && {
                              bgcolor: 'primary.main',
                              color: 'white',
                              '&:hover': { bgcolor: 'primary.dark' },
                            }),
                          }}
                        >
                          <ListItemIcon>
                            {subItem.icon || <Box sx={{ width: 20 }} />}
                          </ListItemIcon>
                          <ListItemText
                            primary={subItem.label}
                            primaryTypographyProps={{ fontSize: '0.875rem' }}
                          />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            }

            return (
              <ListItem key={item.label} disablePadding>
                <ListItemButton onClick={() => onNavigate(item.component)} sx={activeItemSx(item.component)}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>

        {/* Footer: usuário + tema + logout */}
        <Box sx={{ p: 2, borderTop: `1px solid ${st.divider}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32, fontSize: '0.75rem' }}>
              {getInitials(currentUser?.nome)}
            </Avatar>
            <Typography variant="caption" noWrap sx={{ color: st.text, flex: 1 }}>
              {currentUser?.nome}
            </Typography>
            <IconButton
              onClick={toggleTheme}
              size="small"
              sx={{ color: st.subtext }}
              title={currentThemeMode === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {currentThemeMode === 'dark' ? (
                <Brightness7Icon fontSize="small" />
              ) : (
                <Brightness4Icon fontSize="small" />
              )}
            </IconButton>
          </Box>
          <Button
            variant="outlined"
            color="error"
            onClick={logout}
            size="small"
            startIcon={<LogoutIcon />}
            fullWidth
          >
            Logout
          </Button>
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
    () =>
      createTheme({
        palette: {
          mode: themeMode,
          primary: { main: '#6366f1' },
          secondary: { main: '#06b6d4' },
          background: {
            default: themeMode === 'light' ? '#f1f5f9' : '#0a1120',
            paper:   themeMode === 'light' ? '#ffffff'  : '#111c2e',
          },
        },
        typography: {
          fontFamily: '"Inter", "Roboto", sans-serif',
          h4: { fontWeight: 700 },
          h6: { fontWeight: 600 },
        },
        shape: { borderRadius: 12 },
        components: {
          MuiButton: { styleOverrides: { root: { textTransform: 'none', borderRadius: 8 } } },
          MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
          MuiDataGrid: { styleOverrides: { root: { borderRadius: 12, border: 'none' } } },
        },
      }),
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
        <GlobalStyles styles={(theme) => ({
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-track': { background: theme.palette.background.default },
          '*::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'light' ? '#cbd5e1' : '#1e293b',
            borderRadius: 4,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            background: theme.palette.mode === 'light' ? '#94a3b8' : '#334155',
          },
        })} />
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
        <GlobalStyles styles={(theme) => ({
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-track': { background: theme.palette.background.default },
          '*::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'light' ? '#cbd5e1' : '#1e293b',
            borderRadius: 4,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            background: theme.palette.mode === 'light' ? '#94a3b8' : '#334155',
          },
        })} />
        <InitialSetupScreen onSetupComplete={handleSetupComplete} />
      </ThemeProvider>
    );
  }

  // 3. Se não precisa de setup E não está logado, mostra login
  if (needsSetup === false && !currentUser) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <GlobalStyles styles={(theme) => ({
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-track': { background: theme.palette.background.default },
          '*::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'light' ? '#cbd5e1' : '#1e293b',
            borderRadius: 4,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            background: theme.palette.mode === 'light' ? '#94a3b8' : '#334155',
          },
        })} />
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
        <GlobalStyles styles={(theme) => ({
          '*::-webkit-scrollbar': { width: 8, height: 8 },
          '*::-webkit-scrollbar-track': { background: theme.palette.background.default },
          '*::-webkit-scrollbar-thumb': {
            background: theme.palette.mode === 'light' ? '#cbd5e1' : '#1e293b',
            borderRadius: 4,
          },
          '*::-webkit-scrollbar-thumb:hover': {
            background: theme.palette.mode === 'light' ? '#94a3b8' : '#334155',
          },
        })} />
        <Box sx={{ display: "flex" }}>
          <AppSidebar
            onNavigate={setActiveComponent}
            currentView={activeComponent}
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
