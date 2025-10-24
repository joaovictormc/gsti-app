import React from "react";
import {
  Paper,
  Typography,
  Stack,
  TextField,
  Box,
  InputAdornment,
} from "@mui/material";

// Função auxiliar para formatar meses (pode vir de utils)
const formatMonthsToYears = (totalMonths) => {
  if (totalMonths === null || totalMonths === undefined || totalMonths <= 0)
    return "-";
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  let result = "";
  if (years > 0) result += `${years} ano${years > 1 ? "s" : ""}`;
  if (months > 0)
    result += `${years > 0 ? " e " : ""}${months} mes${months > 1 ? "es" : ""}`;
  // Se for exatamente 0 meses (mas timeToGoal não era null), mostra 0 meses.
  // Se for menos de 1 ano e não 0, mostra só meses.
  return result || `${totalMonths} mes${totalMonths !== 1 ? "es" : ""}`;
};

// Define as props que o componente receberá
function InvestmentGoal({
  investmentGoal, // Valor atual da meta (string)
  onInvestmentGoalChange, // Função para atualizar a meta no pai
  timeToGoal, // Resultado do cálculo (número de meses ou null)
  averageProfit, // Lucro médio (para exibir mensagem de erro)
}) {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Meta de Investimento
      </Typography>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
      >
        <TextField
          label="Valor da Meta"
          type="number"
          value={investmentGoal}
          // Chama a função passada via prop para atualizar o estado no pai
          onChange={(e) => onInvestmentGoalChange(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">R$</InputAdornment>
            ),
            inputProps: { min: 0, step: "0.01" },
          }}
          sx={{ minWidth: 200 }}
        />
        <Box
          sx={{
            flexGrow: 1,
            textAlign: { xs: "center", sm: "left" },
            mt: { xs: 2, sm: 0 },
          }}
        >
          <Typography variant="body1">
            Tempo estimado para atingir a meta (com base no lucro médio):
          </Typography>
          <Typography
            variant="h6"
            color={timeToGoal ? "primary" : "textSecondary"}
          >
            {/* Lógica de exibição movida para cá */}
            {timeToGoal !== null
              ? formatMonthsToYears(timeToGoal)
              : averageProfit <= 0
              ? "Lucro médio zero ou negativo"
              : "Insira uma meta válida"}
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export default InvestmentGoal;
