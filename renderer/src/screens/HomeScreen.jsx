import { useState, useEffect } from "react";
import {
  Box,
  Grid,
  Typography,
  Paper,
  Chip,
  CircularProgress,
  Divider,
} from "@mui/material";
import AssignmentIcon from "@mui/icons-material/Assignment";
import BuildIcon from "@mui/icons-material/Build";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
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
  return new Date(v).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
};

function KpiCard({ gradient, icon: Icon, label, value, loading, isCurrency = false }) {
  return (
    <Box
      sx={{
        background: gradient,
        borderRadius: 3,
        p: 2.5,
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: 2,
        height: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        "&:hover": { transform: "translateY(-2px)", boxShadow: "0 8px 28px rgba(0,0,0,0.22)" },
      }}
    >
      <Box
        sx={{
          bgcolor: "rgba(255,255,255,0.18)",
          borderRadius: 2.5,
          p: 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 30, color: "white" }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ opacity: 0.82, display: "block", mb: 0.5 }}>
          {label}
        </Typography>
        {loading ? (
          <CircularProgress size={22} sx={{ color: "rgba(255,255,255,0.8)" }} />
        ) : (
          <Typography variant="h5" fontWeight={700}>
            {isCurrency ? formatCurrency(value) : value}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function WarrantyBadge({ days }) {
  if (days <= 7) return <Chip label={`${days}d`} color="error" size="small" />;
  if (days <= 15) return <Chip label={`${days}d`} color="warning" size="small" />;
  return <Chip label={`${days}d`} color="success" size="small" variant="outlined" />;
}

export default function HomeScreen() {
  const { currentUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const result = await window.api.getDashboardStats();
      if (result.success) setData(result);
      setLoading(false);
    })();
  }, []);

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lucro = data?.financeiro.lucro_mes ?? 0;

  return (
    <Box>
      {/* Saudação */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>
          {getGreeting()}, {currentUser?.nome?.split(" ")[0] || "Usuário"}!
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ textTransform: "capitalize" }}>
          {dateLabel}
        </Typography>
      </Box>

      {/* KPIs */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            icon={AssignmentIcon}
            label="OS Abertas"
            value={data?.counts.abertas ?? 0}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            gradient="linear-gradient(135deg, #d97706 0%, #f59e0b 100%)"
            icon={BuildIcon}
            label="Em Andamento"
            value={data?.counts.em_andamento ?? 0}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            gradient="linear-gradient(135deg, #059669 0%, #10b981 100%)"
            icon={CheckCircleIcon}
            label="Finalizadas este Mês"
            value={data?.counts.finalizadas_mes ?? 0}
            loading={loading}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            gradient={
              lucro >= 0
                ? "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)"
                : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)"
            }
            icon={AccountBalanceWalletIcon}
            label="Lucro do Mês"
            value={lucro}
            loading={loading}
            isCurrency
          />
        </Grid>
      </Grid>

      {/* Garantias + Últimas OS */}
      <Grid container spacing={3}>
        {/* Alertas de garantia */}
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2.5, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <WarningAmberIcon color="warning" />
              <Typography variant="h6" fontWeight={600}>
                Garantias Vencendo
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                próximos 30 dias
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !data?.garantias?.length ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <CheckCircleIcon sx={{ fontSize: 40, color: "success.main", mb: 1 }} />
                <Typography color="text.secondary" variant="body2">
                  Nenhuma garantia vencendo.
                </Typography>
              </Box>
            ) : (
              <Box>
                {data.garantias.map((g, i) => (
                  <Box key={g.id}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        py: 1.25,
                        gap: 1,
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={600} noWrap>
                          OS #{g.id} — {g.nome_cliente}
                        </Typography>
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

        {/* Últimas OS ativas */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2.5, height: "100%" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <AccessTimeIcon color="primary" />
              <Typography variant="h6" fontWeight={600}>
                Últimas OS Ativas
              </Typography>
            </Box>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress />
              </Box>
            ) : !data?.recentOS?.length ? (
              <Box sx={{ py: 4, textAlign: "center" }}>
                <Typography color="text.secondary" variant="body2">
                  Nenhuma OS em aberto.
                </Typography>
              </Box>
            ) : (
              <Box>
                {data.recentOS.map((os, i) => (
                  <Box key={os.id}>
                    <Box sx={{ py: 1.25 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" fontWeight={600}>
                          OS #{os.id}
                        </Typography>
                        <Chip
                          label={os.status}
                          color={STATUS_COLORS[os.status] ?? "default"}
                          size="small"
                          variant="outlined"
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>
                          {formatDate(os.data_entrada)}
                        </Typography>
                      </Box>
                      <Typography variant="body2" noWrap>
                        {os.nome_cliente}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {os.equipamento}
                        {os.defeito_relatado ? ` · ${os.defeito_relatado}` : ""}
                      </Typography>
                    </Box>
                    {i < data.recentOS.length - 1 && <Divider />}
                  </Box>
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
