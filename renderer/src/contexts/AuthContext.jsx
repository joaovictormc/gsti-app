import React, { createContext, useState, useContext, useEffect } from "react";

// 1. Cria o Contexto
const AuthContext = createContext(null);

// 2. Cria o Provedor (Componente que vai envolver a aplicação)
// A sessão fica no processo principal (controle-acesso.js); aqui só espelhamos o
// usuário logado para a interface. Recarregar a janela mantém a sessão.
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result = await window.api.getCurrentSession();
        setCurrentUser(result?.user || null);
      } catch (e) {
        console.error("Erro ao consultar a sessão:", e);
        setCurrentUser(null);
      } finally {
        setLoadingAuth(false); // Marca que a verificação inicial terminou
      }
    })();
  }, []);

  // Chamada após login bem-sucedido (o processo principal já registrou a sessão)
  const login = (userData) => {
    setCurrentUser(userData);
  };

  const logout = async () => {
    try {
      await window.api.logout();
    } catch (e) {
      console.error("Erro ao encerrar a sessão:", e);
    }
    setCurrentUser(null);
  };

  // O valor que será compartilhado com os componentes filhos
  const value = {
    currentUser,
    login,
    logout,
    loadingAuth, // Exporta o estado de loading inicial
  };

  // Só renderiza o conteúdo principal depois de consultar a sessão
  return (
    <AuthContext.Provider value={value}>
      {!loadingAuth && children}
    </AuthContext.Provider>
  );
}

// 3. Cria um Hook customizado para facilitar o uso do contexto
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
