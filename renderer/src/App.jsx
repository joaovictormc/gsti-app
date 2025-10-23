import { ThemeProvider, createTheme, CssBaseline, Box } from "@mui/material";
import CustomerGrid from './components/CustomerGrid';
import ProductServiceGrid from "./components/ProductServiceGrid"; 
import OSGrid from "./components/OSGrid";
import ExpensesGrid from "./components/ExpensesGrid";
import FinancialDashboard from "./components/FinancialDashboard";
import MiscRevenueGrid from "./components/MiscRevenueGrid";
import OSReportClient from "./components/OSReportClient";
import OSReportStatus from "./components/OSReportStatus";
import MostUsedServicesReport from "./components/MostUsedServicesReport";
import EquipmentHistoryReport from "./components/EquipmentHistoryReport";
import DetailedRevenueReport from "./components/DetailedRevenueReport";

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
        {/* <FinancialDashboard /> */}
        {/* <MiscRevenueGrid /> */}
        {/* <OSReportClient /> */}
        {/* <OSReportStatus /> */}
        {/* <MostUsedServicesReport /> */}
        {/* <EquipmentHistoryReport /> */}
        <DetailedRevenueReport />
      </Box>
    </ThemeProvider>
  );
}

export default App;
