# GSTI App — Roadmap e Pendências

Documento único de planejamento: o que já foi entregue, o que está na fila e as
decisões técnicas pendentes. Substitui o antigo `refinos-futuros.md`.
Atualizado em 2026-09-17. Versão atual do app: **1.3.0**; **1.4.0 em desenvolvimento** (ver [CHANGELOG](../CHANGELOG.md)).

> Contexto: nada foi vendido ainda. O lançamento será feito **por módulos** — primeiro os
> iniciais, depois os avançados (seção 2). A **preparação para produção** é a última etapa,
> depois das funcionalidades (seção 8).

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
- [x] **Barra de título própria**: logo e nome da empresa, arrastável, sem o menu padrão
      do Electron; minimizar/maximizar/fechar nativos (Snap Layouts no Windows 11) nas
      cores do tema claro/escuro. Atalhos mantidos: Ctrl +/−/0 (zoom) e, em
      desenvolvimento, F12 e Ctrl+R. Telas usam `var(--gsti-vh)` no lugar de `100vh`.
- [x] Licenciamento v2 com chave de licença, trial, transferência de computador.
- [x] Plataforma de vendas (site, Mercado Pago, área do cliente, painel da equipe) —
      ver [PLANO-LICENCIAMENTO-E-VENDAS.md](./PLANO-LICENCIAMENTO-E-VENDAS.md).

### Nota fiscal
- [x] **Configurações > Nota fiscal**: quadro "Como funciona" com aceite registrado (o
      cliente é responsável por credenciais, certificado e dados fiscais), catálogo de
      emissores com filtro de gratuitos, credenciais por emissor (segredos cifrados e nunca
      devolvidos à tela), dados fiscais da empresa e **certificado digital A1** (.pfx:
      valida senha, chave privada e validade; mostra titular, CNPJ/CPF e vencimento; fica
      cifrado só neste computador).
- [x] **Registro manual de nota na OS finalizada** (NFS-e, NF-e, NFC-e): número, série,
      data, valor, chave, PDF e XML guardados no banco; marcar como cancelada; OS com nota
      não pode ser excluída; permissão "Registrar e emitir nota fiscal" por perfil.
- [x] **Emissão de NFS-e pela Notaas** direto da OS finalizada: pré-visualização com
      pendências (CPF/CNPJ do cliente, código de tributação, alíquota, chave), descrição e
      valor editáveis, acompanhamento da situação (processando, emitida, rejeitada com o
      motivo, cancelando, cancelada), PDF/XML baixados para o banco, cancelamento no emissor,
      bloqueio de NFS-e duplicada e "Testar conexão" nas credenciais.
- [x] **Emissor integrado liberado por plano**: recurso `emissorFiscal` no token só com
      assinatura anual ativa (renovação automática) ou licença cortesia.

### Versão 1.4.0 (em desenvolvimento)
- [x] **Venda por módulos**: módulos por oferta, por licença e do teste no painel; app
      esconde/bloqueia o que não foi contratado; área do cliente mostra os módulos.
- [x] **Atualização automática do app** pelo servidor de licenças (só licenças válidas),
      com aviso, notas da versão e seção em Configurações.
- [x] **Suporte (helpdesk)**: /suporte no site, chamados no painel, acompanhamento por link
      e na área do cliente, e-mails e botão **Suporte** no app com dados técnicos e captura.
- [x] **Catálogo de emissores de nota fiscal** no site (/emissores, guias gerados do mesmo
      catálogo do app) e **pedidos de novos emissores** pela área do cliente e pelo app, com
      ranking, situação, nota pública e aviso por e-mail no painel.
- [x] Legendas dos gráficos do Resumo Financeiro não cortam mais nomes longos.
- [x] **Módulo Diagnóstico (MVP)**: agente portátil GSTI Diagnóstico (hardware, sistema,
      SMART, bateria, temperaturas, eventos, testes rápidos), laudo com alertas e PDF, envio à
      OS pela rede local ou arquivo, comparativo antes/depois e download do agente pelo app e
      pela área do cliente. Ver [diagnostico/README.md](../diagnostico/README.md).
- [x] **Diagnóstico multiplataforma e otimização**: coleta no Windows, macOS e Linux, agentes
      para os três sistemas (CI no GitHub Actions), otimização autorizada e registrada no laudo,
      scripts próprios da assistência.

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
- [x] **Testes automatizados** no repositório: `npm test` (unitários) e
      `npm run test:e2e` (app Electron com banco temporário) — ver [tests/README.md](../tests/README.md).
- [x] Layout em colunas corrigido nas telas antigas (Grid do MUI 7).
- [x] **Perfil Técnico e permissões por perfil** (Configurações > Permissões por perfil):
      para Funcionário e Técnico, liga/desliga "Só OS atribuídas", editar clientes e
      equipamentos, editar produtos, ajustar estoque, ver custo e margem, excluir
      registros, Financeiro e Relatórios. Tudo verificado no processo principal; a
      interface esconde botões e colunas sem permissão. Funcionário mantém o
      comportamento anterior por padrão; Técnico começa restrito às OS dele.

---

## 2. Versão 1.4.0 — preparar o lançamento por módulos

Objetivo: deixar o produto pronto para começar a vender só os módulos iniciais e liberar
os avançados depois, sem gerar uma build diferente para cada plano.

1. ~~**Módulos por plano (licença por módulos)**~~ — **entregue** (ver
   [CHANGELOG](../CHANGELOG.md)): módulos por oferta, por licença e do teste no painel;
   app esconde/bloqueia o que não foi contratado (processo principal e interface); área do
   cliente mostra os módulos. Detalhes em [license-server/README.md](../license-server/README.md#venda-por-módulos).
2. ~~**Atualização automática do app**~~ — **entregue**: electron-updater servido pelo
   próprio servidor de licenças (`/atualizacoes/win`, só para licenças válidas), download em
   segundo plano, aviso com notas da versão (geradas do CHANGELOG) e seção em Configurações.
   Publicação: `node admin.js publicar-atualizacao dist_electron`. Ver
   [license-server/README.md](../license-server/README.md#atualizações-do-app).
3. ~~**Suporte e helpdesk básico**~~ — **entregue**: página /suporte no site (com anexos),
   chamados no painel (responsável, prioridade, situação, notas internas), acompanhamento
   pelo link do e-mail e na área do cliente, avisos por e-mail e botão **Suporte** no app com
   dados técnicos e captura da tela. Ver [license-server/README.md](../license-server/README.md#suporte).
   *Pendente para depois:* suporte diferenciado por plano (prioridade/prazo) e respostas
   prontas.
4. **Prontidão para produção** — movida para a **etapa final** (seção 8), depois das
   funcionalidades.

### Divisão de módulos (implementada; ajustável por oferta no painel)

| Iniciais (lançamento) | Avançados (depois) |
|---|---|
| Clientes e Equipamentos | Financeiro completo (fluxo de caixa, projeção, metas, Excel) |
| Produtos/Serviços | Relatórios |
| Ordens de serviço, PDFs, WhatsApp manual | Estoque com baixa automática e alertas |
| Agenda e Garantias | Perfis e permissões avançadas (Técnico) |
| Nota fiscal — registro manual | Nota fiscal integrada (Notaas / Emissor Nacional) |
| Usuários (Admin e Funcionário) | Personalização da marca (whitelabel) |
| Backup manual | Notificações automáticas por e-mail e backup automático |

---

## 3. Fila — próximas funcionalidades

- **Emissores de nota fiscal integrados** — estrutura, registro manual, certificado A1,
  liberação por plano e **Notaas (NFS-e)** entregues (ver seção 1). Catálogo definido:
  Registro manual, Notaas e Emissor Nacional. Próximos: validar a Notaas com projeto em
  Homologação e certificado real; Emissor Nacional direto; NF-e/NFC-e pela Notaas. Detalhes em
  [PESQUISA-NOTA-FISCAL.md](./PESQUISA-NOTA-FISCAL.md).
- ~~**Portal do cliente: catálogo de emissores**~~ — **entregue** (seção 1, versão 1.4.0).
- **Aviso automático também pelo WhatsApp** — hoje o botão abre a conversa com a
  mensagem pronta. Envio automático exige API paga (WhatsApp Business Cloud API,
  Z-API, Twilio); reavaliar se houver demanda.
- ~~**Página de suporte e helpdesk básico**~~ — **entregue** (seção 1, versão 1.4.0).
- ~~**Legendas dos gráficos do Resumo Financeiro**~~ — **corrigido**.
- **Suporte por plano** (prioridade/prazo diferente) e **respostas prontas** no painel.

> Itens que dependem de ação externa: validar a Notaas com certificado real, Emissor
> Nacional direto (quando houver certificado A1) e WhatsApp automático (se houver demanda).
> Módulo de assistência e diagnóstico: MVP entregue (seção 4).

---

## 4. Módulo de assistência e diagnóstico

**MVP entregue** como módulo vendável do próprio GSTI App (decisão: agente portátil no mesmo
repositório, laudo anexado à OS por rede local ou arquivo) — ver
[diagnostico/README.md](../diagnostico/README.md).

Entregue também: coleta no **macOS e Linux**, **otimização** com registro e **scripts da
assistência**.

**Em decisão — drivers pós-formatação.** Estratégia proposta: o backup é **rede de segurança**,
não a fonte principal; a formatação termina sempre com a versão **mais nova disponível**:
1. **Inventário na entrada**: cada driver de terceiros com dispositivo, fabricante, versão,
   data e hardware ID (Get-PnpDevice/Win32_PnPSignedDriver + pci.ids), e dispositivos sem
   driver (código 28) — tudo no laudo.
2. **Backup de segurança** (`pnputil /export-driver`) só dos drivers de terceiros, com
   manifesto de versão/data; marca como "antigo" o que tiver mais de 2–3 anos.
3. **Pós-formatação em camadas**: (a) só o essencial do backup para ter rede (placa de rede e
   Wi-Fi), mesmo que antigo; (b) **Windows Update** (drivers assinados e mais novos); (c)
   ferramenta do **fabricante** quando detectada (Dell Command | Update, Lenovo System
   Update/Thin Installer, HP Image Assistant; Intel DSA/AMD/NVIDIA para vídeo); (d) do backup,
   só o que continuar faltando, comparando versões para **nunca rebaixar** um driver.
4. **Laudo de saída**: driver a driver, versão antes × depois, origem (Windows Update,
   fabricante, backup) e o que ficou pendente.
5. Repositório de drivers da assistência (pasta no pen drive/servidor da loja) com os mais
   recentes por hardware ID, usado antes do backup do cliente.
Linux: `ubuntu-drivers` e `fwupdmgr`; macOS: não se aplica.

Próximos passos possíveis: laudo também no recibo de saída da OS, histórico de laudos por
equipamento, testes de estresse opcionais (CPU/memória), assinatura digital do agente e
diagnóstico de celulares.

### Estudo original

Ideia original: ferramenta própria para o técnico diagnosticar computadores,
notebooks e celulares — drivers, limpeza e otimização, testes de rede/disco/memória/
CPU, e no celular (via USB ou QR code) diagnóstico, limpeza e detecção de vírus.

Recomendação: tratar como **produto à parte** (repositório próprio), começando por
um recorte viável:

1. ~~**MVP — laudo técnico no Windows**~~ — **entregue**: agente leve que coleta hardware,
   saúde do disco (SMART), bateria, memória, temperatura e rede, gera um laudo e o **anexa à
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

## 5. Modelo de papéis e acesso

Com o sistema vendido por instância (cada cliente é dono do próprio app + banco):

- **O comprador (cliente) deve ter acesso Admin total** da sua instância.
- Papéis: **Admin**, **Funcionário** e **Técnico**. Admin tem acesso total; Funcionário e
  Técnico seguem a tabela em Configurações > Permissões por perfil (ver seção 1).
- Possível evolução: permissões por usuário (exceções) além das do perfil.

---

## 6. Dívida técnica e segurança

- **Assinatura digital do instalador** (certificado de assinatura de código) → sem ela o
  Windows SmartScreen alerta "editor desconhecido" ao instalar; necessário antes das vendas.
- **`main.js` monolítico** (~4.000 linhas) → continuar extraindo módulos por domínio
  (já extraídos: `license-manager.js`, `os-comunicacao.js`, `controle-acesso.js`,
  `config-segredos.js`).
- **`asar: false`** no build → código legível na instalação; avaliar `asar` com
  `asarUnpack` para o `pdf-worker.js`.
- **Backup com banco em servidor remoto** → `pg_dump` agendado no servidor,
  snapshots do provedor ou exportação disparada pelo app.

---

## 7. Notas de manutenção (licenças)

- Chaves de assinatura geradas no servidor com `node gerar-chaves.js`; a chave
  pública vai em `publicKeys` no **`license-config.js`** (homologação e produção
  usam chaves diferentes).
- Backup de `license-server/data/` (chaves, banco e `config.key`).
- `serverUrl` de produção com **HTTPS** no `license-config.js`.
- Guia completo: [`license-server/README.md`](../license-server/README.md).

---

## 8. Etapa final — preparação para produção

Feita por último, depois das funcionalidades:

- [ ] Domínio novo do produto (sem vínculo com o domínio atual) e e-mails do domínio.
- [ ] VPS com HTTPS (Nginx + certbot), serviço systemd e backup diário de `data/`.
- [ ] Chaves de licença de **produção** no `license-config.js` e `serverUrl` HTTPS.
- [ ] Mercado Pago em produção, SMTP real e **compra real de baixo valor** testada (e reembolsada).
- [ ] **Assinatura digital do instalador** e do agente GSTI Diagnóstico (certificado de assinatura de código).
- [ ] Publicar o agente GSTI Diagnóstico no servidor de produção (Windows, macOS e Linux).
- [ ] Assinar e notarizar o agente de macOS (Apple Developer) para abrir sem aviso do Gatekeeper.
- [ ] Primeira publicação da atualização automática no servidor de produção.
