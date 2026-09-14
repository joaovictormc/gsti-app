import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { ptBR } from "@mui/material/locale";
import App from "./App";

const tema = createTheme(
  {
    palette: {
      primary: { main: "#10213a", light: "#2b4468", contrastText: "#fffdf8" },
      secondary: { main: "#ff6a2b", contrastText: "#1a0e06" },
      success: { main: "#1f9d6b" },
      background: { default: "#f4f1ea", paper: "#ffffff" },
      text: { primary: "#1b2433", secondary: "#55607a" },
      divider: "#e2dccf",
    },
    shape: { borderRadius: 10 },
    typography: {
      fontFamily: '"Schibsted Grotesk", "Segoe UI", system-ui, sans-serif',
      h4: { fontWeight: 700, letterSpacing: "-0.02em" },
      h5: { fontWeight: 700, letterSpacing: "-0.01em" },
      h6: { fontWeight: 700 },
      button: { textTransform: "none", fontWeight: 600 },
      overline: { fontFamily: '"JetBrains Mono", monospace', letterSpacing: "0.1em", fontWeight: 500 },
    },
    components: {
      MuiButton: { defaultProps: { disableElevation: true } },
      MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { border: "1px solid #e2dccf" } } },
      MuiAppBar: { styleOverrides: { root: { border: "none" } } },
      MuiDrawer: { styleOverrides: { paper: { border: "none" } } },
      MuiDialog: { styleOverrides: { paper: { border: "none" } } },
      MuiMenu: { styleOverrides: { paper: { border: "none" } } },
      MuiTableCell: { styleOverrides: { head: { fontWeight: 600, color: "#55607a", fontSize: "0.8rem" } } },
      MuiTextField: { defaultProps: { size: "small" } },
      MuiSelect: { defaultProps: { size: "small" } },
    },
  },
  ptBR
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider theme={tema}>
      <CssBaseline />
      <BrowserRouter basename="/admin">
        <App />
      </BrowserRouter>
    </ThemeProvider>
  </React.StrictMode>
);
