# GSTI App — Manual de Uso

**GSTI App** (Gestor de Serviços de TI) é um sistema para assistências técnicas e
prestadores de serviços de TI gerenciarem clientes, ordens de serviço, estoque,
garantias, finanças e relatórios.

Este manual cobre o **uso do dia a dia**. Para instalar, contratar e ativar o
sistema, consulte [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md).

> As imagens marcadas com `🖼️` são sugestões de onde uma captura de tela ajuda.

---

## Sumário

1. [Introdução e perfis de acesso](#1-introdução-e-perfis-de-acesso)
2. [Primeiro acesso e login](#2-primeiro-acesso-e-login)
3. [Tela Início (Dashboard)](#3-tela-início-dashboard)
4. [Clientes](#4-clientes)
5. [Produtos e Serviços](#5-produtos-e-serviços)
6. [Ordens de Serviço (OS)](#6-ordens-de-serviço-os)
7. [Agenda de OS](#7-agenda-de-os)
8. [Estoque](#8-estoque)
9. [Garantias](#9-garantias)
10. [Financeiro](#10-financeiro)
11. [Relatórios](#11-relatórios)
12. [Gerenciar Usuários](#12-gerenciar-usuários)
13. [Configurações](#13-configurações)
14. [Backup e Restauração](#14-backup-e-restauração)
15. [Dúvidas frequentes e suporte](#15-dúvidas-frequentes-e-suporte)

---

## 1. Introdução e perfis de acesso

O sistema tem dois perfis de usuário:

| Perfil | O que acessa |
|--------|--------------|
| **Administrador** | Acesso completo a todos os módulos, inclusive Financeiro, Relatórios, Gerenciar Usuários e Configurações. |
| **Funcionário** | Acesso aos módulos operacionais (Clientes, Produtos/Serviços, OS, Agenda, Estoque, Garantias). O acesso ao **Financeiro** e aos **Relatórios** é liberado individualmente pelo administrador (em Configurações → Permissões de Funcionário). |

O menu lateral mostra apenas os módulos que o usuário atual pode acessar.

🖼️ *Tela principal com o menu lateral.*

---

## 2. Primeiro acesso e login

1. Abra o GSTI App. Informe seu **login** e **senha** e clique em **Entrar**.
2. **Esqueceu a senha?** Clique no link abaixo do botão, informe seu e-mail e
   siga as instruções enviadas (é preciso ter o envio de e-mail configurado —
   ver [Configurações](#13-configurações)). Você receberá um código para
   cadastrar uma nova senha.

> A primeira execução do sistema em uma máquina nova exibe o **assistente de
> configuração** (ativação + banco + criação do administrador). Isso é feito
> uma única vez — ver o guia de instalação.

🖼️ *Tela de login (pode exibir a logo e o fundo personalizados da empresa).*

---

## 3. Tela Início (Dashboard)

A tela **Início** reúne indicadores e atalhos do negócio. Ela é **modular**: um
botão de personalização permite ligar/desligar seções para montar a tela do seu
jeito. Seções disponíveis incluem:

- **Indicadores (KPIs)**: OS em aberto, em andamento, finalizadas, etc.
- **Resumo financeiro do mês** (receita, despesas, lucro) — para quem tem acesso.
- **Estoque crítico**: produtos no/abaixo do mínimo.
- **Serviços mais utilizados** (últimos 30 dias).
- **OS agendadas no mês**.
- **Alertas** (garantias próximas do fim, etc.).

🖼️ *Dashboard com as seções ativas e o botão de personalização.*

---

## 4. Clientes

Cadastro central de clientes.

- **Adicionar/Editar**: nome, tipo de pessoa (Física/Jurídica), CPF/CNPJ (com
  máscara), telefone, e-mail e **endereço**.
- **Busca por CEP**: ao informar o CEP, os campos de endereço
  (logradouro, bairro, cidade, estado) são preenchidos automaticamente; basta
  completar o número.
- **Excluir**: pede confirmação. Não é possível excluir um cliente que possua
  ordens de serviço vinculadas.
- **Buscar**: filtre a lista por nome ou CPF/CNPJ.

🖼️ *Lista de clientes e formulário de cadastro.*

---

## 5. Produtos e Serviços

Catálogo do que você vende/usa nas OS.

- **Tipo**: defina cada item como **Produto** ou **Serviço**.
  - **Produto**: movimenta estoque (tem **estoque atual** e **estoque mínimo**);
    a quantidade é **baixada automaticamente** quando a OS é finalizada.
  - **Serviço**: não movimenta estoque (não aparece nos alertas de estoque).
- **Campos**: descrição, valor, tipo, estoque atual e mínimo (para produtos).

> Cadastre corretamente o tipo: serviços marcados como produto apareceriam
> indevidamente nos alertas de "estoque zerado".

🖼️ *Cadastro de produto x serviço.*

---

## 6. Ordens de Serviço (OS)

Coração do sistema: registra cada atendimento.

### Criar/editar uma OS
- **Cliente** (busca pelo cadastro).
- **Equipamento**: tipo, marca, modelo, número de série.
- **Defeito relatado**, **observações de entrada**, **laudo técnico** e
  **solução aplicada**.
- **Itens**: adicione produtos/serviços do catálogo (quantidade e valor); o
  **valor total** é calculado.
- **Atendente**: defina quem executou a OS (usado no relatório por atendente).
- **Status**: Orçamento, Aguardando Autorização, Em Aberto, Aguardando Peça,
  Em Andamento, Finalizado, Entregue, Cancelado.
- **Garantia**: dias de garantia (padrão 90).

### Busca avançada
Filtre OS por **número da OS, cliente, telefone, equipamento, número de série,
atendente** e por **status**.

### Documentos em PDF
- **PDF de Entrada (2 vias)**: comprovante de entrada do equipamento, em duas
  vias (empresa e cliente), pronto para assinatura.
- **PDF de Saída**: comprovante de entrega/finalização com os itens e valores.

> Ao mudar a OS para **Finalizado**, o estoque dos produtos usados é baixado
> automaticamente (uma única vez por OS).

🖼️ *Formulário da OS, busca avançada e exemplo de PDF de entrada.*

---

## 7. Agenda de OS

Calendário mensal que mostra as OS pela **data prevista**. Use para visualizar a
carga de trabalho do mês e o que está agendado para cada dia. Navegue entre os
meses pelas setas.

🖼️ *Calendário mensal com OS plotadas.*

---

## 8. Estoque

Controle de produtos com base em **estoque atual x estoque mínimo**.

- Lista os produtos e destaca os que estão **no/abaixo do mínimo** (alerta) e os
  **zerados**.
- Permite ajustar quantidades.
- A baixa de estoque acontece automaticamente ao **finalizar** uma OS que
  contenha produtos.

> Apenas itens do tipo **Produto** entram no controle de estoque; serviços são
> ignorados.

🖼️ *Tela de estoque com alertas.*

---

## 9. Garantias

Acompanhamento das garantias das OS entregues.

- Mostra as OS com garantia vigente e os **dias restantes**.
- Permite **avisar o cliente** sobre a garantia por **e-mail** (requer SMTP
  configurado) ou **WhatsApp** (abre o link `wa.me` com a mensagem pronta).

🖼️ *Painel de garantias e botões de aviso.*

---

## 10. Financeiro

> Disponível para administradores e para funcionários com a permissão
> **"Ver Financeiro"**.

### Despesas
Cadastro de despesas com **categoria** e **tipo** (Fixa/Variável). Há apoio para
**despesas de combustível** (km rodados, preço do litro e consumo médio).

### Receitas Avulsas
Receitas que não vêm de OS (ex.: venda balcão), com descrição, valor e data.

### Resumo Financeiro
Painel com seletor de período (datas ou atalhos "Este mês", "Mês passado",
"Este ano") contendo:

- **Cards de resumo**: receita total, despesas, lucro líquido e lucro médio mensal.
- **Gráficos**: **Receitas por Fonte** (OS x Avulsas) e **Despesas por Categoria**.
- **Despesas detalhadas por categoria**: tabela com subtotais, percentual e
  separação Fixa/Variável.
- **Fluxo de caixa**: todas as entradas e saídas do período, em ordem cronológica,
  com totalizadores.
- **Projeção financeira**: "Lucro Líquido Mensal Projetado" = Receita média −
  Despesa variável média − **Despesa fixa estimada** (você informa esse valor).
- **Metas financeiras**: cadastre várias metas (descrição + valor) e veja o
  **tempo estimado** para atingir cada uma com base no lucro médio.
- **Gráficos mensal e anual** de receita x despesa.
- **Exportar Excel**: gera uma planilha com abas de Resumo, Fluxo de Caixa,
  Receitas (OS/Avulsas), Despesas, **Despesas por Categoria** e **Receitas por Fonte**.

🖼️ *Resumo financeiro com gráficos, projeção e metas.*

---

## 11. Relatórios

> Disponível para administradores e para funcionários com a permissão
> **"Ver Relatórios"**.

| Relatório | O que mostra |
|-----------|--------------|
| **OS por Cliente** | Todas as OS de um cliente selecionado. |
| **OS por Status** | OS filtradas por um status específico. |
| **OS Abertas por Tempo** | OS não finalizadas, das mais antigas para as mais recentes, com **dias em aberto** e destaque para as **atrasadas** (previsão vencida). |
| **OS por Atendente** | OS agrupadas por atendente/técnico (mensal). |
| **Lucratividade** | Margem/receita/custo por OS. |
| **Serviços Mais Usados** | Ranking de produtos/serviços mais utilizados no período. |
| **Histórico de Equipamento** | Busca por número de série e lista todas as OS daquele equipamento. |
| **Receitas Detalhadas** | Lista cronológica de todas as receitas (OS + Avulsas) no período. |

🖼️ *Exemplo do relatório "OS Abertas por Tempo".*

---

## 12. Gerenciar Usuários

> Apenas administradores.

- **Criar/editar/excluir** usuários.
- Definir o **papel**: Administrador ou Funcionário.
- As permissões específicas de funcionário (Financeiro/Relatórios) ficam em
  **Configurações → Permissões de Funcionário**.

🖼️ *Tela de gerenciamento de usuários.*

---

## 13. Configurações

> Apenas administradores.

- **E-mail (SMTP)**: servidor, porta, SSL/TLS, usuário, senha e remetente. Há
  botão **Testar Envio**. Necessário para reset de senha e notificações.
- **Personalização (Whitelabel)**: **nome da empresa**, **logo** (exibida na
  barra lateral) e **imagem de fundo da tela de login**.
- **Permissões de Funcionário**: liberar **Ver Financeiro** e/ou **Ver Relatórios**.
- **Notificações por e-mail**: avisar o cliente quando a OS é **finalizada** e/ou
  avisar o técnico quando uma **nova OS** é criada (e-mail do técnico).
- **Backup automático**: ativar, escolher **dias da semana**, **horário**,
  **pasta de destino** e **política de retenção** (dias).
- **Licenciamento e Ativação**: mostra o status da licença (ativa/teste, validade,
  dias restantes) e permite definir a **URL do servidor de ativação**.

🖼️ *Tela de configurações.*

---

## 14. Backup e Restauração

- **Backup manual**: em Configurações, botão **Backup Agora** gera um arquivo do
  banco.
- **Restauração**: botão **Restaurar** recupera um backup (reinicie o app depois
  para garantir consistência).
- **Backup automático**: configure dias, horário e retenção. Para ter o backup
  "na nuvem", aponte a **pasta de destino** para uma pasta sincronizada pelo
  **Google Drive, OneDrive ou Dropbox**.

> A política de **retenção** apaga automaticamente backups mais antigos que o
> número de dias definido (0 = manter todos), evitando acúmulo de arquivos.

---

## 15. Dúvidas frequentes e suporte

- **Não recebo e-mails (reset de senha / notificações)**: confira as
  configurações de SMTP e use **Testar Envio**.
- **Um serviço apareceu como "estoque zerado"**: ele provavelmente foi cadastrado
  como **Produto**. Edite e marque como **Serviço**.
- **A logo/fundo não aparece**: confirme o arquivo selecionado em Configurações e
  salve novamente (imagens até 2 MB para logo; até 5 MB para o fundo).
- **Licença expirada / "Ativação necessária"**: veja
  [INSTALACAO-E-ATIVACAO.md](./INSTALACAO-E-ATIVACAO.md).

**Suporte:** pelo e-mail de suporte informado no site do produto.
