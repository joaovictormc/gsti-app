// Módulos avançados do GSTI App (venda por módulos). Tudo que não está aqui é a BASE.
// A licença informa quais módulos foram contratados (token → "modulos"); tokens antigos,
// sem a lista, liberam todos. Mesma lista em license-server/lib/modulos.js e
// renderer/src/constants/modulos.js (tests/unit/modulos.test.js confere).
const MODULOS = [
  { chave: "financeiro", nome: "Financeiro completo", descricao: "Despesas, receitas avulsas, resumo financeiro, projeção, metas e exportação para Excel." },
  { chave: "relatorios", nome: "Relatórios", descricao: "Relatórios de OS, atendentes, lucratividade, serviços mais usados e receitas." },
  { chave: "estoque", nome: "Controle de estoque", descricao: "Tela de estoque com entradas, saídas, estoque mínimo e alertas." },
  { chave: "perfis", nome: "Perfis e permissões avançadas", descricao: "Perfil Técnico e permissões configuráveis por perfil." },
  { chave: "marca", nome: "Personalização da marca", descricao: "Logo, fundo e mensagem da tela de login e logo como ícone da janela." },
  { chave: "automacoes", nome: "Automações", descricao: "Avisos automáticos por e-mail e backup automático." },
  { chave: "diagnostico", nome: "Diagnóstico e laudo técnico", descricao: "Agente portátil que gera o laudo do equipamento (hardware, saúde dos discos e bateria, testes) e anexa à OS, com comparativo antes/depois do reparo." },
];

const CHAVES = MODULOS.map((m) => m.chave);
const nomeDoModulo = (chave) => MODULOS.find((m) => m.chave === chave)?.nome || chave;

// Canais IPC que pertencem a um módulo além dos definidos pelo nível de acesso
// (financeiro/relatorios/estoque em controle-acesso.js).
const CANAIS_DE_MODULO = {
  "select-logo-file": "marca",
  "select-background-file": "marca",
  "select-backup-folder": "automacoes",
  "get-stock": "estoque",
  "get-os-laudos": "diagnostico",
  "import-laudo-arquivo": "diagnostico",
  "start-laudo-receiver": "diagnostico",
  "stop-laudo-receiver": "diagnostico",
  "view-laudo": "diagnostico",
  "save-laudo-pdf": "diagnostico",
  "laudo-comparativo": "diagnostico",
  "delete-laudo": "diagnostico",
  "download-diagnostico-agente": "diagnostico",
};

module.exports = { MODULOS, CHAVES, CANAIS_DE_MODULO, nomeDoModulo };
