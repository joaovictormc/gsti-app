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

O sistema tem três perfis de usuário:

| Perfil | O que acessa |
|--------|--------------|
| **Administrador** | Acesso completo a todos os módulos, inclusive Financeiro, Relatórios, Gerenciar Usuários e Configurações. |
| **Funcionário** | Módulos operacionais (Clientes, Equipamentos, Produtos/Serviços, OS, Agenda, Estoque, Garantias). Por padrão pode cadastrar, editar, excluir e ver custos; **Financeiro** e **Relatórios** vêm desligados. |
| **Técnico** | Por padrão vê e trabalha **só nas OS em que é o responsável**; clientes, equipamentos, produtos e estoque ficam para consulta, sem custos e sem exclusão. |

> **Módulos do plano:** alguns recursos são módulos que dependem do plano contratado —
> Financeiro completo, Relatórios, Controle de estoque, Perfis e permissões avançadas,
> Personalização da marca e Automações. Módulos não incluídos aparecem com **cadeado** para
> o administrador (com o botão "Ver planos") e ficam ocultos para os demais usuários. A lista
> do seu plano está em Configurações → Licenciamento.

O que cada perfil (Funcionário e Técnico) pode fazer é ajustado pelo administrador em
**Configurações → Permissões por perfil**. O menu e os botões mostram apenas o que o
usuário atual pode usar — e as regras também valem internamente, não só na tela.

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
- **Histórico**: resumo e lista das OS do cliente.

🖼️ *Lista de clientes e formulário de cadastro.*

### Equipamentos
Inventário dos aparelhos de cada cliente (tipo, marca, modelo, número de série e
observações), com o **histórico de OS** de cada aparelho. Ao salvar uma OS, você escolhe
um equipamento do cliente ou informa um novo — ele é cadastrado automaticamente. O número
de série não se repete para o mesmo cliente.

---

## 5. Produtos e Serviços

Catálogo do que você vende/usa nas OS.

- **Tipo**: defina cada item como **Produto** ou **Serviço**.
  - **Produto**: movimenta estoque (tem **estoque atual** e **estoque mínimo**);
    a quantidade é **baixada automaticamente** quando a OS é finalizada.
  - **Serviço**: não movimenta estoque (não aparece nos alertas de estoque).
- **Campos**: descrição, valor de venda, **custo** (opcional, usado na margem), tipo,
  estoque inicial e mínimo (para produtos). A lista mostra a **margem** de cada item.

> Cadastre corretamente o tipo: serviços marcados como produto apareceriam
> indevidamente nos alertas de "estoque zerado".

🖼️ *Cadastro de produto x serviço.*

---

## 6. Ordens de Serviço (OS)

Coração do sistema: registra cada atendimento.

### Criar/editar uma OS
- **Cliente** (busca pelo cadastro).
- **Equipamento**: escolha um aparelho do cliente ou preencha tipo, marca, modelo e
  número de série de um novo.
- **Defeito relatado**, **observações de entrada**, **laudo técnico** e
  **solução aplicada**.
- **Itens**: adicione produtos/serviços do catálogo (quantidade, valor e uma **nota**
  por item, que aparece no recibo de saída); o **valor total** é calculado.
- **Atendente**: defina quem executou a OS (usado no relatório por atendente).
- **Status**: Orçamento, Aguardando Autorização, Em Aberto, Aguardando Peça,
  Em Andamento, Finalizado, Entregue, Cancelado.
- **Garantia**: dias de garantia (padrão 90).
- **Histórico de status**: a linha do tempo mostra cada mudança de status, com data e
  usuário.

### Busca avançada
Filtre OS por **número da OS, cliente, telefone, equipamento, número de série,
atendente** e por **status**.

### Documentos em PDF
- **PDF de Entrada (2 vias)**: comprovante de entrada do equipamento, em duas
  vias (empresa e cliente), pronto para assinatura.
- **PDF de Saída**: comprovante de entrega/finalização com os itens e valores.

> Ao mudar a OS para **Finalizado**, o estoque dos produtos usados é baixado
> automaticamente (uma única vez por OS).

### Avisar o cliente
- **WhatsApp**: o botão verde na lista de OS abre a conversa com uma mensagem pronta
  conforme o status (as mensagens são editáveis em Configurações).
- **E-mail automático**: pode ser ligado para os status escolhidos em Configurações.

### Laudos técnicos (módulo Diagnóstico)

Com o módulo **Diagnóstico**, cada OS ganha o ícone de **laudos** (monitor com coração) na
lista de Ordens de Serviço.

1. **Baixe o agente** uma vez: no diálogo de laudos, **Baixar GSTI Diagnóstico** e escolha o
   pen drive.
2. No **computador do cliente**, abra o **GSTI Diagnóstico** pelo pen drive (confirme a
   permissão de administrador), marque **Entrada**, informe o nº da OS e clique em
   **Iniciar diagnóstico** (menos de 1 minuto). Nada é instalado no computador do cliente.
3. Mande o laudo para a OS:
   - **Pela rede** (mesma rede da loja): na OS, **Receber pela rede** mostra um código; no
     agente, **Enviar para o GSTI App**, escolha a loja e digite o código.
   - **Por arquivo**: no agente, **Salvar arquivo do laudo**; na OS, **Importar arquivo**.
4. Depois do reparo, repita com **Saída**. Na OS, **Comparativo antes e depois do reparo**
   mostra os problemas resolvidos e o que mudou (ex.: SSD novo, espaço livre, bateria); salve o
   **PDF** para entregar ao cliente.

**Otimização (opcional)**: no agente, depois do diagnóstico de entrada, **Otimizar este
computador** lista ações de limpeza e manutenção (temporários, caches, Windows Update, TRIM,
verificação de arquivos do sistema…). As que **apagam dados do cliente** (como esvaziar a
Lixeira) vêm desmarcadas. Informe **quem autorizou**, confirme e execute; ao final, **Gerar
laudo de saída agora** registra o que foi feito e o espaço liberado no laudo e no PDF. O agente
também roda no **macOS** e no **Linux** (escolha o sistema em **Baixar GSTI Diagnóstico**).
Os ajustes de **Desempenho e aparência** (efeitos visuais, plano de energia, barra de tarefas…)
podem ser revertidos a qualquer momento pelo próprio agente em **Desfazer ajustes**; os marcados
com **Reiniciar** só valem depois de reiniciar o computador.

**Pós-formatação**: na tela inicial ou no resultado do agente,
- **Drivers** (Windows): **antes de formatar**, clique em **Fazer backup dos drivers** (fica no
  pen drive). **Depois de formatar**, abra o agente de novo em **Drivers**: marque **Windows
  Update**, a ferramenta do fabricante (Dell, Lenovo ou HP, quando for o caso) e os drivers do
  repositório da assistência ou do backup; informe quem autorizou e clique em **Instalar
  drivers**. A placa de rede é instalada primeiro; nenhum driver é trocado por uma versão mais
  antiga. No fim aparece o que ainda ficou sem driver.
- **Instalar programas**: marque os programas do cliente (navegadores, Office/LibreOffice/WPS,
  leitor de PDF, 7-Zip, WhatsApp…) e clique em **Instalar programas**. Precisa de internet.
  Programas pagos (Microsoft 365, WinRAR) dependem da licença do cliente.

Gere o **laudo de saída** no final: ele registra otimização, drivers e programas instalados.

O laudo aponta problemas **críticos** (disco com falha, SSD gasto, bateria muito fraca,
superaquecimento, pouco espaço) e **pontos de atenção** (Windows não ativado, sem antivírus,
desligamentos inesperados, pouca memória). Na primeira vez que receber pela rede, o Windows
pode pedir para liberar o GSTI App no firewall: escolha **Redes privadas**.

### Nota fiscal
Nas OS **finalizadas ou entregues**, o botão de nota fiscal abre as notas da OS:

- **Registrar nota emitida por fora** (todos os planos): informe tipo (NFS-e, NF-e,
  NFC-e), número, série, data, valor e, se quiser, a chave de acesso, o PDF e o XML. Os
  anexos ficam no banco e abrem em qualquer computador.
- **Emitir NFS-e** (quando um emissor integrado estiver configurado, no plano anual com
  renovação automática): confira os dados, ajuste a descrição e o valor e emita. A lista
  mostra a situação — processando, emitida, rejeitada (com o motivo) ou cancelada — e
  guarda PDF e XML.
- **Cancelar**: nota manual é apenas marcada como cancelada (cancele também onde ela foi
  emitida); NFS-e emitida pelo app é cancelada no emissor.
- Uma OS com nota registrada não pode ser excluída.

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
- Definir o **papel**: Administrador, Funcionário ou Técnico.
- O que Funcionário e Técnico podem fazer fica em **Configurações → Permissões por perfil**.
- Não é possível excluir ou rebaixar o próprio usuário, nem deixar o sistema sem administrador.

🖼️ *Tela de gerenciamento de usuários.*

---

## 13. Configurações

> Apenas administradores.

- **E-mail (SMTP)**: servidor, porta, SSL/TLS, usuário, senha e remetente. Há
  botão **Testar Envio**. Necessário para reset de senha e notificações.
- **Personalização da marca**: **nome da empresa** (menu, login e barra de título),
  **logo** (menu, login e, opcionalmente, ícone da janela), **mensagem** e **imagem de
  fundo da tela de login**, e o **"Desenvolvido por"** do rodapé do login.
- **Dados da empresa nos documentos**: CNPJ/CPF, telefone, e-mail, endereço e site nos
  PDFs; textos de **condições de serviço** e **termo de garantia**.
- **Nota fiscal**: leia e aceite "Como funciona a emissão"; escolha o emissor (Registro
  manual; Notaas no plano anual com renovação automática), cadastre as credenciais (use
  **Testar conexão**), os **dados fiscais** da empresa e, se o emissor precisar, o
  **certificado digital A1** (.pfx). Credenciais e certificado ficam cifrados só neste
  computador.
  Não encontrou o seu emissor? Use **Pedir outro emissor** (os mais pedidos entram primeiro e
  você recebe um e-mail quando estiver disponível) ou veja os **Guias no site**.
- **Permissões por perfil**: tabela com o que Funcionário e Técnico podem fazer.
- **Notificações por e-mail**: avisar o cliente quando a OS é **finalizada** ou muda para
  os status escolhidos, e avisar o técnico quando uma **nova OS** é criada; mensagens por
  status editáveis (também usadas no WhatsApp).
- **Backup automático**: ativar, escolher **dias da semana**, **horário**,
  **pasta de destino** e **política de retenção** (dias).
- **Licenciamento e Ativação**: mostra o status da licença (ativa/teste, validade,
  dias restantes), os **módulos incluídos no plano** e o botão **Verificar agora** (aplica na
  hora uma mudança de plano feita pelo suporte).
- **Atualizações**: o sistema procura novas versões sozinho (ao abrir e a cada 6 horas) e
  baixa em segundo plano. Quando a versão estiver pronta, aparece o aviso **Versão X pronta
  para instalar** com as novidades: clique em **Reiniciar e atualizar** ou apenas feche o
  sistema no fim do expediente — a instalação acontece ao fechar. Os dados e as
  configurações são mantidos. Aqui também dá para **Verificar atualizações** na hora.
  É preciso ter licença válida e internet.

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
- **"Você não tem permissão para esta ação"**: o perfil do usuário não tem essa
  permissão; o administrador ajusta em Configurações → Permissões por perfil.
- **Zoom da tela**: `Ctrl +`, `Ctrl -` e `Ctrl 0`.

### Abrir um chamado de suporte

1. Clique em **Suporte**, na parte de baixo do menu lateral (a tela atual é capturada nesse
   momento, para você anexar se quiser).
2. Escolha o **tipo** (erro, dúvida, sugestão, pagamento e licença), escreva o **assunto** e
   **o que aconteceu**. Confira o **e-mail para resposta**.
3. Deixe marcado **Incluir dados técnicos** (versão, sistema, licença, tela e erros recentes —
   use **Ver o que será enviado** para conferir) e **Anexar captura da tela**, se ajudar.
4. Clique em **Enviar chamado**. Você recebe o número e o link por e-mail; as respostas
   também chegam por e-mail.

Em **Meus chamados** aparecem os chamados desta licença e a situação de cada um; clique para
abrir no navegador, responder e enviar mais arquivos. Sem licença ativa (ou sem internet),
abra o chamado pelo site, na página **Suporte**.
