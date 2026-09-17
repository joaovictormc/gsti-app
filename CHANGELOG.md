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

### Compatibilidade
- Licenças já emitidas e tokens antigos continuam com todos os módulos.
- Ofertas existentes passam a vender só a base até os módulos serem marcados no painel.

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
