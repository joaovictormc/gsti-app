import React from "react";
import {
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  Box,
  CircularProgress,
  Alert,
} from "@mui/material";
import DateRangeIcon from "@mui/icons-material/DateRange";
import FileDownloadIcon from "@mui/icons-material/FileDownload";

function PeriodSelector({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  onSetPeriodThisMonth,
  onSetPeriodLastMonth,
  onSetPeriodThisYear,
  onExportExcel,
  isExporting,
  exportMessage,
  onClearExportMessage,
}) {
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} mb={2.5}>
        <DateRangeIcon color="primary" />
        <Typography variant="h6" fontWeight={600}>
          Período de Análise
        </Typography>
      </Stack>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center" mb={2}>
        <TextField
          label="Data Início"
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
          disabled={isExporting}
        />
        <Typography color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
          até
        </Typography>
        <TextField
          label="Data Fim"
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          InputLabelProps={{ shrink: true }}
          sx={{ minWidth: 180 }}
          disabled={isExporting}
        />
      </Stack>

      <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
        <Button size="small" variant="outlined" onClick={onSetPeriodThisMonth} disabled={isExporting}>
          Este Mês
        </Button>
        <Button size="small" variant="outlined" onClick={onSetPeriodLastMonth} disabled={isExporting}>
          Mês Passado
        </Button>
        <Button size="small" variant="outlined" onClick={onSetPeriodThisYear} disabled={isExporting}>
          Este Ano
        </Button>

        <Box sx={{ ml: "auto" }}>
          <Button
            size="small"
            variant="contained"
            color="success"
            onClick={onExportExcel}
            disabled={isExporting || !startDate || !endDate}
            startIcon={
              isExporting ? (
                <CircularProgress size={16} color="inherit" />
              ) : (
                <FileDownloadIcon />
              )
            }
          >
            {isExporting ? "Exportando..." : "Exportar Excel"}
          </Button>
        </Box>
      </Stack>

      {exportMessage?.text && (
        <Alert
          severity={exportMessage.type || "info"}
          sx={{ mt: 2 }}
          onClose={onClearExportMessage ? () => onClearExportMessage() : undefined}
        >
          {exportMessage.text}
        </Alert>
      )}
    </Paper>
  );
}

export default PeriodSelector;
