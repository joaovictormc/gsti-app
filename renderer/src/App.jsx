// renderer/src/App.jsx

import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import CustomerGrid from './components/CustomerGrid';
import ProductServiceGrid from "./components/ProductServiceGrid"; 
import OSGrid from "./components/OSGrid";
import ExpensesGrid from "./components/ExpensesGrid";
import FinancialDashboard from "./components/FinancialDashboard";
import MiscRevenueGrid from "./components/MiscRevenueGrid";

const theme = createTheme({
  // ... seu tema
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ padding: 3 }}>
        {/* <CustomerGrid /> */}
        {/* <ProductServiceGrid /> */}
        {/* <OSGrid /> */}
        {/* <ExpensesGrid /> */}
        <FinancialDashboard />
        {/* <MiscRevenueGrid /> */}
      </Box>
    </ThemeProvider>
  );
}

export default App;
