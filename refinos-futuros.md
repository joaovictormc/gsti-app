# Lista de Funcionalidades Futuras (To-Do)

## Módulo Financeiro (Fase 3 - Refinamentos e Avançado)

- [ ] **Fluxo de Caixa Detalhado (Visualização):** Adicionar tabela na tela `FinancialDashboard` listando todas as transações (Receitas OS, Receitas Avulsas, Despesas) do período selecionado, ordenadas por data.
- [ ] **Gráfico de Despesas por Categoria (Pizza):** Criar gráfico no `FinancialDashboard` mostrando a distribuição percentual das despesas por categoria.
- [ ] **Gráfico de Receitas (OS vs. Avulsas):** Criar gráfico no `FinancialDashboard` mostrando a proporção das fontes de receita.
- [ ] **Relatório Detalhado de Despesas (Visualização/Excel):** Criar tela/planilha Excel listando todas as despesas no período, talvez agrupadas por Categoria ou Tipo (Fixa/Variável).
- [ ] **Aprimorar Exportação Excel:** Adicionar mais planilhas ou detalhes (ex: Despesas por Categoria, Receitas por Fonte) ao arquivo `.xlsx`.
- [ ] **Projeção Financeira Simplificada:** Calcular e exibir "Lucro Líquido Mensal Projetado" (Receita Média - Desp. Var. Média - Desp. Fixa Estimada - *requer campo para Desp. Fixa Estimada*).
- [ ] **Metas Financeiras Múltiplas:** Permitir cadastrar várias metas (descrição, valor) e exibir tempo estimado para cada uma baseado no Lucro Médio.

## Ordens de Serviço (Fase 2 e Fase 4 - Melhorias e Relatórios)

- [ ] **Relatório de OS Abertas por Tempo:** Listar OS com status 'Em Aberto', 'Aguardando Peça', 'Em Andamento', ordenadas pelas mais antigas.
- [ ] **Busca Avançada de OS:** Implementar busca mais robusta na tela `OSGrid`, permitindo filtrar por ID da OS, Telefone do Cliente, ou detalhes do Equipamento (Marca/Modelo).
- [ ] **Vincular OS a Equipamento Específico:** (Requer Módulo de Equipamentos) Associar uma OS a um item específico da tabela `equipamentos` do cliente.
- [ ] **Adicionar Notas por Item na OS:** Permitir adicionar observações específicas para cada produto ou serviço *dentro* da OS (`os_itens`).
- [ ] **Opções de Customização para PDFs:** (Avançado) Permitir adicionar logo da empresa, dados de contato, etc., aos PDFs.
- [ ] **Histórico de Status da OS:** (Avançado) Registrar mudanças de status e datas para auditoria.
- [ ] **Adicionar campo nas OS:** Criar campo para definir qual pessoa atendeu a OS em especifico, para saber quem executou cada serviço e no final de cada mês gerar um relatório sobre isso

## Cadastros Gerais (Fase 1 - Melhorias)

- [ ] **Módulo de Equipamentos:** Implementar interface para usar a tabela `equipamentos` (inventário de equipamentos por cliente).
- [ ] **Controle de Estoque (Produtos):** Adicionar campo `quantidade_estoque` em `produtos_servicos` e lógica de baixa ao usar um "Produto" na OS.
- [ ] **Vincular Custo a Produtos/Serviços:** Adicionar campo `custo` em `produtos_servicos` para cálculo futuro de margem.
- [ ] **Busca/Validação de Endereço (CEP):** Adicionar busca de endereço por CEP no cadastro de clientes.

## Usuários e Permissões (Fase 4 - Avançado)
- [ ] Entrando no usuário com privilégios de funcionário, ainda estou com visão aos módulos de relatório e financeiro, que devem ser somente para o admin e caso eu precise de liberar algum módulo eu gostaria de seleciona-lo

- [ ] **Notificações por e-mail:** Criar função atrelado a configuração de smtp para disparar e-mail para os técnicos informando que há nova ordem de serviço que entrou/aprovou e notificação para cliente informando que o produto ja está finalizado


## Whitelabeling
- [ ] Criar área para o usuário definir um plano de fundo para a tela de login/home ao lado da opção de adicionar a lgomarca da empresa

- [ ] Adicionar opção para inserir imagem para plano de fundo na tela de login da empresa


## Autenticação para instalar
- [ ] Adicionar recurso no instalador para o usuário inserir o e-mail usado para contratar o sistema e uma senha que será vinculada ao e-mail da pessoa que contratou, isso pode assegurar de possíveis usos indevidos do sistema