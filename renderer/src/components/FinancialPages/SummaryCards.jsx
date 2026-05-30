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

function StatCard({ gradient, icon: Icon, label, value, loading, size = "normal" }) {
  const isSmall = size === "small";
  return (
    <Box
      sx={{
        background: gradient,
        borderRadius: 3,
        p: isSmall ? 2 : 2.5,
        color: "white",
        display: "flex",
        alignItems: "center",
        gap: 2,
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
          borderRadius: 2.5,
          p: isSmall ? 1.25 : 1.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: isSmall ? 24 : 30, color: "white" }} />
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="caption"
          sx={{ opacity: 0.82, display: "block", mb: 0.25, fontSize: isSmall ? "0.7rem" : "0.75rem" }}
        >
          {label}
        </Typography>
        {loading ? (
          <CircularProgress size={isSmall ? 18 : 22} sx={{ color: "rgba(255,255,255,0.8)" }} />
        ) : (
          <Typography variant={isSmall ? "body1" : "h6"} fontWeight={700} noWrap>
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

  return (
    <>
      {/* Linha principal — 4 cards */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            gradient="linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)"
            icon={TrendingUpIcon}
            label="Receita Total"
            value={summary.totalRevenue}
            loading={loadingSummary}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            gradient="linear-gradient(135deg, #ef4444 0%, #f97316 100%)"
            icon={TrendingDownIcon}
            label="Despesa Total"
            value={summary.totalExpenses}
            loading={loadingSummary}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            gradient={profitGradient}
            icon={AccountBalanceWalletIcon}
            label="Lucro Líquido"
            value={summary.netProfit}
            loading={loadingSummary}
          />
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <MuiTooltip title={`Média dos últimos ${averageProfitMonths} meses com movimentação.`}>
            <span style={{ display: "block", height: "100%" }}>
              <StatCard
                gradient="linear-gradient(135deg, #0891b2 0%, #06b6d4 100%)"
                icon={TimelineIcon}
                label="Lucro Médio Mensal"
                value={averageProfit}
                loading={loadingAverageProfit}
              />
            </span>
          </MuiTooltip>
        </Grid>
      </Grid>

      {/* Linha secundária — despesas */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            gradient="linear-gradient(135deg, #b45309 0%, #d97706 100%)"
            icon={LockIcon}
            label="Despesas Fixas (Período)"
            value={summary.totalFixedExpenses}
            loading={loadingSummary}
            size="small"
          />
        </Grid>

        <Grid item xs={12} sm={6} md={9}>
          <StatCard
            gradient="linear-gradient(135deg, #be123c 0%, #e11d48 100%)"
            icon={ReceiptLongIcon}
            label="Despesas Variáveis (Período)"
            value={summary.totalVariableExpenses}
            loading={loadingSummary}
            size="small"
          />
        </Grid>
      </Grid>
    </>
  );
}

export default SummaryCards;
