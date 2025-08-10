const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Função que já tínhamos
  getCustomers: () => ipcRenderer.invoke('get-customers'),

  // NOVA FUNÇÃO: envia os dados de um novo cliente para o processo principal
  // O 'customerData' é um objeto com nome, telefone, email, etc.
  addCustomer: (customerData) => ipcRenderer.invoke('add-customer', customerData)
});