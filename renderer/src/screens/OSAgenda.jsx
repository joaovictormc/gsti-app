import { useState, useEffect, useMemo } from "react";
import {
  Box, Typography, IconButton, Paper, Chip, Tooltip,
  CircularProgress, Divider,
} from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import TodayIcon from "@mui/icons-material/Today";

const WEEK_DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const STATUS_COLORS = {
  "Orçamento": "default",
  "Em Aberto": "warning",
  "Aguardando Autorização": "secondary",
  "Aguardando Peça": "warning",
  "Em Andamento": "primary",
  "Finalizado": "success",
};

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6

  const weeks = [];
  let week = new Array(startDow).fill(null);

  for (let day = 1; day <= daysInMonth; day++) {
    week.push(day);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}

export default function OSAgenda() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [year, setYear] = useState(today.getFullYear());
  const [osData, setOsData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState(null);

  useEffect(() => {
    setSelectedDay(null);
    (async () => {
      setLoading(true);
      const result = await window.api.getOSAgenda({ month, year });
      if (result.success) setOsData(result.data);
      else setOsData([]);
      setLoading(false);
    })();
  }, [month, year]);

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const goToday = () => { setMonth(today.getMonth() + 1); setYear(today.getFullYear()); };

  // Map day → OS list
  const osByDay = useMemo(() => {
    const map = {};
    osData.forEach((os) => {
      const d = new Date(os.data_prevista);
      const key = d.getDate();
      if (!map[key]) map[key] = [];
      map[key].push(os);
    });
    return map;
  }, [osData]);

  const selectedOS = selectedDay ? (osByDay[selectedDay] || []) : [];
  const weeks = buildCalendarGrid(year, month);
  const isCurrentMonth = month === today.getMonth() + 1 && year === today.getFullYear();

  const formatTime = (v) =>
    new Date(v).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>Agenda de OS</Typography>
        <Typography variant="body2" color="text.secondary">
          OS com data prevista de entrega. Configure a data no formulário da OS.
        </Typography>
      </Box>

      {/* Navegação do mês */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <IconButton onClick={prevMonth} size="small"><ChevronLeftIcon /></IconButton>
          <Typography variant="h6" fontWeight={600} sx={{ flex: 1, textAlign: "center" }}>
            {MONTH_NAMES[month - 1]} {year}
          </Typography>
          <IconButton onClick={nextMonth} size="small"><ChevronRightIcon /></IconButton>
          {!isCurrentMonth && (
            <Tooltip title="Ir para hoje">
              <IconButton onClick={goToday} size="small" color="primary">
                <TodayIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {loading && <CircularProgress size={20} />}
        </Box>
      </Paper>

      {/* Grade do calendário */}
      <Paper sx={{ mb: 2, overflow: "hidden" }}>
        {/* Cabeçalho dos dias da semana */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", bgcolor: "primary.main" }}>
          {WEEK_DAYS.map((d) => (
            <Box key={d} sx={{ py: 1, textAlign: "center" }}>
              <Typography variant="caption" sx={{ color: "white", fontWeight: 600 }}>{d}</Typography>
            </Box>
          ))}
        </Box>

        {/* Semanas */}
        {weeks.map((week, wi) => (
          <Box key={wi} sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {week.map((day, di) => {
              const isToday = isCurrentMonth && day === today.getDate();
              const count = day ? (osByDay[day]?.length || 0) : 0;
              const isSelected = day === selectedDay;

              return (
                <Box
                  key={di}
                  onClick={() => day && setSelectedDay(isSelected ? null : day)}
                  sx={{
                    minHeight: 80,
                    p: 0.75,
                    borderTop: wi > 0 ? "1px solid" : "none",
                    borderLeft: di > 0 ? "1px solid" : "none",
                    borderColor: "divider",
                    cursor: day ? "pointer" : "default",
                    bgcolor: isSelected
                      ? "primary.main"
                      : day ? "background.paper" : "action.hover",
                    transition: "background-color 0.15s",
                    "&:hover": day ? { bgcolor: isSelected ? "primary.dark" : "action.hover" } : {},
                  }}
                >
                  {day && (
                    <>
                      <Box
                        sx={{
                          width: 26, height: 26, borderRadius: "50%",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          bgcolor: isToday ? "secondary.main" : "transparent",
                          mb: 0.5,
                        }}
                      >
                        <Typography
                          variant="caption"
                          fontWeight={isToday ? 700 : 400}
                          sx={{ color: isSelected ? "white" : isToday ? "white" : "text.primary" }}
                        >
                          {day}
                        </Typography>
                      </Box>
                      {count > 0 && (
                        <Chip
                          label={`${count} OS`}
                          size="small"
                          color={isSelected ? "default" : "primary"}
                          sx={{ fontSize: "0.65rem", height: 18 }}
                        />
                      )}
                    </>
                  )}
                </Box>
              );
            })}
          </Box>
        ))}
      </Paper>

      {/* Painel do dia selecionado */}
      {selectedDay && (
        <Paper sx={{ p: 2.5 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>
            {selectedDay} de {MONTH_NAMES[month - 1]} — {selectedOS.length} OS prevista{selectedOS.length !== 1 ? "s" : ""}
          </Typography>
          <Divider sx={{ mb: 2 }} />
          {selectedOS.length === 0 ? (
            <Typography color="text.secondary" variant="body2">Nenhuma OS prevista para este dia.</Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {selectedOS.map((os) => (
                <Box
                  key={os.id}
                  sx={{ display: "flex", alignItems: "flex-start", gap: 2, p: 1.5,
                    borderRadius: 2, bgcolor: "action.hover" }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="body2" fontWeight={700}>OS #{os.id}</Typography>
                      <Chip label={os.status} color={STATUS_COLORS[os.status] || "default"} size="small" variant="outlined" />
                    </Box>
                    <Typography variant="body2">{os.nome_cliente}</Typography>
                    <Typography variant="caption" color="text.secondary">{os.equipamento}</Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                    {formatTime(os.data_prevista)}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      )}

      {!selectedDay && osData.length === 0 && !loading && (
        <Paper sx={{ p: 3, textAlign: "center" }}>
          <Typography color="text.secondary">
            Nenhuma OS com data prevista em {MONTH_NAMES[month - 1]} {year}.
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Adicione uma "Data Prevista de Entrega" ao criar ou editar uma OS.
          </Typography>
        </Paper>
      )}
    </Box>
  );
}
