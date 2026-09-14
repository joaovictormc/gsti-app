import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { definirCsrf, get, post, quandoSessaoExpirar } from "./api";

const Ctx = createContext(null);

export function SessaoProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [papeis, setPapeis] = useState({});
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async () => {
    try {
      const r = await get("/me");
      definirCsrf(r.csrf);
      setUsuario(r.usuario);
      setPapeis(r.papeis);
    } catch {
      setUsuario(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    quandoSessaoExpirar(() => {
      definirCsrf("");
      setUsuario(null);
    });
    carregar();
  }, [carregar]);

  const sair = async () => {
    await post("/logout").catch(() => {});
    definirCsrf("");
    setUsuario(null);
  };

  const pode = (perm) => !!usuario?.permissoes.includes(perm);

  return <Ctx.Provider value={{ usuario, papeis, carregando, recarregar: carregar, sair, pode }}>{children}</Ctx.Provider>;
}

export const useSessao = () => useContext(Ctx);
