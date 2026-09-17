# Histórico de versões — GSTI App

## 1.4.0 — em desenvolvimento

### Novidades
- **Venda por módulos**: a licença informa os módulos avançados contratados (Financeiro
  completo, Relatórios, Controle de estoque, Perfis e permissões avançadas, Personalização
  da marca e Automações). A base está sempre incluída.
  - O app esconde e bloqueia o que não foi contratado; o Admin vê os módulos com cadeado e
    o botão "Ver planos". Configurações mostram os módulos do plano.
  - Painel: módulos por oferta, por licença (upgrade) e do teste grátis; área do cliente
    mostra os módulos incluídos.
- **Atualização automática**: o app procura novas versões ao abrir e a cada 6 horas, baixa
  em segundo plano e instala ao reiniciar (botão "Reiniciar e atualizar") ou ao fechar.
  - Aviso "Versão X pronta para instalar" com as novidades; seção **Configurações →
    Atualizações** com a versão instalada, o andamento e "Verificar atualizações".
  - Só licenças válidas (ou teste no prazo) recebem; dados e configurações são mantidos.
  - Servidor: `node admin.js publicar-atualizacao dist_electron`; *Painel → Sistema* mostra a
    versão publicada.
- **Suporte (helpdesk)**: chamados de dúvidas, erros, sugestões e pagamento, com anexos
  (prints, PDF e logs).
  - **No app**: botão **Suporte** na barra lateral abre o chamado com dados técnicos
    (versão, sistema, licença, tela e erros recentes) e captura da tela, ambos opcionais e
    visíveis antes do envio; aba **Meus chamados** mostra a situação.
  - **No site**: página **/suporte** para qualquer pessoa (inclusive quem ainda não comprou)
    e página do chamado para acompanhar e responder; a **área do cliente** lista os chamados.
  - **No painel**: menu **Suporte** com filtros, responsável, prioridade, situação, notas
    internas e anexos; papel de equipe **Suporte**; resumo no Painel.
  - E-mail a cada novidade (cliente e equipe); chamados parados esperando o cliente fecham
    sozinhos após 7 dias.
- **Emissores de nota fiscal no site**: página **/emissores** com o catálogo e o passo a passo
  de cada emissor. Clientes pedem a integração de **outro emissor** pela área do cliente ou
  em **Configurações → Nota fiscal → Pedir outro emissor**; o painel mostra o ranking dos mais
  pedidos, a situação (em análise, planejado, disponível…), uma nota para os clientes e avisa
  por e-mail quem pediu quando o emissor fica disponível.

### Correções
- Legendas dos gráficos do Resumo Financeiro não cortam mais nomes longos.
- Site: formulários marcados como ocultos continuavam visíveis (afetava o login da área do
  cliente).

### Compatibilidade
- Licenças já emitidas e tokens antigos continuam com todos os módulos.
- Ofertas existentes passam a vender só a base até os módulos serem marcados no painel.
- O instalador passa a se chamar `GSTI-App-Setup-<versão>.exe`. Quem tem a 1.3.0 ou
  anterior instala a 1.4.0 manualmente uma vez; daí em diante as versões chegam sozinhas.

## 1.3.0 — 2026-09

### Novidades

**Ordens de serviço e cadastros**
- **Equipamentos**: inventário de aparelhos por cliente, com histórico de OS de cada um.
  Ao salvar uma OS, o equipamento é vinculado (ou cadastrado) automaticamente; OS antigas
  foram migradas.
- **Histórico de status da OS** com data e usuário, em linha do tempo.
- **Notas por item da OS**, exibidas no recibo de saída.
- **Custo e margem** em produtos/serviços; o relatório de Lucratividade mostra custo, lucro
  e margem (o custo fica gravado no item no momento da venda).
- Estoque atual e mínimo direto no cadastro do produto.
- **Aviso ao cliente**: e-mail automático nos status escolhidos e botão de WhatsApp com
  mensagem pronta; mensagens por status editáveis.
- Dados da empresa (CNPJ, telefone, e-mail, site, endereço) e textos de condições e
  garantia editáveis nos PDFs.

**Nota fiscal**
- **Configurações > Nota fiscal**: aceite de responsabilidade, escolha do emissor
  (Registro manual, Notaas; Emissor Nacional em desenvolvimento), credenciais, dados fiscais
  e certificado digital A1.
- **Registro manual** da nota (NFS-e, NF-e, NFC-e) na OS finalizada, com PDF e XML.
- **Emissão de NFS-e pela Notaas** direto da OS (plano anual com renovação automática).

**Usuários e acesso**
- Novo perfil **Técnico** e **permissões configuráveis por perfil** (só OS atribuídas,
  cadastros, produtos, estoque, custo, exclusão, nota fiscal, Financeiro, Relatórios).
- Login aceita maiúsculas, espaços nas pontas e o e-mail cadastrado.

**Aparência**
- **Barra de título própria** com logo e nome da empresa; botões da janela no tema claro/escuro.
- Tela de login com logo, nome e mensagem configuráveis e "Desenvolvido por" + versão.
- Opção de usar a logo como ícone da janela e da barra de tarefas.

### Segurança
- Permissões verificadas no processo principal (não só na interface).
- Senhas do banco, do e-mail e credenciais fiscais **cifradas** no computador.
- Código de redefinição de senha com validade de 10 minutos e bloqueio após 5 tentativas.

### Instalação
- Em banco vazio, **as tabelas são criadas automaticamente** na configuração inicial (não é
  mais preciso rodar o `script.sql`).

### Correções
- Salvar Configurações não apaga mais a senha do SMTP.
- Queda de conexão com o banco não abre mais janela de erro.
- Layout em colunas corrigido em várias telas (início, financeiro, estoque, garantias,
  relatórios, clientes, configurações).

### Compatibilidade
- Bancos existentes são atualizados automaticamente ao abrir o app (novas colunas, tabelas
  `equipamentos`/`notas_fiscais`/`os_status_historico` e papel Técnico).
- Ao abrir pela primeira vez, as senhas salvas são convertidas para o formato cifrado. Uma
  versão anterior do app não consegue mais lê-las; nesse caso, refaça a configuração
  inicial com "Já tenho cadastro".

---

## 1.2.0

- Licenciamento v2 (chave de licença, teste grátis, transferência de computador), opção
  "Já tenho cadastro" na configuração inicial e links para a área do cliente.
