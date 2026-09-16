import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, IconButton, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import ComputerIcon from "@mui/icons-material/DesktopWindowsOutlined";
import PhoneIcon from "@mui/icons-material/PhoneIphone";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../../api";

// Qual página do site mostrar para cada seção editada.
export function paginaDaChave(chave) {
  if (chave.startsWith("email.")) return { pagina: "email", rotulo: "Prévia do e-mail" };
  const mapa = {
    "pagina.teste_gratis": ["teste-gratis", "Página de teste grátis", "/teste-gratis"],
    "pagina.termos": ["termos", "Termos de uso", "/termos"],
    "pagina.privacidade": ["privacidade", "Política de privacidade", "/privacidade"],
    "pagina.cliente": ["cliente", "Área do cliente", "/cliente"],
    "pagina.checkout": ["checkout", "Retorno do pagamento", null],
  };
  const m = mapa[chave];
  if (m) return { pagina: m[0], rotulo: m[1], link: m[2] };
  return { pagina: "inicio", rotulo: "Página inicial", link: "/" };
}

export default function PreviaSite({ chave, valores, alturaMin = 520 }) {
  const { pagina, rotulo, link } = paginaDaChave(chave);
  const [html, setHtml] = useState("");
  const [largura, setLargura] = useState("desktop");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const quadro = useRef(null);

  const atualizar = useCallback(async () => {
    setCarregando(true);
    setErro("");
    try {
      const resp = await api("POST", "/site/previa", { pagina, chave, alteracoes: { [chave]: valores } }, { texto: true });
      setHtml(resp);
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }, [pagina, chave, valores]);

  // Atualiza sozinha enquanto a pessoa digita (com respiro de 800 ms).
  useEffect(() => {
    if (!valores) return;
    const t = setTimeout(atualizar, 800);
    return () => clearTimeout(t);
  }, [atualizar, valores]);

  return (
    <Box sx={{ position: "sticky", top: 88 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="overline" color="text.secondary">
          {rotulo}{carregando ? " · atualizando…" : ""}
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="center">
          <ToggleButtonGroup size="small" exclusive value={largura} onChange={(_e, v) => v && setLargura(v)}>
            <ToggleButton value="desktop" aria-label="Computador"><ComputerIcon fontSize="small" /></ToggleButton>
            <ToggleButton value="mobile" aria-label="Celular"><PhoneIcon fontSize="small" /></ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Atualizar prévia"><IconButton size="small" onClick={atualizar}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
          {link && (
            <Tooltip title="Abrir a página publicada">
              <IconButton size="small" component="a" href={link} target="_blank"><OpenInNewIcon fontSize="small" /></IconButton>
            </Tooltip>
          )}
        </Stack>
      </Stack>
      <Box
        sx={{
          border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden", bgcolor: "#fff",
          display: "flex", justifyContent: "center", height: `max(${alturaMin}px, calc(100vh - 190px))`,
        }}
      >
        {erro ? (
          <Stack spacing={1} sx={{ p: 3, alignSelf: "center", textAlign: "center" }}>
            <Typography color="error">{erro}</Typography>
            <Button onClick={atualizar}>Tentar de novo</Button>
          </Stack>
        ) : (
          <iframe
            ref={quadro}
            title="Prévia do site"
            srcDoc={html}
            sandbox="allow-same-origin"
            style={{ width: largura === "mobile" ? 420 : "100%", height: "100%", border: 0, transition: "width .2s" }}
          />
        )}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
        Prévia com as alterações ainda não publicadas. Links e botões ficam desativados aqui.
      </Typography>
    </Box>
  );
}
