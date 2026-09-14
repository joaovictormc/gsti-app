import { Link as RouterLink } from "react-router-dom";
import { Box, Button, List, ListItemButton, ListItemText, Paper, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { get } from "../api";
import { dataHora } from "../format";
import { Cabecalho, Carregando, Erro, useCarregar } from "../components/comum";

const GRUPOS = [
  ["site", "Página inicial", "Seções da landing page, na ordem em que aparecem."],
  ["paginas", "Páginas legais", "Termos de uso e política de privacidade."],
  ["emails", "E-mails automáticos", "Mensagens enviadas aos clientes em cada etapa."],
];

export default function Conteudo() {
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/conteudo"), []);

  return (
    <>
      <Cabecalho
        titulo="Textos e e-mails"
        subtitulo="Alterações são publicadas assim que salvas e ficam no histórico."
        acoes={<Button variant="outlined" href="/" target="_blank" endIcon={<OpenInNewIcon />}>Ver o site</Button>}
      />
      <Erro erro={erro} onTentar={recarregar} />
      {carregando ? <Carregando /> : dados && GRUPOS.map(([grupo, titulo, desc]) => {
        const itens = dados.itens.filter((i) => i.grupo === grupo);
        if (!itens.length) return null;
        return (
          <Box key={grupo} sx={{ mb: 3 }}>
            <Typography variant="h6">{titulo}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{desc}</Typography>
            <Paper>
              <List disablePadding>
                {itens.map((i, idx) => (
                  <ListItemButton key={i.chave} component={RouterLink} to={`/conteudo/${i.chave}`} divider={idx < itens.length - 1} sx={{ py: 1.5 }}>
                    <ListItemText
                      primary={i.titulo}
                      secondary={i.atualizadoEm ? `Editado por ${i.atualizadoPor} em ${dataHora(i.atualizadoEm)}` : "Texto padrão (nunca editado)"}
                      slotProps={{ primary: { fontWeight: 600 } }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </Box>
        );
      })}
    </>
  );
}
