// Tipos de equipamento usados no cadastro e na OS.
export const TIPOS_EQUIPAMENTO = [
  "Notebook",
  "Desktop",
  "All-in-One",
  "Impressora",
  "Monitor",
  "Celular",
  "Tablet",
  "Console",
  "Outro",
];

// Garante que um tipo antigo/personalizado continue aparecendo na lista.
export const tiposCom = (atual) =>
  atual && !TIPOS_EQUIPAMENTO.includes(atual) ? [...TIPOS_EQUIPAMENTO, atual] : TIPOS_EQUIPAMENTO;

export const descreverEquipamento = (e) =>
  [e.tipo || e.tipo_equipamento, e.marca, e.modelo].filter(Boolean).join(" ") || "Equipamento";
