// renderer/src/App.jsx

import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import CustomerGrid from './components/CustomerGrid';
import ProductServiceGrid from "./components/ProductServiceGrid"; 
import OSGrid from "./components/OSGrid";

const theme = createTheme({
  // ... seu tema
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ padding: 3 }}>
        {/* <CustomerGrid />*/}
        {/* <ProductServiceGrid /> */}
        <OSGrid />
      </Box>
    </ThemeProvider>
  );
}

export default App;
