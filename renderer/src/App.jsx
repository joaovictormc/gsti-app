// renderer/src/App.jsx

import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
// import CustomerGrid from './components/CustomerGrid'; // Comente ou remova esta linha
import ProductServiceGrid from "./components/ProductServiceGrid"; // Importe o novo componente

const theme = createTheme({
  // ... seu tema
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ padding: 3 }}>
        {/* <CustomerGrid /> */} {/* Comente ou remova o componente antigo */}
        <ProductServiceGrid /> {/* Adicione o novo componente */}
      </Box>
    </ThemeProvider>
  );
}

export default App;
