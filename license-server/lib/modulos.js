/**
 * Módulos avançados do GSTI App (venda por módulos).
 * Tudo que não está aqui é a BASE, incluída em qualquer plano.
 * A mesma lista existe no app em /modulos.js — mantenha as duas iguais
 * (tests/unit/modulos.test.js confere).
 */
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

// Lista válida, sem repetição, na ordem do catálogo.
function normalizarModulos(lista) {
  if (!Array.isArray(lista)) return [];
  const pedidos = new Set(lista.map(String));
  return CHAVES.filter((c) => pedidos.has(c));
}

// Valor gravado no banco (JSON) -> lista; null/undefined = todos os módulos.
function lerModulos(texto) {
  if (texto === null || texto === undefined) return null;
  try {
    return normalizarModulos(JSON.parse(texto));
  } catch {
    return [];
  }
}

const unirModulos = (a, b) => normalizarModulos([...(a || []), ...(b || [])]);

module.exports = { MODULOS, CHAVES, normalizarModulos, lerModulos, unirModulos };
