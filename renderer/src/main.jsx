import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Seu componente App principal
import { AuthProvider } from './contexts/AuthContext'; // <-- Importa o AuthProvider
import BarraTitulo from './components/BarraTitulo';
import './index.css'; // Ou seu CSS principal

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BarraTitulo />
    {/* Envolve o App com o AuthProvider */}
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);