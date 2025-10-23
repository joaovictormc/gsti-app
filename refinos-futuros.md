Lista de Funcionalidades Futuras (To-Do)
Módulo Financeiro (Fase 3 - Refinamentos e Avançado)
[ ] Fluxo de Caixa Detalhado (Visualização): Adicionar tabela na tela FinancialDashboard listando todas as transações (Receitas OS, Receitas Avulsas, Despesas) do período selecionado, ordenadas por data.

[ ] Gráfico de Despesas por Categoria (Pizza): Criar gráfico no FinancialDashboard mostrando a distribuição percentual das despesas por categoria.

[ ] Gráfico de Receitas (OS vs. Avulsas): Criar gráfico no FinancialDashboard mostrando a proporção das fontes de receita.

[ ] Aprimorar Exportação Excel: Adicionar mais planilhas ou detalhes conforme necessário (ex: Despesas por Categoria, Receitas por Fonte).

[ ] Projeção Financeira Simplificada: Calcular e exibir "Lucro Líquido Mensal Projetado" (Receita Média - Desp. Var. Média - Desp. Fixa Estimada - requer campo para Desp. Fixa Estimada).

[ ] Metas Financeiras Múltiplas: Permitir cadastrar várias metas (descrição, valor) e exibir tempo estimado para cada uma baseado no Lucro Médio.

Ordens de Serviço (Fase 2 - Melhorias)
[ ] Busca Avançada de OS: Implementar busca mais robusta na tela OSGrid, permitindo filtrar por ID da OS, Telefone do Cliente, ou detalhes do Equipamento (Marca/Modelo).

[ ] Vincular OS a Equipamento Específico: (Requer Módulo de Equipamentos) Associar uma OS a um item específico da tabela equipamentos do cliente, em vez de apenas campos de texto.

[ ] Adicionar Notas por Item na OS: Permitir adicionar observações específicas para cada produto ou serviço dentro da OS (exigiria nova coluna em os_itens).

[ ] Opções de Customização para PDFs: (Avançado) Permitir adicionar logo da empresa, dados de contato, ou outras pequenas customizações nos PDFs gerados.

[ ] Histórico de Status da OS: (Avançado) Registrar mudanças de status e datas para rastreamento.

Cadastros Gerais (Fase 1 - Melhorias)
[ ] Módulo de Equipamentos: Implementar interface para usar a tabela equipamentos (que já existe no script SQL), criando um inventário de equipamentos por cliente.

[ ] Controle de Estoque (Produtos): Adicionar campos de quantidade_estoque na tabela produtos_servicos e lógica básica de baixa ao adicionar um "Produto" a uma OS.

[ ] Vincular Custo a Produtos/Serviços: Adicionar um campo custo na tabela produtos_servicos para permitir cálculos futuros de margem de lucro.

[ ] Busca/Validação de Endereço (CEP): Adicionar funcionalidade no cadastro de clientes para buscar endereço via CEP (usando API externa).