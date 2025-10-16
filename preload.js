const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Função que já tínhamos
  getCustomers: () => ipcRenderer.invoke('get-customers'),

  // NOVA FUNÇÃO: envia os dados de um novo cliente para o processo principal
  // O 'customerData' é um objeto com nome, telefone, email, etc.
  addCustomer: (customerData) => ipcRenderer.invoke('add-customer', customerData),
  // NOVA FUNÇÃO: valida CPF/CNPJ
  validateCnpj: (cnpj) => ipcRenderer.invoke('validate-cnpj', cnpj),
  deleteCustomer: (customerId) => ipcRenderer.invoke('delete-customer', customerId),
  updateCustomer: (customerData) => ipcRenderer.invoke('update-customer', customerData),


   // NOVAS FUNÇÕES DE PRODUTOS/SERVIÇOS
  getProducts: () => ipcRenderer.invoke('get-products'),
  addProduct: (productData) => ipcRenderer.invoke('add-product', productData),
  updateProduct: (productData) => ipcRenderer.invoke('update-product', productData),
  deleteProduct: (productId) => ipcRenderer.invoke('delete-product', productId),  
});