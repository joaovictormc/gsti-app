# GSTI App — Roadmap e Pendências

Documento único de planejamento: o que já foi entregue, o que está na fila e as
decisões técnicas pendentes. Substitui o antigo `refinos-futuros.md`.
Atualizado em 2026-09-16.

---

## 1. Entregue

### Financeiro
- [x] Fluxo de caixa detalhado (receitas de OS, receitas avulsas e despesas por data).
- [x] Gráficos de despesas por categoria e de receitas por fonte.
- [x] Relatório detalhado de despesas e exportação Excel com abas-resumo.
- [x] Projeção financeira simplificada (lucro líquido mensal projetado).
- [x] Metas financeiras múltiplas com tempo estimado.

### Ordens de serviço
- [x] Relatório de OS abertas por tempo.
- [x] Busca avançada (nº da OS, cliente, telefone, equipamento, série, atendente).
- [x] Atendente responsável e relatório por atendente.
- [x] **Notas por item da OS**, exibidas no recibo de saída.
- [x] **Histórico de status** com data e usuário, em linha do tempo dentro da OS.
- [x] **Dados da empresa nos PDFs** (CNPJ/CPF, telefone, e-mail, site, endereço) e
      condições de serviço / termo de garantia editáveis em Configurações.
- [x] **Aviso ao cliente sobre o andamento**: e-mail automático nos status escolhidos
      e botão de WhatsApp com mensagem pronta (envio manual, sem API paga);
      mensagens por status editáveis.

### Cadastros
- [x] Controle de estoque com baixa automática ao finalizar a OS.
- [x] Busca de endereço por CEP.
- [x] **Quantidade e estoque mínimo direto no cadastro do produto.**
- [x] **Custo em produtos/serviços**, com margem na lista e lucro/margem no relatório
      de lucratividade (o custo fica gravado no item da OS no momento da venda).
- [x] **Módulo de Equipamentos**: inventário por cliente, histórico de OS por aparelho.
- [x] **OS vinculada ao equipamento**: escolha de aparelho do cliente ou cadastro
      automático ao salvar; OS antigas migradas automaticamente.

### Usuários, whitelabel e licenciamento
- [x] Permissões do perfil Funcionário para Financeiro e Relatórios.
- [x] Notificações por e-mail (nova OS para o técnico, OS finalizada para o cliente).
- [x] Imagem de fundo e logo na tela de login.
- [x] **Personalização da marca reorganizada**: nome, logo (com prévia), fundo do login e
      mensagem do login em blocos com rótulos explícitos; opção separada para usar a logo
      como ícone da janela/barra de tarefas (o atalho e o instalador mantêm o ícone do app).
- [x] **Logo e nome da empresa na tela de login** e no título da janela.
- [x] **"Desenvolvido por"** no rodapé do login, com a versão do app; nome editável e
      pode ser ocultado (padrão: desenvolvedor original).
- [x] Licenciamento v2 com chave de licença, trial, transferência de computador.
- [x] Plataforma de vendas (site, Mercado Pago, área do cliente, painel da equipe) —
      ver [PLANO-LICENCIAMENTO-E-VENDAS.md](./PLANO-LICENCIAMENTO-E-VENDAS.md).

### Segurança
- [x] **Permissões checadas no processo principal** (`controle-acesso.js`): cada canal IPC
      declara quem pode chamá-lo (Admin, Financeiro, Relatórios, usuário logado, público);
      a sessão fica no processo principal e o histórico da OS usa o usuário da sessão.
- [x] Tela inicial sem receita/despesas/lucro para quem não tem acesso ao Financeiro.
- [x] Não é possível excluir/rebaixar o próprio usuário nem ficar sem nenhum Admin.
- [x] **Senhas do banco e do e-mail cifradas no `config.json`** (cofre do Windows via
      `safeStorage`; configurações antigas são migradas ao abrir o app). A chave fica no
      arquivo `Local State` da pasta de dados do app: se ele se perder, o app pede a
      conexão de novo ("Já tenho cadastro").
- [x] Salvar Configurações não apaga mais a senha do SMTP (campo em branco = manter).
- [x] Conexão ociosa derrubada pelo servidor do banco não abre mais janela de erro.
- [x] **Tabelas criadas automaticamente** na primeira instalação em banco vazio.
- [x] Código de redefinição de senha: validade corrigida (10 min) e bloqueio após 5 erros.

---

## 2. Fila — próximas funcionalidades

- **Emissão de NFS-e / NF-e após finalizar a OS** — botão nas OS finalizadas;
  avaliar APIs de prefeitura/SEFAZ ou emissores de terceiros.
- **Barra de título personalizada (frameless window)** — barra em React com ícone e
  nome configuráveis, botões de janela no tema do sistema e sem os menus padrão do
  Electron. Requer `frame: false`/`titleBarStyle: 'hidden'`, drag region e controles
  via IPC.
- **Aviso automático também pelo WhatsApp** — hoje o botão abre a conversa com a
  mensagem pronta. Envio automático exige API paga (WhatsApp Business Cloud API,
  Z-API, Twilio); reavaliar se houver demanda.

---

## 3. Módulo de assistência e diagnóstico (projeto separado)

Ideia original: ferramenta própria para o técnico diagnosticar computadores,
notebooks e celulares — drivers, limpeza e otimização, testes de rede/disco/memória/
CPU, e no celular (via USB ou QR code) diagnóstico, limpeza e detecção de vírus.

Recomendação: tratar como **produto à parte** (repositório próprio), começando por
um recorte viável:

1. **MVP — laudo técnico no Windows**: agente leve que coleta hardware, saúde do
   disco (SMART), bateria, memória, temperatura e rede, gera um laudo e o **anexa à
   OS** no GSTI App.
2. **Depois**: testes de estresse opcionais, comparativo antes/depois do reparo.
3. **Pontos com barreiras a estudar antes de prometer**:
   - Drivers: não há API gratuita confiável; há questões de licenciamento de
     distribuição.
   - Antivírus em celular: exige motor e base de assinaturas atualizada — caro de
     manter; considerar integração com soluções existentes.
   - Limpeza/otimização altera o sistema do cliente: risco de responsabilidade para a
     assistência; exigir confirmação e registro na OS.

---

## 4. Modelo de papéis e acesso

Com o sistema vendido por instância (cada cliente é dono do próprio app + banco):

- **O comprador (cliente) deve ter acesso Admin total** da sua instância.
- Adicionar um papel **Técnico/Operador**, distinto do atual `Funcionario`, voltado
  à operação (OS, clientes, estoque), sem acesso a configurações sensíveis.
- Reavaliar a granularidade atual (`Admin` x `Funcionario` + `canSeeFinancial` /
  `canSeeReports`).
- O ENUM `user_role_enum ('Admin', 'Funcionario')` precisará de migração, além de
  ajustes em Gerenciar Usuários e nos controles de acesso (`App.jsx`).

---

## 5. Dívida técnica e segurança

- **DevTools/console em produção** → `window.api` acessível pelo console; manter
  DevTools desligado no build (hoje: `devTools: !app.isPackaged`).
- **`main.js` monolítico** (~4.000 linhas) → continuar extraindo módulos por domínio
  (já extraídos: `license-manager.js`, `os-comunicacao.js`, `controle-acesso.js`,
  `config-segredos.js`).
- **`asar: false`** no build → código legível na instalação; avaliar `asar` com
  `asarUnpack` para o `pdf-worker.js`.
- **Backup com banco em servidor remoto** → `pg_dump` agendado no servidor,
  snapshots do provedor ou exportação disparada pelo app.
- **Testes automatizados no repositório** → as consultas novas foram validadas em
  PostgreSQL temporário durante o desenvolvimento; levar esses testes para o projeto
  (ex.: `npm test` com banco efêmero).

---

## 6. Notas de manutenção (licenças)

- Chaves de assinatura geradas no servidor com `node gerar-chaves.js`; a chave
  pública vai em `publicKeys` no **`license-config.js`** (homologação e produção
  usam chaves diferentes).
- Backup de `license-server/data/` (chaves, banco e `config.key`).
- `serverUrl` de produção com **HTTPS** no `license-config.js`.
- Guia completo: [`license-server/README.md`](../license-server/README.md).
