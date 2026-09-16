import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  FormControlLabel,
  Switch,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import TuneIcon from "@mui/icons-material/Tune";
import InventoryIcon from "@mui/icons-material/Inventory";
import BarChartIcon from "@mui/icons-material/BarChart";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import { useAuth } from "../contexts/AuthContext";

const STATUS_COLORS = {
  Orçamento: "default",
  "Em Aberto": "warning",
  "Aguardando Autorização": "secondary",
  "Aguardando Peça": "warning",
  "Em Andamento": "primary",
};

const formatCurrency = (v) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const formatDate = (v) => {
  if (!v) return "";
  return new Date(v).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

const DEFAULT_WIDGETS = {
  cardAbertas: true,
  cardAndamento: true,
  cardFinalizadas: true,
  cardLucro: true,
  secaoGarantias: true,
  secaoUltimasOS: true,
  secaoEstoque: false,
  secaoServicos: false,
  secaoAgenda: false,
  secaoFinanceiro: false,
};

// ---------- Componentes auxiliares ----------

function KpiCard({ gradient, icon: Icon, label, value, loading, isCurrency = false }) {
  return (
    <Box sx={{
      background: gradient, borderRadius: 3, p: 2.5, color: "white",
      display: "flex", alignItems: "center", gap: 2, height: "100%",
      boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
      transition: "transform 0.15s ease, box-shadow 0.15s ease",
      "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 28px rgba(0,0,0,0.22)" },
    }}>
      <Box sx={{ bgcolor: "rgba(255,255,255,0.18)", borderRadius: 2.5, p: 1.5, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon sx={{ fontSize: 30, color: "white" }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ opacity: 0.82, display: "block", mb: 0.5 }}>{label}</Typography>
        {loading
          ? <CircularProgress size={22} sx={{ color: "rgba(255,255,255,0.8)" }} />
          : <Typography variant="h5" fontWeight={700}>{isCurrency ? formatCurrency(value) : value}</Typography>
        }
      </Box>
    </Box>
  );
}

function WarrantyBadge({ days }) {
  if (days <= 7) return <Chip label={`${days}d`} color="error" size="small" />;
  if (days <= 15) return <Chip label={`${days}d`} color="warning" size="small" />;
  return <Chip label={`${days}d`} color="success" size="small" variant="outlined" />;
}

function SectionCard({ icon: Icon, title, loading, children, emptyText }) {
  return (
    <Paper sx={{ p: 2.5, height: "100%" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <Icon color="primary" />
        <Typography variant="h6" fontWeight={600}>{title}</Typography>
      </Box>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
      ) : children ?? (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography color="text.secondary" variant="body2">{emptyText}</Typography>
        </Box>
      )}
    </Paper>
  );
}

// ---------- Seções autônomas ----------

function SecaoEstoqueCritico() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await window.api.getStock();
      if (result.success)
        setData(result.data.filter((p) => p.tipo === "Produto" && Number(p.estoque_atual) <= Number(p.estoque_minimo)));
      setLoading(false);
    })();
  }, []);

  const items = data?.slice(0, 5) ?? [];
  return (
    <SectionCard icon={InventoryIcon} title="Estoque Crítico" loading={loading}
      emptyText="Nenhum produto abaixo do mínimo.">
      {!loading && (
        <>
          {items.length === 0 ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <CheckCircleIcon sx={{ fontSize: 36, color: "success.main", mb: 1 }} />
              <Typography color="text.secondary" variant="body2">Nenhum produto abaixo do mínimo.</Typography>
            </Box>
          ) : (
            <>
              {items.map((p, i) => (
                <Box key={p.id}>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1 }}>
                    <Typography variant="body2" noWrap sx={{ flex: 1, mr: 1 }}>{p.descricao}</Typography>
                    <Chip
                      label={p.estoque_atual === 0 ? "Zerado" : `${p.estoque_atual}/${p.estoque_minimo}`}
                      color={p.estoque_atual === 0 ? "error" : "warning"}
                      size="small"
                    />
                  </Box>
                  {i < items.length - 1 && <Divider />}
                </Box>
              ))}
              {(data?.length ?? 0) > 5 && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  +{data.length - 5} item(ns) adicionais com estoque crítico
                </Typography>
              )}
            </>
          )}
        </>
      )}
    </SectionCard>
  );
}

function SecaoServicos() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const today = new Date();
      const past30 = new Date(Date.now() - 30 * 86400000);
      const fmt = (d) => d.toISOString().slice(0, 10);
      const result = await window.api.getMostUsedServices({ startDate: fmt(past30), endDate: fmt(today) });
      if (result.success) setData(result.data.slice(0, 5));
      setLoading(false);
    })();
  }, []);

  return (
    <SectionCard icon={BarChartIcon} title="Serviços Mais Utilizados" loading={loading}
      emptyText="Nenhum serviço registrado nos últimos 30 dias.">
      {!loading && (
        <>
          {!data?.length ? (
            <Box sx={{ py: 4, textAlign: "center" }}>
              <Typography color="text.secondary" variant="body2">Nenhum serviço nos últimos 30 dias.</Typography>
            </Box>
          ) : (
            data.map((s, i) => (
              <Box key={s.id}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1, gap: 1 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" sx={{ bgcolor: "primary.main", color: "white", borderRadius: 1, px: 0.75, py: 0.25, flexShrink: 0, fontWeight: 700 }}>
                      {i + 1}
                    </Typography>
                    <Typography variant="body2" noWrap>{s.descricao}</Typography>
                  </Box>
                  <Chip label={`${s.total_utilizado}x`} size="small" variant="outlined" />
                </Box>
                {i < data.length - 1 && <Divider />}
              </Box>
            ))
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
            Últimos 30 dias
          </Typography>
        </>
      )}
    </SectionCard>
  );
}

function SecaoAgenda() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const result = await window.api.getOSAgenda({ month: now.getMonth() + 1, year: now.getFullYear() });
      if (result.success) {
        const flat = Object.values(result.agenda ?? {})
          .flat()
          .sort((a, b) => new Date(a.data_prevista) - new Date(b.data_prevista));
        setData(flat);
      }
      setLoading(false);
    })();
  }, []);

  const items = data?.slice(0, 5) ?? [];
  const now = new Date();
  const mesAno = now.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <SectionCard icon={CalendarMonthIcon} title="OS Agendadas este Mês" loading={loading}
      emptyText="Nenhuma OS agendada para este mês.">
      {!loading && (
        <>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, textTransform: "capitalize" }}>
            {mesAno} · {data?.length ?? 0} OS agendada(s)
          </Typography>
          {!items.length ? (
            <Box sx={{ py: 3, textAlign: "center" }}>
              <Typography color="text.secondary" variant="body2">Nenhuma OS agendada.</Typography>
            </Box>
          ) : (
            items.map((os, i) => (
              <Box key={os.id}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1, gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} noWrap>OS #{os.id} — {os.nome_cliente}</Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>{os.equipamento}</Typography>
                  </Box>
                  <Chip label={formatDate(os.data_prevista)} size="small" variant="outlined" />
                </Box>
                {i < items.length - 1 && <Divider />}
              </Box>
            ))
          )}
        </>
      )}
    </SectionCard>
  );
}

function SecaoFinanceiro({ financeiro, loading }) {
  const lucro = financeiro?.lucro_mes ?? 0;
  const rows = [
    { label: "Receita OS", value: financeiro?.receita_os ?? 0 },
    { label: "Receitas Avulsas", value: financeiro?.receita_avulsa ?? 0 },
    { label: "Despesas", value: -(financeiro?.despesas_mes ?? 0), negative: true },
    { label: "Lucro Líquido", value: lucro, highlight: true },
  ];
  return (
    <SectionCard icon={AccountBalanceIcon} title="Resumo Financeiro do Mês" loading={loading}>
      {!loading && (
        <Box>
          {rows.map((row, i) => (
            <Box key={row.label}>
              <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", py: 1.25 }}>
                <Typography variant="body2" fontWeight={row.highlight ? 700 : 400}>{row.label}</Typography>
                <Typography
                  variant="body2"
                  fontWeight={row.highlight ? 700 : 400}
                  color={row.highlight ? (lucro >= 0 ? "success.main" : "error.main") : row.negative ? "error.main" : "text.primary"}
                >
                  {formatCurrency(Math.abs(row.value))}
                </Typography>
              </Box>
              {i < rows.length - 1 && <Divider />}
            </Box>
          ))}
        </Box>
      )}
    </SectionCard>
  );
}

// ---------- Componente principal ----------

export default function HomeScreen() {
  const { currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const [widgets, setWidgets] = useState(() => {
    try {
      const stored = localStorage.getItem("homeWidgets");
      return stored ? { ...DEFAULT_WIDGETS, ...JSON.parse(stored) } : DEFAULT_WIDGETS;
    } catch {
      return DEFAULT_WIDGETS;
    }
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await window.api.getDashboardStats();
      if (result.success) setData(result);
      setLoading(false);
    })();
  }, []);

  const toggleWidget = (key) => {
    setWidgets((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("homeWidgets", JSON.stringify(next));
      return next;
    });
  };

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  const lucro = data?.financeiro?.lucro_mes ?? 0;
  // O servidor só envia os valores financeiros para quem tem acesso ao Financeiro.
  const temFinanceiro = !!data?.financeiro;

  const kpiCards = [
    { key: "cardAbertas", gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)", icon: AssignmentIcon, label: "OS Abertas", value: data?.counts.abertas ?? 0 },
    { key: "cardAndamento", gradient: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)", icon: BuildIcon, label: "Em Andamento", value: data?.counts.em_andamento ?? 0 },
    { key: "cardFinalizadas", gradient: "linear-gradient(135deg, #059669 0%, #10b981 100%)", icon: CheckCircleIcon, label: "Finalizadas este Mês", value: data?.counts.finalizadas_mes ?? 0 },
    { key: "cardLucro", gradient: lucro >= 0 ? "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)" : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)", icon: AccountBalanceWalletIcon, label: "Lucro do Mês", value: lucro, isCurrency: true },
  ];

  const visibleCards = kpiCards.filter((c) => widgets[c.key] && (c.key !== "cardLucro" || temFinanceiro));

  const WIDGET_LABELS_TODOS = [
    { key: "cardAbertas", label: "Card: OS Abertas" },
    { key: "cardAndamento", label: "Card: Em Andamento" },
    { key: "cardFinalizadas", label: "Card: Finalizadas este Mês" },
    { key: "cardLucro", label: "Card: Lucro do Mês" },
    { key: "secaoGarantias", label: "Garantias Vencendo" },
    { key: "secaoUltimasOS", label: "Últimas OS Ativas" },
    { key: "secaoEstoque", label: "Estoque Crítico" },
    { key: "secaoServicos", label: "Serviços Mais Utilizados" },
    { key: "secaoAgenda", label: "OS Agendadas este Mês" },
    { key: "secaoFinanceiro", label: "Resumo Financeiro" },
  ];
  const WIDGET_LABELS = WIDGET_LABELS_TODOS.filter(
    (w) => temFinanceiro || (w.key !== "cardLucro" && w.key !== "secaoFinanceiro")
  );
  const totalCardsKpi = WIDGET_LABELS.filter((w) => w.key.startsWith("card")).length;

  return (
    <Box>
      {/* Cabeçalho */}
      <Box sx={{ mb: 3, display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>
            {getGreeting()}, {currentUser?.nome?.split(" ")[0] || "Usuário"}!
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>
            {dateLabel}
          </Typography>
        </Box>
        <Tooltip title="Personalizar dashboard">
          <IconButton size="small" onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ mt: 0.5, color: "text.secondary" }}>
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Popover de personalização */}
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Box sx={{ p: 2, minWidth: 250 }}>
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Exibir no dashboard</Typography>
          <Divider sx={{ mb: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>Cards de KPI</Typography>
          {WIDGET_LABELS.slice(0, totalCardsKpi).map((w) => (
            <FormControlLabel key={w.key} sx={{ display: "block" }}
              control={<Switch size="small" checked={widgets[w.key]} onChange={() => toggleWidget(w.key)} />}
              label={<Typography variant="body2">{w.label}</Typography>}
            />
          ))}
          <Divider sx={{ my: 1 }} />
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>Seções</Typography>
          {WIDGET_LABELS.slice(totalCardsKpi).map((w) => (
            <FormControlLabel key={w.key} sx={{ display: "block" }}
              control={<Switch size="small" checked={widgets[w.key]} onChange={() => toggleWidget(w.key)} />}
              label={<Typography variant="body2">{w.label}</Typography>}
            />
          ))}
        </Box>
      </Popover>

      {/* KPIs */}
      {visibleCards.length > 0 && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          {visibleCards.map((c) => (
            <Grid item xs={12} sm={6} lg={3} key={c.key}>
              <KpiCard gradient={c.gradient} icon={c.icon} label={c.label} value={c.value} loading={loading} isCurrency={c.isCurrency} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Grid de seções */}
      <Grid container spacing={3}>
        {/* Garantias Vencendo */}
        {widgets.secaoGarantias && (
          <Grid item xs={12} md={5}>
            <Paper sx={{ p: 2.5, height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <WarningAmberIcon color="warning" />
                <Typography variant="h6" fontWeight={600}>Garantias Vencendo</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>próximos 30 dias</Typography>
              </Box>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
              ) : !data?.garantias?.length ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <CheckCircleIcon sx={{ fontSize: 40, color: "success.main", mb: 1 }} />
                  <Typography color="text.secondary" variant="body2">Nenhuma garantia vencendo.</Typography>
                </Box>
              ) : (
                <Box>
                  {data.garantias.map((g, i) => (
                    <Box key={g.id}>
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", py: 1.25, gap: 1 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={600} noWrap>OS #{g.id} — {g.nome_cliente}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {g.equipamento} · vence {formatDate(g.data_garantia)}
                          </Typography>
                        </Box>
                        <WarrantyBadge days={Number(g.dias_restantes)} />
                      </Box>
                      {i < data.garantias.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Últimas OS Ativas */}
        {widgets.secaoUltimasOS && (
          <Grid item xs={12} md={widgets.secaoGarantias ? 7 : 12}>
            <Paper sx={{ p: 2.5, height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <AccessTimeIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>Últimas OS Ativas</Typography>
              </Box>
              {loading ? (
                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}><CircularProgress /></Box>
              ) : !data?.recentOS?.length ? (
                <Box sx={{ py: 4, textAlign: "center" }}>
                  <Typography color="text.secondary" variant="body2">Nenhuma OS em aberto.</Typography>
                </Box>
              ) : (
                <Box>
                  {data.recentOS.map((os, i) => (
                    <Box key={os.id}>
                      <Box sx={{ py: 1.25 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                          <Typography variant="body2" fontWeight={600}>OS #{os.id}</Typography>
                          <Chip label={os.status} color={STATUS_COLORS[os.status] ?? "default"} size="small" variant="outlined" />
                          <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                            {formatDate(os.data_entrada)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" noWrap>{os.nome_cliente}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap>
                          {os.equipamento}{os.defeito_relatado ? ` · ${os.defeito_relatado}` : ""}
                        </Typography>
                      </Box>
                      {i < data.recentOS.length - 1 && <Divider />}
                    </Box>
                  ))}
                </Box>
              )}
            </Paper>
          </Grid>
        )}

        {/* Estoque Crítico */}
        {widgets.secaoEstoque && (
          <Grid item xs={12} md={6}>
            <SecaoEstoqueCritico />
          </Grid>
        )}

        {/* Serviços Mais Utilizados */}
        {widgets.secaoServicos && (
          <Grid item xs={12} md={6}>
            <SecaoServicos />
          </Grid>
        )}

        {/* OS Agendadas */}
        {widgets.secaoAgenda && (
          <Grid item xs={12} md={6}>
            <SecaoAgenda />
          </Grid>
        )}

        {/* Resumo Financeiro */}
        {widgets.secaoFinanceiro && temFinanceiro && (
          <Grid item xs={12} md={6}>
            <SecaoFinanceiro financeiro={data?.financeiro} loading={loading} />
          </Grid>
        )}
      </Grid>
    </Box>
  );
}
