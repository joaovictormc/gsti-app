import React, { useState, useMemo, useEffect } from 'react';
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
  // Adicione uma tela inicial se desejar
  HomeScreen: () => (
    <Typography variant="h5" sx={{ textAlign: "center", mt: 4 }}>
      Bem-vindo ao GSTI!
    </Typography>
  ),
};

// Componente Sidebar usando MUI Drawer
function AppSidebar({ onNavigate, userRole, currentThemeMode, toggleTheme }) {
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
        <Typography variant="h6" sx={{ textAlign: "center", my: 2 }}>
          GSTI App
        </Typography>
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

  // Tela de Login
  if (!currentUser) {
    return (
      <ThemeProvider theme={theme}>
        {" "}
        <CssBaseline /> <LoginScreen onLoginSuccess={login} />{" "}
      </ThemeProvider>
    );
  }

  // Interface Principal
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
        />
        {/* Área de Conteúdo Principal */}
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            bgcolor: "background.default",
            p: 3,
            height: "100vh", // Ocupa altura total
            overflowY: "auto", // Adiciona scroll se necessário
          }}
        >
          {/* Adiciona um espaço no topo para não colar na barra (se houver) */}
          {/* <Toolbar /> // Descomente se usar AppBar */}
          <ComponentToRender />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
