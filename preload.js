const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('api', {
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

  // Funções Financeiras (getFinancialSummary já existe)
  getFinancialSummary: (period) => ipcRenderer.invoke('get-financial-summary', period),
});