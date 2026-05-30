const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('api', {
  // Configurações da Aplicação
  isInitialSetupNeeded: () => ipcRenderer.invoke('is-initial-setup-needed'), 
  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),         
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings), 
  testDbConnection: (dbConfig) => ipcRenderer.invoke('test-db-connection', dbConfig), 
  saveInitialConfig: (config) => ipcRenderer.invoke('save-initial-config', config), 
  testEmailSettings: (emailConfig) => ipcRenderer.invoke('test-email-settings', emailConfig),
  selectLogoFile: () => ipcRenderer.invoke('select-logo-file'),
  loadLogoImage: (logoPath) => ipcRenderer.invoke('load-logo-image', logoPath),

// Autenticação e Usuários
  login: (credentials) => ipcRenderer.invoke('handle-login', credentials),
  forgotPassword: (data) => ipcRenderer.invoke('handle-forgot-password', data),
  resetPassword: (data) => ipcRenderer.invoke('handle-reset-password', data),  
  getUsers: () => ipcRenderer.invoke('get-users'),
  addUser: (userData) => ipcRenderer.invoke('add-user', userData),
  updateUser: (userData) => ipcRenderer.invoke('update-user', userData),
  deleteUser: (userId) => ipcRenderer.invoke('delete-user', userId),


  // Clientes
  getCustomers: () => ipcRenderer.invoke('get-customers'),
  addCustomer: (customerData) => ipcRenderer.invoke('add-customer', customerData),
  updateCustomer: (customerData) => ipcRenderer.invoke('update-customer', customerData),
  deleteCustomer: (customerId) => ipcRenderer.invoke('delete-customer', customerId),
  validateCnpj: (cnpj) => ipcRenderer.invoke('validate-cnpj', cnpj),
  
  // Produtos e Serviços
  getProducts: () => ipcRenderer.invoke('get-products'),
  addProduct: (productData) => ipcRenderer.invoke('add-product', productData),
  updateProduct: (productData) => ipcRenderer.invoke('update-product', productData),
  deleteProduct: (productId) => ipcRenderer.invoke('delete-product', productId),
  
  // Ordens de Serviço (Atualizado)
  getOSList: () => ipcRenderer.invoke('get-os-list'),
  getActiveData: () => ipcRenderer.invoke('get-active-data'),
  getOSDetails: (osId) => ipcRenderer.invoke('get-os-details', osId),
  deleteOS: (osId) => ipcRenderer.invoke('delete-os', osId),

  // Funções que recebem o objeto { osData, total }
  addOS: (data) => ipcRenderer.invoke('add-os', data),
  updateOS: (data) => ipcRenderer.invoke('update-os', data),
  
  // Função que recebe o objeto { osId, items }
  addOSItems: (data) => ipcRenderer.invoke('add-os-items', data),
  updateOSItems: (data) => ipcRenderer.invoke('update-os-items', data),

  // Nova função de PDF
  generateEntryReceipt: (osId) => ipcRenderer.invoke('generate-entry-receipt', osId),
  generateExitReceipt: (osId) => ipcRenderer.invoke('generate-exit-receipt', osId),


  // Funções para Despesas
  getExpenses: () => ipcRenderer.invoke('get-expenses'),
  addExpense: (expenseData) => ipcRenderer.invoke('add-expense', expenseData),
  updateExpense: (expenseData) => ipcRenderer.invoke('update-expense', expenseData),
  deleteExpense: (expenseId) => ipcRenderer.invoke('delete-expense', expenseId),

  // Funções para Receitas Avulsas
  getMiscRevenues: () => ipcRenderer.invoke('get-misc-revenues'),
  addMiscRevenue: (revenueData) => ipcRenderer.invoke('add-misc-revenue', revenueData),
  updateMiscRevenue: (revenueData) => ipcRenderer.invoke('update-misc-revenue', revenueData),
  deleteMiscRevenue: (revenueId) => ipcRenderer.invoke('delete-misc-revenue', revenueId),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('get-dashboard-stats'),
  getWarrantyPanel: () => ipcRenderer.invoke('get-warranty-panel'),

  // Funções Financeiras (getFinancialSummary já existe)
  getFinancialSummary: (period) => ipcRenderer.invoke('get-financial-summary', period),
  getMonthlySummary: (year) => ipcRenderer.invoke('get-monthly-summary', year),
  exportFinancialReport: (period) => ipcRenderer.invoke('export-financial-report', period),
  getAnnualSummary: () => ipcRenderer.invoke('get-annual-summary'),
  getAverageProfit: (options) => ipcRenderer.invoke('get-average-profit', options),

  // Funções de Relatórios (Nova Seção)
  getOSByClient: (clientId) => ipcRenderer.invoke('get-os-by-client', clientId),
  getOSByStatus: (status) => ipcRenderer.invoke('get-os-by-status', status),
  getMostUsedServices: (period) => ipcRenderer.invoke('get-most-used-services', period),
  searchOSBySerial: (serialNumber) => ipcRenderer.invoke('search-os-by-serial', serialNumber),
  getDetailedRevenueReport: (period) => ipcRenderer.invoke('get-detailed-revenue-report', period),
});