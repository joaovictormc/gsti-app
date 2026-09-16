import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import {
  Alert,
  Avatar,
  Box,
  Collapse,
  CssBaseline,
  GlobalStyles,
  ThemeProvider,
  Tooltip,
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
  BarChart as BarChartIcon,
  ExpandLess,
  ExpandMore,
  Home as HomeIcon,
  Logout as LogoutIcon,
  Settings as SettingsIcon,
  CalendarMonth as CalendarMonthIcon,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  Inventory as InventoryStockIcon,
  TrendingDown as TrendingDownIcon,
  TrendingUp as TrendingUpIcon,
  Shield as ShieldIcon,
  ManageAccounts as ManageAccountsIcon,
  DevicesOther as DevicesOtherIcon,
} from "@mui/icons-material";
import { useAuth } from "./contexts/AuthContext";

import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";
import WarrantyPanel from "./screens/WarrantyPanel";
import OSAgenda from "./screens/OSAgenda";
import StockControl from "./screens/StockControl";
import ProfitabilityReport from "./screens/ProfitabilityReport";
import CustomerGrid from "./components/CustomerGrid";
import EquipmentGrid from "./components/EquipmentGrid";
import ProductServiceGrid from "./components/ProductServiceGrid";
import OSGrid from "./components/OSGrid";
import ExpensesGrid from "./components/ExpensesGrid";
import FinancialDashboard from "./components/FinancialPages/FinancialDashboard";
import MiscRevenueGrid from "./components/MiscRevenueGrid";
import OSReportClient from "./components/OSReportClient";
import OSReportStatus from "./components/OSReportStatus";
import OSReportAttendant from "./components/OSReportAttendant";
import OSReportOpenAging from "./components/OSReportOpenAging";
import MostUsedServicesReport from "./components/MostUsedServicesReport";
import EquipmentHistoryReport from "./components/EquipmentHistoryReport";
import DetailedRevenueReport from "./components/DetailedRevenueReport";
import UserManagement from "./components/UserManagement";
import InitialSetupScreen from "./screens/InitialSetupScreen";
import ReactivationScreen from "./screens/ReactivationScreen";
import SettingsScreen from "./components/SettingsScreen";

const drawerWidth = 240; // Largura da Sidebar

// Mapeia nomes de componentes
const componentMap = {
  CustomerGrid,
  EquipmentGrid,
  ProductServiceGrid,
  OSGrid,
  ExpensesGrid,
  MiscRevenueGrid,
  FinancialDashboard,
  OSReportClient,
  OSReportStatus,
  OSReportAttendant,
  OSReportOpenAging,
  MostUsedServicesReport,
  EquipmentHistoryReport,
  DetailedRevenueReport,
  UserManagement,
  SettingsScreen,
  HomeScreen,
  WarrantyPanel,
  OSAgenda,
  StockControl,
  ProfitabilityReport,
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

const COLLAPSED_WIDTH = 60;

// Componente Sidebar usando MUI Drawer
function AppSidebar({
  onNavigate,
  currentView,
  userRole,
  currentThemeMode,
  toggleTheme,
  companyName,
  logoData,
  isOpen,
  onToggle,
}) {
  const { logout, currentUser, permissoes } = useAuth();
  const [reportsOpen, setReportsOpen] = useState(false);
  const st = getSidebarTheme(currentThemeMode);

  // Fecha o submenu ao recolher
  React.useEffect(() => { if (!isOpen) setReportsOpen(false); }, [isOpen]);

  const isAdmin = userRole === "Admin";
  const canSeeFinancial = !!permissoes.canSeeFinancial;
  const canSeeReports = !!permissoes.canSeeReports;

  const menuItems = [
    { label: "Início", component: "HomeScreen", icon: <HomeIcon /> },
    { label: "Clientes", component: "CustomerGrid", icon: <PeopleIcon /> },
    { label: "Equipamentos", component: "EquipmentGrid", icon: <DevicesOtherIcon /> },
    { label: "Produtos/Serviços", component: "ProductServiceGrid", icon: <InventoryIcon /> },
    { label: "Ordens de Serviço", component: "OSGrid", icon: <AssignmentIcon /> },
    ...(canSeeFinancial ? [
      { label: "Despesas", component: "ExpensesGrid", icon: <TrendingDownIcon sx={{ color: st.expenseIcon }} /> },
      { label: "Receitas Avulsas", component: "MiscRevenueGrid", icon: <TrendingUpIcon sx={{ color: st.revenueIcon }} /> },
      { label: "Resumo Financeiro", component: "FinancialDashboard", icon: <BarChartIcon /> },
    ] : []),
    { label: "Garantias", component: "WarrantyPanel", icon: <ShieldIcon /> },
    { label: "Agenda de OS", component: "OSAgenda", icon: <CalendarMonthIcon /> },
    { label: "Estoque", component: "StockControl", icon: <InventoryStockIcon /> },
    ...(canSeeReports ? [
      {
        label: "Relatórios",
        icon: <AssessmentIcon />,
        subItems: [
          { label: "OS por Cliente", component: "OSReportClient" },
          { label: "OS por Status", component: "OSReportStatus" },
          { label: "OS Abertas por Tempo", component: "OSReportOpenAging" },
          { label: "OS por Atendente", component: "OSReportAttendant" },
          ...(permissoes.verCusto ? [{ label: "Lucratividade", component: "ProfitabilityReport" }] : []),
          { label: "Serviços Mais Usados", component: "MostUsedServicesReport" },
          { label: "Histórico Equipamento", component: "EquipmentHistoryReport" },
          { label: "Receitas Detalhadas", component: "DetailedRevenueReport" },
        ],
      },
    ] : []),
    ...(isAdmin ? [
      { label: "Gerenciar Usuários", component: "UserManagement", icon: <ManageAccountsIcon /> },
      { label: "Configurações", component: "SettingsScreen", icon: <SettingsIcon /> },
    ] : []),
  ];

  const navItemSx = (component) => ({
    mx: 1,
    borderRadius: 2,
    color: st.text,
    mb: 0.25,
    justifyContent: isOpen ? 'flex-start' : 'center',
    px: isOpen ? undefined : 1,
    '& .MuiListItemIcon-root': { color: 'inherit', minWidth: isOpen ? 36 : 'auto' },
    '&:hover': { bgcolor: st.hover },
    ...(currentView === component && {
      bgcolor: 'primary.main',
      color: 'white',
      '& .MuiListItemIcon-root': { color: 'white', minWidth: isOpen ? 36 : 'auto' },
      '&:hover': { bgcolor: 'primary.dark' },
    }),
  });

  const withTip = (label, el) =>
    isOpen ? el : <Tooltip title={label} placement="right" arrow>{el}</Tooltip>;

  const currentWidth = isOpen ? drawerWidth : COLLAPSED_WIDTH;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        transition: 'width 0.25s ease',
        [`& .MuiDrawer-paper`]: {
          width: currentWidth,
          boxSizing: 'border-box',
          bgcolor: st.bg,
          borderRight: st.border,
          boxShadow: st.shadow,
          overflowX: 'hidden',
          transition: 'width 0.25s ease',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{
          py: isOpen ? 2.5 : 1.5, px: isOpen ? 2 : 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          borderBottom: `1px solid ${st.divider}`,
        }}>
          {isOpen ? (
            <>
              {logoData && (
                <img src={logoData} alt="" style={{ maxHeight: 44, maxWidth: '80%', marginBottom: 6, objectFit: 'contain' }} />
              )}
              <Typography variant="h6" noWrap sx={{ color: st.text, fontWeight: 700, letterSpacing: 0.5 }}>
                {companyName || 'GSTI App'}
              </Typography>
            </>
          ) : (
            logoData ? (
              <img src={logoData} alt="" style={{ width: 36, height: 36, objectFit: 'contain' }} />
            ) : (
              <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: 'white', fontWeight: 700, fontSize: '1rem' }}>
                  {(companyName || 'G')[0].toUpperCase()}
                </Typography>
              </Box>
            )
          )}
          <Tooltip title={isOpen ? 'Recolher menu' : 'Expandir menu'} placement="right">
            <IconButton onClick={onToggle} size="small" sx={{ color: st.subtext, mt: 1, '&:hover': { bgcolor: st.hover } }}>
              {isOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Navegação */}
        <List sx={{ flexGrow: 1, pt: 1, px: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map((item) => {
            if (item.subItems) {
              const anySubActive = item.subItems.some((s) => s.component === currentView);

              // Colapsado: ícone único que navega para o primeiro sub-item
              if (!isOpen) {
                return (
                  <ListItem key={item.label} disablePadding>
                    {withTip(item.label,
                      <ListItemButton
                        onClick={() => onNavigate(item.subItems[0].component)}
                        sx={{ ...navItemSx(anySubActive ? currentView : '__none__'), justifyContent: 'center' }}
                      >
                        <ListItemIcon sx={{ color: anySubActive ? 'primary.main' : st.text, minWidth: 'auto' }}>
                          {item.icon}
                        </ListItemIcon>
                      </ListItemButton>
                    )}
                  </ListItem>
                );
              }

              // Expandido: submenu normal
              const isSubOpen = item.label === 'Relatórios' ? reportsOpen : false;
              const handleSubClick = item.label === 'Relatórios' ? () => setReportsOpen((r) => !r) : () => {};
              return (
                <React.Fragment key={item.label}>
                  <ListItemButton onClick={handleSubClick} sx={{ mx:1, borderRadius:2, mb:0.25, color: anySubActive ? 'primary.main' : st.text, '& .MuiListItemIcon-root':{ color:'inherit', minWidth:36 }, '&:hover':{ bgcolor: st.hover } }}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    <ListItemText primary={item.label} />
                    {isSubOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={isSubOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {item.subItems.map((sub) => (
                        <ListItemButton key={sub.label} onClick={() => onNavigate(sub.component)}
                          sx={{ pl:5, mx:1, borderRadius:2, mb:0.25, color: st.subtext,
                            '& .MuiListItemIcon-root':{ color:'inherit', minWidth:28 },
                            '&:hover':{ bgcolor: st.hover, color: st.text },
                            ...(currentView === sub.component && { bgcolor:'primary.main', color:'white', '&:hover':{ bgcolor:'primary.dark' } }) }}>
                          <ListItemIcon>{sub.icon || <Box sx={{ width:20 }} />}</ListItemIcon>
                          <ListItemText primary={sub.label} primaryTypographyProps={{ fontSize:'0.875rem' }} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                </React.Fragment>
              );
            }

            return (
              <ListItem key={item.label} disablePadding>
                {withTip(item.label,
                  <ListItemButton onClick={() => onNavigate(item.component)} sx={navItemSx(item.component)}>
                    <ListItemIcon>{item.icon}</ListItemIcon>
                    {isOpen && <ListItemText primary={item.label} />}
                  </ListItemButton>
                )}
              </ListItem>
            );
          })}
        </List>

        {/* Footer */}
        <Box sx={{ p: isOpen ? 2 : 1, borderTop: `1px solid ${st.divider}`, display:'flex', flexDirection:'column', alignItems: isOpen ? 'stretch' : 'center', gap: 1 }}>
          <Box sx={{ display:'flex', alignItems:'center', gap: isOpen ? 1 : 0, justifyContent: isOpen ? 'flex-start' : 'center', mb: isOpen ? 0.5 : 0 }}>
            <Tooltip title={currentUser?.nome || ''} placement="right" disableHoverListener={isOpen}>
              <Avatar sx={{ bgcolor:'primary.main', width:32, height:32, fontSize:'0.75rem', flexShrink:0 }}>
                {getInitials(currentUser?.nome)}
              </Avatar>
            </Tooltip>
            {isOpen && <Typography variant="caption" noWrap sx={{ color: st.text, flex:1 }}>{currentUser?.nome}</Typography>}
            {isOpen && (
              <IconButton onClick={toggleTheme} size="small" sx={{ color: st.subtext }} title={currentThemeMode === 'dark' ? 'Tema claro' : 'Tema escuro'}>
                {currentThemeMode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
              </IconButton>
            )}
          </Box>
          {!isOpen && (
            <Tooltip title="Alternar tema" placement="right">
              <IconButton onClick={toggleTheme} size="small" sx={{ color: st.subtext }}>
                {currentThemeMode === 'dark' ? <Brightness7Icon fontSize="small" /> : <Brightness4Icon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
          {isOpen ? (
            <Button variant="outlined" color="error" onClick={logout} size="small" startIcon={<LogoutIcon />} fullWidth>Logout</Button>
          ) : (
            <Tooltip title="Logout" placement="right">
              <IconButton onClick={logout} size="small" sx={{ color:'#f87171' }}><LogoutIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>
    </Drawer>
  );
}

function App() {
  const { currentUser, login, permissoes } = useAuth();
  const [activeComponent, setActiveComponent] = useState("HomeScreen"); // Inicia na HomeScreen
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem("themeMode") || "light"
  );
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem("sidebarOpen") !== "false"
  );
  const toggleSidebar = () =>
    setSidebarOpen((prev) => {
      localStorage.setItem("sidebarOpen", String(!prev));
      return !prev;
    });
  const [needsSetup, setNeedsSetup] = useState(null); // null = verificando, true = precisa, false = não precisa
  const [checkingSetup, setCheckingSetup] = useState(true); // Para mostrar loading inicial
  const [licenseActive, setLicenseActive] = useState(null); // null = verificando, true/false
  const [licenseMotivo, setLicenseMotivo] = useState("");
  const [licenseStatus, setLicenseStatus] = useState(null); // status completo (avisos de vencimento)
  const [licenseBannerClosed, setLicenseBannerClosed] = useState(false);

  const [brandingConfig, setBrandingConfig] = useState({
    companyName: "GSTI App",
    logoData: null,
  });
  const [loadingBranding, setLoadingBranding] = useState(false);
  const [marcaRevisao, setMarcaRevisao] = useState(0);
  // Tela de carregamento só na primeira carga após o login (não ao salvar Configurações)
  const marcaCarregada = useRef(false);
  if (!currentUser) marcaCarregada.current = false;
  useEffect(() => {
    const recarregar = () => setMarcaRevisao((n) => n + 1);
    window.addEventListener("gsti:configuracoes-salvas", recarregar);
    return () => window.removeEventListener("gsti:configuracoes-salvas", recarregar);
  }, []);
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

  // --- EFEITO: Verificar licença (após confirmar que o setup está completo) ---
  const checkLicense = async () => {
    try {
      // Status local imediato (assinatura + validade)
      const local = await window.api.getLicenseStatus();
      let status = local?.status || { active: false, motivo: "Sem licença." };
      // Revalidação online best-effort (revogação); offline mantém o status local
      try {
        const revalid = await window.api.revalidateLicense();
        if (revalid?.status) status = revalid.status;
      } catch (_) {
        /* offline — mantém status local */
      }
      setLicenseStatus(status);
      setLicenseActive(!!status.active);
      setLicenseMotivo(status.motivo || "");
    } catch (error) {
      console.error("Erro ao verificar licença:", error);
      // Em caso de falha inesperada, não bloqueia indevidamente
      setLicenseActive(true);
    }
  };

  useEffect(() => {
    if (needsSetup === false) {
      checkLicense();
    } else if (needsSetup === true) {
      // Durante o setup a ativação é tratada na própria tela de setup
      setLicenseActive(true);
    }
  }, [needsSetup]);
  // --- FIM EFEITO LICENÇA ---

  // --- NOVO EFEITO: Carregar Configurações de Branding após Login ---
  useEffect(() => {
    const loadBranding = async () => {
      // Só executa se o setup estiver completo E houver um usuário logado
      if (needsSetup === false && currentUser) {
        console.log("[App] Carregando configurações de branding...");
        if (!marcaCarregada.current) setLoadingBranding(true);
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
          document.title = currentCompanyName;
          marcaCarregada.current = true;
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
  }, [needsSetup, currentUser, marcaRevisao]);
  // --- FIM NOVO EFEITO ---

  useEffect(() => {
    localStorage.setItem("themeMode", themeMode);
    window.dispatchEvent(new CustomEvent("gsti:tema", { detail: themeMode })); // barra de título
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
          // O menu lateral é fixo: começa abaixo da barra de título
          MuiDrawer: { styleOverrides: { paper: { top: 'var(--gsti-barra)', height: 'var(--gsti-vh)' } } },
          // Diálogos centralizados na área abaixo da barra de título
          MuiDialog: { styleOverrides: { root: { top: 'var(--gsti-barra)' } } },
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
            height: "var(--gsti-vh)",
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

  // 2b. Setup completo mas ainda verificando a licença
  if (needsSetup === false && licenseActive === null) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "var(--gsti-vh)",
          }}
        >
          <CircularProgress />
          <Typography sx={{ ml: 2 }}>Verificando licença...</Typography>
        </Box>
      </ThemeProvider>
    );
  }

  // 2c. Licença expirada/revogada/inválida — exige reativação antes do login
  if (needsSetup === false && licenseActive === false) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <ReactivationScreen
          motivo={licenseMotivo}
          codigo={licenseStatus?.codigo}
          onReactivated={() => {
            setLicenseActive(null);
            checkLicense();
          }}
        />
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
    const isAdmin = currentUser.role === "Admin";
    const financialComponents = ["ExpensesGrid", "MiscRevenueGrid", "FinancialDashboard"];
    const reportComponents = ["OSReportClient", "OSReportStatus", "OSReportAttendant", "OSReportOpenAging", "ProfitabilityReport", "MostUsedServicesReport", "EquipmentHistoryReport", "DetailedRevenueReport"];
    const isAccessDenied =
      !isAdmin &&
      ((financialComponents.includes(activeComponent) && !permissoes.canSeeFinancial) ||
       (reportComponents.includes(activeComponent) && !permissoes.canSeeReports) ||
       (activeComponent === "ProfitabilityReport" && !permissoes.verCusto) ||
       ["UserManagement", "SettingsScreen"].includes(activeComponent));

    // Aviso de vencimento (15, 7 e 1 dia) ou de revalidação pendente
    let licenseWarning = null;
    const dias = licenseStatus?.diasRestantes;
    if (licenseStatus?.active && dias != null && dias <= 15) {
      const oque = licenseStatus.tipo === "trial" ? "O período de teste" : "Sua licença";
      licenseWarning = {
        severity: dias <= 7 ? "error" : "warning",
        text: `${oque} termina em ${dias} dia(s). ${
          licenseStatus.tipo === "trial" ? "Adquira uma licença" : "Renove"
        } para continuar usando o sistema sem interrupção.`,
      };
    } else if (licenseStatus?.active && licenseStatus.avisoRevalidar) {
      licenseWarning = {
        severity: "warning",
        text: `A licença não é verificada online há algum tempo. Conecte-se à internet nos próximos ${licenseStatus.diasParaRevalidar} dia(s) para evitar o bloqueio.`,
      };
    }

    const ComponentToRender = isAccessDenied
      ? () => (
          <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
            <Typography color="error">
              Acesso restrito. Solicite ao administrador.
            </Typography>
          </Box>
        )
      : componentMap[activeComponent] ||
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
            isOpen={sidebarOpen}
            onToggle={toggleSidebar}
          />
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              bgcolor: "background.default",
              p: 3,
              height: "var(--gsti-vh)",
              overflowY: "auto",
            }}
          >
            {licenseWarning && !licenseBannerClosed && (
              <Alert
                severity={licenseWarning.severity}
                onClose={() => setLicenseBannerClosed(true)}
                sx={{ mb: 2 }}
              >
                {licenseWarning.text}
              </Alert>
            )}
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
