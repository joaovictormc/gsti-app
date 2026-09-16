import { useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import {
  AppBar, Avatar, Box, Divider, Drawer, IconButton, List, ListItemButton, ListItemIcon, ListItemText,
  ListSubheader, Menu, MenuItem, Toolbar, Typography, useMediaQuery,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/SpaceDashboardOutlined";
import KeyIcon from "@mui/icons-material/VpnKeyOutlined";
import PeopleIcon from "@mui/icons-material/PeopleAltOutlined";
import ReceiptIcon from "@mui/icons-material/ReceiptLongOutlined";
import AutorenewIcon from "@mui/icons-material/AutorenewOutlined";
import SellIcon from "@mui/icons-material/SellOutlined";
import ArticleIcon from "@mui/icons-material/ArticleOutlined";
import GroupsIcon from "@mui/icons-material/BadgeOutlined";
import MonitorHeartIcon from "@mui/icons-material/MonitorHeartOutlined";
import HistoryIcon from "@mui/icons-material/HistoryOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { SessaoProvider, useSessao } from "./sessao";
import { Carregando } from "./components/comum";
import Login from "./pages/Login";
import Painel from "./pages/Painel";
import Licencas from "./pages/Licencas";
import LicencaDetalhe from "./pages/LicencaDetalhe";
import Clientes from "./pages/Clientes";
import ClienteDetalhe from "./pages/ClienteDetalhe";
import Pedidos from "./pages/Pedidos";
import PedidoDetalhe from "./pages/PedidoDetalhe";
import Assinaturas from "./pages/Assinaturas";
import Ofertas from "./pages/Ofertas";
import Conteudo from "./pages/Conteudo";
import Equipe from "./pages/Equipe";
import Sistema from "./pages/Sistema";
import Auditoria from "./pages/Auditoria";
import MinhaConta from "./pages/MinhaConta";

const LARGURA = 248;

const MENU = [
  { grupo: null, itens: [{ to: "/", rotulo: "Painel", icone: <DashboardIcon />, perm: "painel.ver", fim: true }] },
  {
    grupo: "Licenciamento",
    itens: [
      { to: "/licencas", rotulo: "Licenças", icone: <KeyIcon />, perm: "licencas.ver" },
      { to: "/clientes", rotulo: "Clientes", icone: <PeopleIcon />, perm: "clientes.ver" },
    ],
  },
  {
    grupo: "Vendas",
    itens: [
      { to: "/pedidos", rotulo: "Pedidos", icone: <ReceiptIcon />, perm: "pedidos.ver" },
      { to: "/assinaturas", rotulo: "Renovações automáticas", icone: <AutorenewIcon />, perm: "pedidos.ver" },
      { to: "/planos", rotulo: "Planos e preços", icone: <SellIcon />, perm: ["ofertas.editar", "pedidos.ver"] },
    ],
  },
  {
    grupo: "Site",
    itens: [{ to: "/conteudo", rotulo: "Textos e e-mails", icone: <ArticleIcon />, perm: ["conteudo.editar", "emails.editar"] }],
  },
  {
    grupo: "Administração",
    itens: [
      { to: "/equipe", rotulo: "Equipe", icone: <GroupsIcon />, perm: "usuarios.gerenciar" },
      { to: "/sistema", rotulo: "Sistema", icone: <MonitorHeartIcon />, perm: "sistema.ver" },
      { to: "/auditoria", rotulo: "Auditoria", icone: <HistoryIcon />, perm: "auditoria.ver" },
    ],
  },
];

function Rota({ perm, children }) {
  const { pode } = useSessao();
  const lista = [].concat(perm || []);
  if (lista.length && !lista.some(pode)) return <Navigate to="/" replace />;
  return children;
}

function Estrutura() {
  const { usuario, pode, sair } = useSessao();
  const telaGrande = useMediaQuery("(min-width:960px)");
  const [aberto, setAberto] = useState(false);
  const [menuConta, setMenuConta] = useState(null);
  const local = useLocation();

  const permitido = (p) => [].concat(p).some(pode);
  const inicio = pode("painel.ver") ? "/" : pode("conteudo.editar") || pode("emails.editar") ? "/conteudo" : "/minha-conta";

  const navegacao = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#10213a", color: "#dfe6f1" }}>
      <Toolbar sx={{ gap: 1.2 }}>
        <Box sx={{ width: 30, height: 30, borderRadius: "8px", bgcolor: "#f6f1e7", position: "relative", display: "grid", alignContent: "center", gap: "3px", px: "7px" }}>
          {["100%", "70%", "45%"].map((w) => <Box key={w} sx={{ height: 3, width: w, bgcolor: "#10213a", borderRadius: 1 }} />)}
          <Box sx={{ position: "absolute", right: 5, bottom: 5, width: 7, height: 7, borderRadius: "50%", bgcolor: "#ff6a2b" }} />
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 700, lineHeight: 1.1, color: "#f6f1e7" }}>GSTI App</Typography>
          <Typography variant="caption" sx={{ color: "#9fb0c9" }}>Painel</Typography>
        </Box>
      </Toolbar>
      <Box
        sx={{
          flex: "1 1 auto", minHeight: 0, overflowY: "auto", overscrollBehavior: "contain", pb: 2,
          // Barra de rolagem no tom do menu
          scrollbarWidth: "thin",
          scrollbarColor: "#2b4468 #10213a",
          "&::-webkit-scrollbar": { width: 8 },
          "&::-webkit-scrollbar-track": { background: "#10213a" },
          "&::-webkit-scrollbar-thumb": { background: "#2b4468", borderRadius: 4 },
          "&::-webkit-scrollbar-thumb:hover": { background: "#3a5277" },
        }}
      >
        {MENU.map(({ grupo, itens }) => {
          const visiveis = itens.filter((i) => permitido(i.perm));
          if (!visiveis.length) return null;
          return (
            <List
              key={grupo || "raiz"}
              dense
              subheader={
                grupo && (
                  <ListSubheader disableSticky sx={{ bgcolor: "#10213a", color: "#7f93b3", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase", lineHeight: "32px" }}>
                    {grupo}
                  </ListSubheader>
                )
              }
            >
              {visiveis.map((i) => (
                <ListItemButton
                  key={i.to}
                  component={NavLink}
                  to={i.to}
                  end={i.fim}
                  onClick={() => setAberto(false)}
                  sx={{
                    mx: 1, borderRadius: 2, color: "#dfe6f1", "& .MuiListItemIcon-root": { color: "#9fb0c9", minWidth: 36 },
                    "&.active": { bgcolor: "rgba(255,106,43,.14)", color: "#fff", "& .MuiListItemIcon-root": { color: "#ff6a2b" } },
                    "&:hover": { bgcolor: "rgba(255,255,255,.06)" },
                  }}
                >
                  <ListItemIcon>{i.icone}</ListItemIcon>
                  <ListItemText primary={i.rotulo} slotProps={{ primary: { fontWeight: 500, fontSize: 14 } }} />
                </ListItemButton>
              ))}
            </List>
          );
        })}
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,.08)" }} />
      <ListItemButton component="a" href="/" target="_blank" sx={{ color: "#9fb0c9", py: 1.5, flex: "none" }}>
        <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}><OpenInNewIcon fontSize="small" /></ListItemIcon>
        <ListItemText primary="Ver o site" slotProps={{ primary: { fontSize: 14 } }} />
      </ListItemButton>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar position="fixed" color="inherit" elevation={0} sx={{ ml: { md: `${LARGURA}px` }, width: { md: `calc(100% - ${LARGURA}px)` }, bgcolor: "rgba(244,241,234,.9)", backdropFilter: "blur(8px)", borderBottom: "1px solid #e2dccf" }}>
        <Toolbar>
          {!telaGrande && <IconButton edge="start" onClick={() => setAberto(true)} aria-label="Abrir menu" sx={{ mr: 1 }}><MenuIcon /></IconButton>}
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={(e) => setMenuConta(e.currentTarget)} aria-label="Minha conta">
            <Avatar sx={{ width: 34, height: 34, bgcolor: "#10213a", fontSize: 15 }}>{usuario.nome.slice(0, 1).toUpperCase()}</Avatar>
          </IconButton>
          <Menu anchorEl={menuConta} open={!!menuConta} onClose={() => setMenuConta(null)}>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography fontWeight={600}>{usuario.nome}</Typography>
              <Typography variant="body2" color="text.secondary">{usuario.email}</Typography>
            </Box>
            <Divider />
            <MenuItem component={NavLink} to="/minha-conta" onClick={() => setMenuConta(null)}>Minha conta</MenuItem>
            <MenuItem onClick={sair}>Sair</MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: LARGURA }, flexShrink: { md: 0 } }}>
        {telaGrande ? (
          <Drawer variant="permanent" open sx={{ "& .MuiDrawer-paper": { width: LARGURA } }}>{navegacao}</Drawer>
        ) : (
          <Drawer open={aberto} onClose={() => setAberto(false)} sx={{ "& .MuiDrawer-paper": { width: LARGURA } }}>{navegacao}</Drawer>
        )}
      </Box>

      <Box component="main" key={local.pathname} sx={{ flex: 1, minWidth: 0, px: { xs: 2, sm: 3, lg: 5 }, pt: 11, pb: 6, maxWidth: 1400 }}>
        <Routes>
          <Route path="/" element={pode("painel.ver") ? <Painel /> : <Navigate to={inicio} replace />} />
          <Route path="/licencas" element={<Rota perm="licencas.ver"><Licencas /></Rota>} />
          <Route path="/licencas/:id" element={<Rota perm="licencas.ver"><LicencaDetalhe /></Rota>} />
          <Route path="/clientes" element={<Rota perm="clientes.ver"><Clientes /></Rota>} />
          <Route path="/clientes/:id" element={<Rota perm="clientes.ver"><ClienteDetalhe /></Rota>} />
          <Route path="/pedidos" element={<Rota perm="pedidos.ver"><Pedidos /></Rota>} />
          <Route path="/pedidos/:id" element={<Rota perm="pedidos.ver"><PedidoDetalhe /></Rota>} />
          <Route path="/assinaturas" element={<Rota perm="pedidos.ver"><Assinaturas /></Rota>} />
          <Route path="/planos" element={<Rota perm={["ofertas.editar", "pedidos.ver"]}><Ofertas /></Rota>} />
          <Route path="/conteudo" element={<Rota perm={["conteudo.editar", "emails.editar"]}><Conteudo /></Rota>} />
          <Route path="/conteudo/:chave" element={<Rota perm={["conteudo.editar", "emails.editar"]}><Conteudo /></Rota>} />
          <Route path="/equipe" element={<Rota perm="usuarios.gerenciar"><Equipe /></Rota>} />
          <Route path="/sistema" element={<Rota perm="sistema.ver"><Sistema /></Rota>} />
          <Route path="/auditoria" element={<Rota perm="auditoria.ver"><Auditoria /></Rota>} />
          <Route path="/minha-conta" element={<MinhaConta />} />
          <Route path="*" element={<Navigate to={inicio} replace />} />
        </Routes>
      </Box>
    </Box>
  );
}

function Portao() {
  const { usuario, carregando } = useSessao();
  if (carregando) return <Carregando />;
  if (!usuario) return <Login />;
  return <Estrutura />;
}

export default function App() {
  return (
    <SessaoProvider>
      <Portao />
    </SessaoProvider>
  );
}
