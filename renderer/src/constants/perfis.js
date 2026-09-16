// Papéis de usuário e permissões configuráveis por perfil.
// As regras valem no processo principal (controle-acesso.js); aqui ficam só os rótulos.

export const PAPEIS = [
  { valor: "Admin", rotulo: "Admin" },
  { valor: "Funcionario", rotulo: "Funcionário" },
  { valor: "Tecnico", rotulo: "Técnico" },
];

export const rotuloPapel = (valor) => PAPEIS.find((p) => p.valor === valor)?.rotulo || valor;

// Perfis editáveis em Configurações > Permissões (Admin sempre tem acesso total)
export const PERFIS_CONFIGURAVEIS = [
  { chave: "funcionario", rotulo: "Funcionário" },
  { chave: "tecnico", rotulo: "Técnico" },
];

export const PERMISSOES = [
  {
    chave: "somenteOSAtribuidas",
    rotulo: "Só OS atribuídas",
    descricao: "Vê e trabalha apenas nas OS em que é o responsável; as OS que abrir ficam com ele.",
  },
  {
    chave: "editarCadastros",
    rotulo: "Cadastrar e editar clientes e equipamentos",
    descricao: "Sem esta permissão, clientes e equipamentos ficam só para consulta.",
  },
  {
    chave: "editarProdutos",
    rotulo: "Cadastrar e editar produtos e serviços",
    descricao: "Inclui preço de venda.",
  },
  {
    chave: "ajustarEstoque",
    rotulo: "Ajustar estoque",
    descricao: "Entradas, saídas e estoque mínimo. A baixa ao finalizar a OS continua automática.",
  },
  {
    chave: "verCusto",
    rotulo: "Ver custo e margem",
    descricao: "Custo dos produtos, margem e relatório de Lucratividade.",
  },
  {
    chave: "podeExcluir",
    rotulo: "Excluir registros",
    descricao: "OS, clientes, equipamentos e produtos.",
  },
  {
    chave: "canSeeFinancial",
    rotulo: "Financeiro",
    descricao: "Despesas, receitas, resumo financeiro e valores na tela inicial.",
  },
  {
    chave: "canSeeReports",
    rotulo: "Relatórios",
    descricao: "Os relatórios consideram todas as OS, mesmo com \"Só OS atribuídas\".",
  },
];
