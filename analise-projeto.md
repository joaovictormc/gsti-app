# Análise do Projeto GSTI App — Problemas, Melhorias e Próximos Passos

> Gerado em: 2026-05-29  
> Versão analisada: v1.2 (branch `main`)

---

## 1. Contexto Resumido

O GSTI App é uma aplicação Electron + React + MySQL para gestão de ordens de serviço de TI. O backend roda no processo principal do Electron (`main.js` com 2 843 linhas), o frontend é um app React/Vite servido localmente, e a comunicação entre eles passa por IPC via `preload.js`. O banco de dados é MySQL remoto/local, acessado pela lib `mysql2`.

---

## 2. Problemas Identificados

### 2.1 Arquitetura e Desempenho do Electron

| Prioridade | Problema | Impacto |
|---|---|---|
| Alta | `main.js` monolítico com 2 843 linhas e ~150 handlers IPC num único arquivo | Difícil manutenção, tudo em memória ao mesmo tempo |
| Alta | Electron carrega Chromium completo mesmo para uma UI simples | Alto uso de RAM (~200–300 MB mínimo) |
| Alta | Sem lazy loading de módulos pesados (`pdfkit`, `exceljs`, `bcrypt`) — todos importados no topo do arquivo | Aumenta o tempo de inicialização |
| Média | Pool MySQL configurado com `waitForConnections: true` e `queueLimit: 0` (fila ilimitada) sem timeout | Requisições podem ficar presas indefinidamente se o DB cair |
| Média | Sem cache de resultado para queries de listagem (ex: clientes, produtos) que raramente mudam | Queries desnecessárias ao banco a cada abertura de modal |
| Baixa | `console.log` espalhado por todo `main.js` sem sistema de logging estruturado | Poluição de saída em produção |

### 2.2 Segurança

| Prioridade | Problema |
|---|---|
| Alta | Credenciais do banco de dados salvas em texto puro em `userData/config.json` — qualquer app no sistema pode ler |
| Alta | TODO marcado no código: nenhuma verificação server-side de que o usuário é Admin antes de executar handlers de gerenciamento de usuários (`get-users`, `add-user`, `delete-user`) — qualquer usuário autenticado pode chamar diretamente via DevTools |
| Alta | Sem validação de força de senha (aceita qualquer string como senha) |
| Média | `contextIsolation: true` está correto, mas `devTools` não está desabilitado em produção — usuário pode abrir o console e chamar `window.api` diretamente |
| Média | Logo salva como Base64 no config — arquivo pode crescer indefinidamente sem limite de tamanho |
| Baixa | Token de reset de senha é de 6 dígitos numéricos (10⁶ combinações), relativamente fácil de brutar sem rate limiting |

### 2.3 Qualidade de Código

| Área | Problema |
|---|---|
| `main.js` | Sem separação de responsabilidades — regras de negócio, acesso a banco e geração de PDF misturados |
| `OSGrid.jsx` | Recarrega lista completa de OS após qualquer CRUD (sem paginação server-side) — pode ser lento com volume alto |
| `App.jsx` | Carrega branding via IPC a cada login, mas não invalida se o config mudar durante a sessão |
| Geral | Sem testes automatizados de nenhum tipo (unit, integration, e2e) |
| Geral | Dois `package.json` (`/` e `/renderer`) — scripts de dev precisam rodar dois processos manualmente; não há hot-reload integrado entre main e renderer |
| `preload.js` | Expõe `window.api` com mais de 80 métodos sem agrupamento — dificulta descoberta e aumenta superfície de ataque |

### 2.4 UX / Interface

| Problema |
|---|
| Nenhum feedback de loading em operações longas (ex: gerar PDF, exportar Excel) — interface parece travada |
| Campos de formulário sem validação em tempo real — erros aparecem só no submit |
| Sem paginação ou scroll virtual no DataGrid para grandes volumes de dados |
| Sem atalhos de teclado para ações comuns (nova OS, nova despesa) |
| Sem modo offline com aviso claro — o app simplesmente falha silenciosamente se o MySQL não estiver acessível |

---

## 3. Melhorias Técnicas (Quick Wins)

### 3.1 Reduzir Pegada do Electron (Prioridade Alta)

A forma mais eficiente de reduzir consumo sem trocar de framework:

```
1. Dividir main.js em módulos:
   handlers/
     auth.js       → login, usuários, reset senha
     customers.js  → CRUD clientes
     orders.js     → CRUD OS + IPC de itens
     financial.js  → despesas, receitas, sumários
     reports.js    → relatórios
     pdf.js        → geração de PDF
     settings.js   → config, email, logo
   
2. Lazy require dos módulos pesados:
   // Antes: import pdfkit from 'pdfkit' no topo
   // Depois:
   ipcMain.handle('generate-pdf', async () => {
     const PDFDocument = require('pdfkit') // carrega só quando necessário
     ...
   })

3. Desabilitar DevTools em produção:
   if (!app.isPackaged) { win.webContents.openDevTools() }

4. Limitar queueLimit do pool MySQL:
   queueLimit: 50, connectionTimeout: 10000
```

### 3.2 Criptografar Configuração Local

Usar `safeStorage` nativo do Electron (AES-256 via credenciais do SO):

```javascript
// Salvar
const encrypted = safeStorage.encryptString(JSON.stringify(config))
fs.writeFileSync(configPath, encrypted)

// Ler
const raw = fs.readFileSync(configPath)
const config = JSON.parse(safeStorage.decryptString(raw))
```

Sem dependência externa, sem overhead, seguro contra acesso de outros processos.

### 3.3 Verificação de Role no Backend

Passar o ID do usuário logado em cada IPC sensível e verificar no handler:

```javascript
// preload.js — adicionar userId automaticamente
ipcRenderer.invoke('get-users', { requesterId: sessionStorage.getItem('userId') })

// main.js — verificar antes de executar
ipcMain.handle('get-users', async (_, { requesterId }) => {
  const [user] = await dbPool.query('SELECT role FROM usuarios WHERE id = ?', [requesterId])
  if (user[0]?.role !== 'Admin') return { success: false, error: 'Acesso negado' }
  ...
})
```

### 3.4 Loading States no Frontend

Adicionar estado `isLoading` nos componentes com operações pesadas e mostrar `CircularProgress` do MUI durante a espera. Especialmente em: geração de PDF, exportação Excel, carregamento inicial de grids.

### 3.5 Paginação Server-Side nas Grids

Para OSGrid e CustomerGrid, adicionar paginação no backend com `LIMIT` e `OFFSET`, e usar `paginationMode="server"` no MUI DataGrid. Isso resolve performance com volumes maiores que 500 registros.

---

## 4. Novas Funcionalidades

> Organizadas por módulo e esforço estimado.

### 4.1 Módulo de Equipamentos (Esforço: Médio)

A tabela `equipamentos` já existe no banco mas não é usada pela UI. Criar:
- Tela de cadastro de equipamentos vinculados a clientes
- Histórico de OS por equipamento (já existe o report por serial, só falta UI dedicada)
- Campo de vinculação ao criar OS (selecionar equipamento do cliente ao invés de digitar manualmente)

### 4.2 Controle de Estoque de Produtos (Esforço: Médio)

Adicionar à tabela `produtos_servicos`:
- Campo `estoque_atual` (integer)
- Campo `estoque_minimo` (integer)
- Baixa automática ao fechar OS com itens do tipo "Produto"
- Alerta visual quando estoque ≤ mínimo (badge no menu lateral)

### 4.3 Módulo Financeiro — Fase 3 (Esforço: Médio)

Funcionalidades do `refinos-futuros.md`:
- **Fluxo de Caixa detalhado**: tabela com entradas/saídas dia a dia no período selecionado
- **Gráfico de pizza** de despesas por categoria (já tem os dados, falta o componente)
- **Relatório de despesas em Excel** (modelo similar ao `export-financial-report` já existente)
- **Múltiplas metas de investimento** — atualmente só suporta uma meta no `InvestmentGoal`

### 4.4 Permissões Granulares por Role (Esforço: Alto)

Atualmente há apenas "Admin" e "Funcionario". Implementar:
- Funcionário não vê módulos Financeiro e Relatórios (já mapeado no `refinos-futuros.md`)
- Tabela `permissoes` com flags por módulo por role
- UI de gerenciamento de permissões na tela de Usuários

### 4.5 Notificações por Email (Esforço: Baixo)

O nodemailer já está configurado. Adicionar opção de enviar email ao cliente quando:
- OS é criada (recibo de entrada)
- OS é finalizada (aviso de conclusão com valor)

Toggle na tela de configurações: "Enviar email ao cliente automaticamente".

### 4.6 Busca Avançada de OS (Esforço: Baixo)

Handler `search-os-by-serial` já existe no backend. Adicionar na OSGrid:
- Campo de busca por número de série
- Filtro por período (data_entrada range)
- Filtro por status (já tem, melhorar UX)

### 4.7 Consulta de CEP (Esforço: Baixo)

Ao digitar CEP no formulário de cliente, consultar `viacep.com.br` e preencher endereço automaticamente. Mesmo padrão da validação de CNPJ via brasilapi que já existe.

### 4.8 Customização do PDF (Esforço: Médio)

- Logo da empresa no cabeçalho do PDF (o campo `logoPath` já existe no config)
- Telefone e endereço da empresa no rodapé
- Opção de escolher quais cláusulas de garantia aparecem

### 4.9 Backup e Restauração (Esforço: Alto)

- Exportar dump do banco MySQL para arquivo `.sql` local via `mysqldump` chamado como child_process
- Importar dump via UI com confirmação
- Agendar backup automático semanal em `userData/backups/`

### 4.10 Histórico de Status da OS (Esforço: Médio)

Criar tabela `os_historico_status` (id, id_os, status_anterior, status_novo, usuario_id, data_alteracao). Registrar automaticamente ao fazer `update-os`. Exibir linha do tempo na UI de detalhes da OS.

---

## 5. Por Onde Continuar

### Sprint Recomendado (Ordem de Execução)

```
Fase 1 — Fundação (Estabilidade e Segurança)
  [1] Dividir main.js em módulos (handlers/)
  [2] Criptografar config.json com safeStorage
  [3] Adicionar verificação de role nos handlers admin
  [4] Desabilitar DevTools em produção
  [5] Loading states nos componentes principais

Fase 2 — Features Prontas para Uso (Baixo Esforço, Alto Valor)
  [6] Consulta de CEP no formulário de cliente
  [7] Busca avançada de OS (período + serial)
  [8] Logo no PDF de OS
  [9] Email automático ao cliente ao finalizar OS

Fase 3 — Módulos Novos
  [10] Vincular OS a equipamento (usar tabela existente)
  [11] Estoque de produtos com baixa automática
  [12] Fluxo de caixa detalhado + gráfico de pizza de despesas

Fase 4 — Governança e Escala
  [13] Permissões granulares por role
  [14] Histórico de status da OS
  [15] Backup e restauração via UI
```

### Decisão Estratégica: Manter Electron ou Migrar?

O Electron é pesado por design (Chromium + Node.js empacotados). As alternativas principais são:

| Alternativa | Ganho de Performance | Esforço de Migração | Manter MySQL? |
|---|---|---|---|
| **Tauri** (Rust + WebView nativo) | ~70% menos RAM, ~80% menor em disco | Alto — reescrever backend em Rust | Sim (via plugin) |
| **Electron + otimizações** (caminho atual) | 20–30% menos RAM com lazy loading | Baixo | Sim |
| **NW.js** | Similar ao Electron | Médio | Sim |

**Recomendação**: Se o objetivo é lançar em produção no curto prazo, focar nas otimizações do Electron (Fase 1). Se houver tempo de refatoração, avaliar Tauri como meta de longo prazo — o frontend React pode ser reutilizado quase integralmente, apenas o backend (main.js) precisaria ser reescrito.

---

## 6. Débitos Técnicos Rápidos

Estes podem ser resolvidos em menos de 1 hora cada:

- [ ] Adicionar `connectionTimeout: 10000` e `queueLimit: 50` no pool MySQL
- [ ] Remover todos os `console.log` de produção ou condicioná-los a `app.isPackaged`
- [ ] Adicionar `webPreferences: { devTools: !app.isPackaged }` no BrowserWindow
- [ ] Validar tamanho da imagem de logo antes de salvar em Base64 (limite de 2 MB)
- [ ] Adicionar `encodeURIComponent` nos parâmetros de busca antes de passar para SQL LIKE
- [ ] Confirmar que `delete-os` verifica se há financeiro vinculado antes de deletar
- [ ] Adicionar rate limiting no handler de `handle-forgot-password` (máx 3 tentativas/hora por email)

---

*Documento gerado a partir de análise estática completa do código-fonte. Atualizar conforme o projeto evoluir.*
