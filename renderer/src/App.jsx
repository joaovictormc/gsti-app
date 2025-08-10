// renderer/src/App.jsx

import { ThemeProvider, createTheme, CssBaseline, Box, Typography } from '@mui/material';
import CustomerGrid from './components/CustomerGrid'; // Importa nosso novo componente

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2C3E50',
    },
    secondary: {
      main: '#F39C12',
    },
    background: {
      default: '#f4f6f8',
    },
  },
  typography: {
    h4: {
      fontWeight: 600,
    }
  }
});


function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ padding: 3 }}>
        <Typography variant="h4" gutterBottom>
          Gestão de Clientes
        </Typography>
        <CustomerGrid />
      </Box>
    </ThemeProvider>
  );
}

export default App;