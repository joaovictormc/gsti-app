import React, { createContext, useState, useContext, useEffect } from "react";

// 1. Cria o Contexto
const AuthContext = createContext(null);

// 2. Cria o Provedor (Componente que vai envolver a aplicação)
export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true); // Para checar se já tentou carregar do storage

  // Tenta carregar o usuário do sessionStorage ao iniciar (opcional, para persistência simples)
  useEffect(() => {
    try {
      const storedUser = sessionStorage.getItem("gstiUser");
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error("Erro ao carregar usuário do sessionStorage:", e);
      sessionStorage.removeItem("gstiUser"); // Limpa se estiver corrompido
    } finally {
      setLoadingAuth(false); // Marca que a verificação inicial terminou
    }
  }, []);

  // Função chamada pelo LoginScreen em caso de sucesso
  const login = (userData) => {
    console.log("AuthProvider: Login successful, setting user:", userData);
    setCurrentUser(userData);
    try {
      // Salva no sessionStorage para persistir se fechar/reabrir (opcional)
      sessionStorage.setItem("gstiUser", JSON.stringify(userData));
    } catch (e) {
      console.error("Erro ao salvar usuário no sessionStorage:", e);
    }
  };

  // Função para fazer logout
  const logout = () => {
    console.log("AuthProvider: Logging out user");
    setCurrentUser(null);
    sessionStorage.removeItem("gstiUser"); // Remove do storage
    // Aqui você poderia redirecionar para a tela de login se usar roteamento
  };

  // O valor que será compartilhado com os componentes filhos
  const value = {
    currentUser,
    login,
    logout,
    loadingAuth, // Exporta o estado de loading inicial
  };

  // Renderiza os componentes filhos envolvidos pelo Provider
  // Só renderiza o conteúdo principal depois de verificar o storage
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
