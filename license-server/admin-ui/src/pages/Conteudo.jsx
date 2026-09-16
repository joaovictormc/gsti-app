import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Box, Button, Chip, Drawer, IconButton, List, ListItemButton, ListItemText, ListSubheader, Paper, Stack,
  Tooltip, Typography, useMediaQuery,
} from "@mui/material";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import VisibilityIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOffOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import { get } from "../api";
import { dataHora } from "../format";
import { Cabecalho, Carregando, Erro, useAviso, useCarregar } from "../components/comum";
import EditorSecao from "./conteudo/EditorSecao";
import PreviaSite from "./conteudo/PreviaSite";

const GRUPOS = [
  ["site", "Página inicial"],
  ["paginas", "Outras páginas"],
  ["emails", "E-mails automáticos"],
];

export default function Conteudo() {
  const { chave } = useParams();
  const navegar = useNavigate();
  const [aviso, avisar] = useAviso();
  const [valores, setValores] = useState(null);
  const [listaAberta, setListaAberta] = useState(false);
  const [mostrarPrevia, setMostrarPrevia] = useState(true);
  const telaGrande = useMediaQuery("(min-width:1600px)");
  const telaMedia = useMediaQuery("(min-width:900px)");
  const { dados, erro, carregando, recarregar } = useCarregar(() => get("/conteudo"), []);

  const selecionada = chave || dados?.itens?.[0]?.chave;
  useEffect(() => {
    if (!chave && dados?.itens?.length) navegar(`/conteudo/${dados.itens[0].chave}`, { replace: true });
  }, [chave, dados, navegar]);

  // Ao trocar de seção, zera os valores da prévia até o editor carregar.
  useEffect(() => { setValores(null); }, [selecionada]);
  const receberValores = useCallback((v) => setValores(v), []);

  if (carregando) return <Carregando />;
  if (erro) return <Erro erro={erro} onTentar={recarregar} />;

  const lista = (
    <Box sx={{ width: 260, flex: "none" }}>
      {GRUPOS.map(([grupo, titulo]) => {
        const itens = dados.itens.filter((i) => i.grupo === grupo);
        if (!itens.length) return null;
        return (
          <List
            key={grupo}
            dense
            subheader={<ListSubheader disableSticky sx={{ bgcolor: "transparent", fontSize: 11, letterSpacing: ".08em", textTransform: "uppercase" }}>{titulo}</ListSubheader>}
          >
            {itens.map((i) => (
              <ListItemButton
                key={i.chave}
                selected={i.chave === selecionada}
                onClick={() => { navegar(`/conteudo/${i.chave}`); setListaAberta(false); }}
                sx={{ borderRadius: 2, mx: 1, "&.Mui-selected": { bgcolor: "rgba(255,106,43,.12)" } }}
              >
                <ListItemText
                  primary={i.titulo}
                  secondary={i.atualizadoEm ? `Editado em ${dataHora(i.atualizadoEm)}` : "Texto padrão"}
                  slotProps={{ primary: { fontWeight: i.chave === selecionada ? 700 : 500, fontSize: 14 }, secondary: { fontSize: 11 } }}
                />
              </ListItemButton>
            ))}
          </List>
        );
      })}
    </Box>
  );

  return (
    <>
      <Cabecalho
        titulo="Textos e e-mails"
        subtitulo="Edite qualquer texto do site e veja o resultado na prévia antes de publicar."
        acoes={
          <>
            {!telaMedia && <Button size="small" startIcon={<MenuOpenIcon />} onClick={() => setListaAberta(true)}>Seções</Button>}
            {telaGrande && (
              <Tooltip title={mostrarPrevia ? "Ocultar prévia" : "Mostrar prévia"}>
                <IconButton onClick={() => setMostrarPrevia((v) => !v)}>{mostrarPrevia ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton>
              </Tooltip>
            )}
            <Button variant="outlined" href="/" target="_blank" endIcon={<OpenInNewIcon />}>Ver o site</Button>
          </>
        }
      />

      <Stack direction="row" spacing={3} alignItems="flex-start">
        {telaMedia && (
          <Paper sx={{ py: 1, position: "sticky", top: 88, maxHeight: "calc(100vh - 120px)", overflowY: "auto", flex: "none" }}>
            {lista}
          </Paper>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          {selecionada && (
            <EditorSecao
              key={selecionada}
              chave={selecionada}
              onValores={receberValores}
              onPublicado={recarregar}
              avisar={avisar}
            />
          )}
        </Box>
        {telaGrande && mostrarPrevia && selecionada && (
          <Box sx={{ width: 560, flex: "none" }}>
            <PreviaSite chave={selecionada} valores={valores} />
          </Box>
        )}
      </Stack>

      {!telaGrande && selecionada && (
        <Box sx={{ mt: 4 }}>
          <Chip label="Prévia" size="small" sx={{ mb: 1 }} />
          <PreviaSite chave={selecionada} valores={valores} alturaMin={420} />
        </Box>
      )}

      <Drawer open={listaAberta} onClose={() => setListaAberta(false)}>
        <Typography variant="overline" sx={{ p: 2, pb: 0 }}>Seções</Typography>
        {lista}
      </Drawer>
      {aviso}
    </>
  );
}
