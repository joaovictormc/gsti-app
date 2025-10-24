import React from "react"; // Import React if not already implicitly available
import {
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";

// Define as props que o componente receberá
function PeriodSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSetPeriodThisMonth,
  onSetPeriodLastMonth,
  onSetPeriodThisYear,
  onExportExcel,
  isExporting, // Renomeado de 'exporting' para evitar conflito
  exportMessage,
  onClearExportMessage, // Função para limpar a mensagem
}) {
  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Selecionar Período e Exportar
      </Typography>
      {/* Seletores de Data */}
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        alignItems="center"
        mb={2}
      >
        <TextField
          label="Data Início"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)} // Chama a função passada via prop
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
          disabled={isExporting} // Desabilita durante exportação
        />
        <TextField
          label="Data Fim"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)} // Chama a função passada via prop
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
          disabled={isExporting} // Desabilita durante exportação
        />
      </Stack>
      {/* Botões de Período Rápido e Exportação */}
      <Stack
        direction="row"
        spacing={1}
        justifyContent="flex-start"
        flexWrap="wrap"
        alignItems="center"
      >
        <Button
          size="small"
          variant="outlined"
          onClick={onSetPeriodThisMonth}
          disabled={isExporting}
        >
          Este Mês
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onSetPeriodLastMonth}
          disabled={isExporting}
        >
          Mês Passado
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={onSetPeriodThisYear}
          disabled={isExporting}
        >
          Este Ano
        </Button>
        <Button
          size="small"
          variant="contained"
          color="success"
          onClick={onExportExcel} // Chama a função passada via prop
          disabled={isExporting || !startDate || !endDate}
          sx={{ ml: "auto" }} // Joga para a direita
        >
          {isExporting ? (
            <CircularProgress size={18} color="inherit" />
          ) : (
            "Exportar Excel"
          )}
        </Button>
      </Stack>
      {/* Feedback da Exportação */}
      {exportMessage && exportMessage.text && (
        <Alert
          severity={exportMessage.type || "info"}
          sx={{ mt: 2 }}
          // Chama a função para limpar a mensagem ao fechar (se onClearExportMessage for fornecida)
          onClose={
            onClearExportMessage ? () => onClearExportMessage() : undefined
          }
        >
          {exportMessage.text}
        </Alert>
      )}
    </Paper>
  );
}

export default PeriodSelector;
