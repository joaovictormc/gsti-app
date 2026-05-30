import React from "react";
import {
  Grid,
  Box,
  Typography,
  CircularProgress,
  Tooltip as MuiTooltip,
} from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TimelineIcon from "@mui/icons-material/Timeline";
import LockIcon from "@mui/icons-material/Lock";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

const formatCurrency = (value) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value || 0);

function StatCard({ gradient, icon: Icon, label, value, loading }) {
  return (
    <Box
      sx={{
        background: gradient,
        borderRadius: 3,
        p: 2,
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        height: "100%",
        boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
        transition: "transform 0.15s ease, box-shadow 0.15s ease",
        "&:hover": {
          transform: "translateY(-2px)",
          boxShadow: "0 8px 28px rgba(0,0,0,0.26)",
        },
      }}
    >
      <Box
        sx={{
          bgcolor: "rgba(255,255,255,0.18)",
          borderRadius: 2,
          p: 1.25,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 26, color: "white" }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ opacity: 0.82, display: "block", mb: 0.25, fontSize: "0.7rem", lineHeight: 1.2 }}
        >
          {label}
        </Typography>
        {loading ? (
          <CircularProgress size={18} sx={{ color: "rgba(255,255,255,0.8)" }} />
        ) : (
          <Typography variant="body1" fontWeight={700} noWrap sx={{ fontSize: { md: "0.95rem", lg: "1rem" } }}>
            {formatCurrency(value)}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function SummaryCards({
  summary,
  loadingSummary,
  averageProfit,
  loadingAverageProfit,
  averageProfitMonths,
}) {
  const profitGradient =
    (summary.netProfit || 0) >= 0
      ? "linear-gradient(135deg, #059669 0%, #10b981 100%)"
      : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)";

  const cards = [
    {
      gradient: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
      icon: TrendingUpIcon,
      label: "Receita Total",
      value: summary.totalRevenue,
      loading: loadingSummary,
    },
    {
      gradient: "linear-gradient(135deg, #ef4444 0%, #f97316 100%)",
      icon: TrendingDownIcon,
      label: "Despesa Total",
      value: summary.totalExpenses,
      loading: loadingSummary,
    },
    {
      gradient: profitGradient,
      icon: AccountBalanceWalletIcon,
      label: "Lucro Líquido",
      value: summary.netProfit,
      loading: loadingSummary,
    },
    {
      gradient: "linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)",
      icon: TimelineIcon,
      label: "Lucro Médio Mensal",
      value: averageProfit,
      loading: loadingAverageProfit,
      tooltip: `Média dos últimos ${averageProfitMonths} meses com movimentação.`,
    },
    {
      gradient: "linear-gradient(135deg, #b45309 0%, #d97706 100%)",
      icon: LockIcon,
      label: "Despesas Fixas",
      value: summary.totalFixedExpenses,
      loading: loadingSummary,
    },
    {
      gradient: "linear-gradient(135deg, #be123c 0%, #e11d48 100%)",
      icon: ReceiptLongIcon,
      label: "Despesas Variáveis",
      value: summary.totalVariableExpenses,
      loading: loadingSummary,
    },
  ];

  return (
    <Grid container spacing={2} sx={{ mb: 4 }}>
      {cards.map((card) => (
        <Grid item xs={12} sm={6} md={4} lg={2} key={card.label}>
          {card.tooltip ? (
            <MuiTooltip title={card.tooltip}>
              <span style={{ display: "block", height: "100%" }}>
                <StatCard {...card} />
              </span>
            </MuiTooltip>
          ) : (
            <StatCard {...card} />
          )}
        </Grid>
      ))}
    </Grid>
  );
}

export default SummaryCards;
