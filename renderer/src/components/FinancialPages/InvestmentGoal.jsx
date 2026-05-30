import React from "react";
import {
  Paper,
  Typography,
  Stack,
  TextField,
  Box,
  InputAdornment,
  Chip,
} from "@mui/material";
import SavingsIcon from "@mui/icons-material/Savings";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

const formatMonthsToYears = (totalMonths) => {
  if (!totalMonths || totalMonths <= 0) return null;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  const parts = [];
  if (years > 0) parts.push(`${years} ano${years > 1 ? "s" : ""}`);
  if (months > 0) parts.push(`${months} ${months > 1 ? "meses" : "mês"}`);
  return parts.join(" e ") || `${totalMonths} mês`;
};

function InvestmentGoal({ investmentGoal, onInvestmentGoalChange, timeToGoal, averageProfit }) {
  const formatted = formatMonthsToYears(timeToGoal);

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
        <SavingsIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Meta de Investimento
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={3} alignItems="center">
        <TextField
          label="Valor da Meta"
          type="number"
          value={investmentGoal}
          onChange={(e) => onInvestmentGoalChange(e.target.value)}
          InputProps={{
            startAdornment: <InputAdornment position="start">R$</InputAdornment>,
            inputProps: { min: 0, step: "0.01" },
          }}
          sx={{ minWidth: 220 }}
        />

        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" mb={0.75}>
            Tempo estimado com base no lucro médio mensal:
          </Typography>

          {formatted ? (
            <Chip
              icon={<CheckCircleOutlineIcon />}
              label={formatted}
              color="success"
              variant="outlined"
              sx={{ fontSize: "1rem", height: 36, px: 1 }}
            />
          ) : (
            <Typography variant="body1" color="text.disabled">
              {averageProfit <= 0
                ? "Lucro médio zero ou negativo"
                : "Insira um valor de meta"}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default InvestmentGoal;
