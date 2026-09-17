const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agente", {
  estado: () => ipcRenderer.invoke("agente:estado"),
  salvarConfig: (cfg) => ipcRenderer.invoke("agente:salvar-config", cfg),
  diagnosticar: (opcoes) => ipcRenderer.invoke("agente:diagnosticar", opcoes),
  aoProgredir: (fn) => {
    const ouvinte = (_e, etapa) => fn(etapa);
    ipcRenderer.on("agente:progresso", ouvinte);
    return () => ipcRenderer.removeListener("agente:progresso", ouvinte);
  },
  verLaudo: (laudo) => ipcRenderer.invoke("agente:ver-laudo", laudo),
  salvarPdf: (laudo) => ipcRenderer.invoke("agente:salvar-pdf", laudo),
  salvarArquivo: (laudo) => ipcRenderer.invoke("agente:salvar-arquivo", laudo),
  comparar: (laudo) => ipcRenderer.invoke("agente:comparar", laudo),
  salvarPdfComparativo: (par) => ipcRenderer.invoke("agente:salvar-pdf-comparativo", par),
  otimizacaoCatalogo: () => ipcRenderer.invoke("agente:otimizacao-catalogo"),
  otimizar: (dados) => ipcRenderer.invoke("agente:otimizar", dados),
  aoProgredirOtimizacao: (fn) => {
    const ouvinte = (_e, p) => fn(p);
    ipcRenderer.on("agente:otimizacao-progresso", ouvinte);
    return () => ipcRenderer.removeListener("agente:otimizacao-progresso", ouvinte);
  },
  driversAnalisar: (dados) => ipcRenderer.invoke("agente:drivers-analisar", dados),
  driversBackup: (dados) => ipcRenderer.invoke("agente:drivers-backup", dados),
  driversExecutar: (dados) => ipcRenderer.invoke("agente:drivers-executar", dados),
  programasCatalogo: () => ipcRenderer.invoke("agente:programas-catalogo"),
  programasInstalar: (dados) => ipcRenderer.invoke("agente:programas-instalar", dados),
  descobrir: () => ipcRenderer.invoke("agente:descobrir"),
  enviar: (dados) => ipcRenderer.invoke("agente:enviar", dados),
  abrirPasta: () => ipcRenderer.invoke("agente:abrir-pasta"),
  reabrirAdmin: () => ipcRenderer.invoke("agente:reabrir-admin"),
});
