import { useEffect, useState } from "react";

// Barra de título própria (a janela não usa a moldura padrão do sistema).
// Mostra logo e nome da empresa e serve para arrastar a janela; os botões
// minimizar/maximizar/fechar são os nativos, desenhados pelo sistema por cima
// da área reservada à direita (no macOS, à esquerda).
// As telas usam var(--gsti-vh) como altura útil abaixo da barra.

export const ALTURA_BARRA = 36;

const CORES = {
  light: { fundo: "#ffffff", texto: "#1e293b", borda: "#e2e8f0" },
  dark: { fundo: "#0c1424", texto: "rgba(255,255,255,0.85)", borda: "rgba(255,255,255,0.08)" },
};

const lerTema = () => {
  try {
    return localStorage.getItem("themeMode") === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
};

export default function BarraTitulo() {
  const ativa = typeof window !== "undefined" && !!window.api?.definirTemaBarraTitulo;
  const [tema, setTema] = useState(lerTema);
  const [marca, setMarca] = useState({ nome: "GSTI App", logo: null });

  // Reserva o espaço da barra no layout
  useEffect(() => {
    document.documentElement.style.setProperty("--gsti-barra", ativa ? `${ALTURA_BARRA}px` : "0px");
  }, [ativa]);

  // Tema: acompanha o botão claro/escuro do app e ajusta os botões nativos
  useEffect(() => {
    if (!ativa) return undefined;
    const aoMudar = (e) => setTema(e.detail === "dark" ? "dark" : "light");
    window.addEventListener("gsti:tema", aoMudar);
    return () => window.removeEventListener("gsti:tema", aoMudar);
  }, [ativa]);

  useEffect(() => {
    if (ativa) window.api.definirTemaBarraTitulo(tema).catch(() => {});
  }, [ativa, tema]);

  // Marca: nome e logo salvos em Configurações
  useEffect(() => {
    if (!ativa) return undefined;
    let montado = true;
    const carregar = async () => {
      try {
        const r = await window.api.getAppSettings();
        const branding = r?.settings?.branding || {};
        let logo = null;
        if (branding.logoPath) {
          const img = await window.api.loadLogoImage(branding.logoPath);
          if (img?.success) logo = img.imageData;
        }
        if (montado) setMarca({ nome: branding.companyName?.trim() || "GSTI App", logo });
      } catch {
        /* mantém a marca padrão */
      }
    };
    carregar();
    window.addEventListener("gsti:configuracoes-salvas", carregar);
    return () => {
      montado = false;
      window.removeEventListener("gsti:configuracoes-salvas", carregar);
    };
  }, [ativa]);

  if (!ativa) return null;

  const cores = CORES[tema];
  const mac = window.api.plataforma === "darwin";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: ALTURA_BARRA,
        zIndex: 2000, // acima de diálogos, para a janela continuar arrastável
        display: "flex",
        alignItems: "center",
        gap: 8,
        // área dos botões nativos: direita no Windows/Linux, esquerda no macOS
        paddingLeft: mac ? 80 : 12,
        paddingRight: mac ? 12 : 150,
        background: cores.fundo,
        color: cores.texto,
        borderBottom: `1px solid ${cores.borda}`,
        boxSizing: "border-box",
        WebkitAppRegion: "drag",
        userSelect: "none",
        fontFamily: '"Inter", "Roboto", sans-serif',
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {marca.logo ? (
        <img src={marca.logo} alt="" style={{ height: 20, maxWidth: 48, objectFit: "contain" }} />
      ) : (
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 5,
            background: "#6366f1",
            color: "#fff",
            fontSize: 12,
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {marca.nome[0].toUpperCase()}
        </span>
      )}
      <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{marca.nome}</span>
    </div>
  );
}
