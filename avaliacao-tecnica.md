# Avaliação Técnica — GSTI App

> Documento gerado na sprint de otimização — Maio/2026

---

## 1. Motor Electron — Diagnóstico e Recomendação

### Versão atual
| Item | Valor |
|------|-------|
| Electron | 31.7.7 (Mid-2024) |
| Node.js embutido | 20.x |
| Builder | electron-builder 26.0.12 |

### Veredicto: **Manter o Electron**

Trocar para Tauri ou NW.js não é recomendado neste momento:
- Tauri exige reescrita do backend em Rust — custo muito alto
- O app já tem IPC bem estruturado e segurança correta (contextIsolation, sandbox)
- Electron 31 tem suporte ativo e boa performance para apps de uso interno

### Problemas identificados e correções aplicadas

| Problema | Impacto | Correção |
|----------|---------|----------|
| Sem `minWidth`/`minHeight` | Janela pode ser reduzida até inutilizável | `minWidth: 1024, minHeight: 680` |
| `backgroundThrottling` padrão | Lentidão quando app está minimizado | `backgroundThrottling: false` |
| Sem `minWidth` na janela | UI quebrada em telas muito pequenas | Resolvido com limite mínimo |

### Configuração `createWindow` pós-correção

```js
new BrowserWindow({
  width: 1280,
  height: 800,
  minWidth: 1024,
  minHeight: 680,
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    devTools: !app.isPackaged,
    backgroundThrottling: false,
  },
})
```

### Pontos de segurança (todos OK)
- ✅ `contextIsolation: true` (default Electron 12+)
- ✅ `nodeIntegration: false` (default)
- ✅ `sandbox: true` (default Electron 20+)
- ✅ DevTools bloqueados em produção
- ✅ API exposta via `contextBridge` (preload.js)

---

## 2. Responsividade — Diagnóstico e Correções

### Escopo do problema

O app foi construído com alturas e larguras fixas em pixels, funcionando bem apenas em monitores 1920×1080. Abaixo do diagnóstico completo:

### 2.1 DataGrids — Altura fixa de 500px

**Problema:** Todos os 10 DataGrids usavam `height: 500` fixo.
- Em monitores 1366×768: grid ocupa 65% da altura disponível, deixando pouco espaço
- Em monitores 4K/2K: grid fica pequeno comparado ao espaço disponível

**Correção aplicada:**
```jsx
// Antes
<Box sx={{ height: 500, width: "100%" }}>

// Depois — cresce com a janela, nunca vai abaixo de 320px
<Box sx={{ height: 'calc(100vh - 240px)', minHeight: 320, width: "100%" }}>
```

**Componentes corrigidos:** OSGrid, CustomerGrid, ProductServiceGrid, ExpensesGrid, MiscRevenueGrid, OSReportClient, OSReportStatus, MostUsedServicesReport, EquipmentHistoryReport, DetailedRevenueReport, UserManagement

### 2.2 Modais — Largura fixa

**Problema:** Modais com larguras de 400–600px fixos não respeitam viewports menores.

**Correção aplicada:**
```js
// Antes: width: 600 (OSGrid), 400 (demais), 500 (Expenses)
// Depois: objeto responsivo MUI (funciona dentro de sx)
width: { xs: '95vw', sm: '90vw', md: 640 }  // OSGrid
width: { xs: '95vw', sm: 480 }               // CustomerGrid, ProductGrid, etc
width: { xs: '95vw', sm: 560 }               // ExpensesGrid
```

Removido também `border: "2px solid #000"` dos modais (resquício de debug, substituído pela boxShadow existente).

### 2.3 Formulário de OS

Linhas com múltiplos campos `display: flex` sem quebra. Adicionado `flexWrap: 'wrap'` para que os campos empilhem em telas menores.

### 2.4 Sidebar

A sidebar de 240px é permanente e não colapsa. Em conjunto com o `minWidth: 1024` da janela, isso garante que a sidebar sempre tenha espaço adequado. Sidebar colapsável está no roadmap.

### Dimensões recomendadas de uso

| Resolução | Status |
|-----------|--------|
| 1024×680 | Mínimo suportado (janela não pode ser menor) |
| 1280×800 | Tamanho padrão ao abrir |
| 1366×768 | Funcional, DataGrids se ajustam |
| 1920×1080 | Ideal |
| 2560×1440 | Excelente, todo o espaço é aproveitado |

---

## 3. Scrollbars Temáticas

**Problema:** As scrollbars do sistema operacional (cinza padrão) quebravam a estética em dark mode.

**Correção:** `GlobalStyles` do MUI injetado dentro do `ThemeProvider` — as scrollbars passam a usar cores do tema Chromium/Webkit (funciona no Electron).

```jsx
<GlobalStyles styles={(theme) => ({
  '*::-webkit-scrollbar': { width: 8, height: 8 },
  '*::-webkit-scrollbar-track': { background: theme.palette.background.default },
  '*::-webkit-scrollbar-thumb': {
    background: theme.palette.mode === 'light' ? '#cbd5e1' : '#1e293b',
    borderRadius: 4,
  },
  '*::-webkit-scrollbar-thumb:hover': {
    background: theme.palette.mode === 'light' ? '#94a3b8' : '#334155',
  },
})} />
```

| Modo | Track | Thumb | Thumb hover |
|------|-------|-------|-------------|
| Light | `#f1f5f9` | `#cbd5e1` | `#94a3b8` |
| Dark  | `#0a1120` | `#1e293b` | `#334155` |

---

## 4. Novos Módulos Propostos

### Prioridade Alta

#### 🏠 Home Dashboard (KPIs na tela inicial)
- OS abertas, em andamento e finalizadas no mês
- Receita e despesa do mês corrente (mini cards)
- Alertas de OS com garantia vencendo em 7 dias
- Últimas 5 OS abertas com link direto

#### 💾 Backup e Restauração
- Exportar banco via `pg_dump` para arquivo `.sql`
- Importar via `pg_restore` / `psql`
- Botão na tela de Configurações (admin only)
- Confirmação com dialog antes de restaurar

#### 🛡️ Painel de Garantias
- Lista de OS com status "Entregue" e garantia ativa
- Dias restantes de garantia por OS
- Alertas visuais: verde (>30 dias), amarelo (7–30 dias), vermelho (<7 dias)
- Filtro por cliente ou por vencimento

---

### Prioridade Média

#### 📅 Agenda de OS
- Calendário mensal com OS agrupadas por data de entrega prevista
- Drag-and-drop para reagendar
- Integração com campo `data_prevista` (novo campo na tabela `ordens_servico`)

#### 📋 Timeline do Cliente
- Dentro da tela de clientes, aba "Histórico"
- Lista de todas as OS do cliente em ordem cronológica
- Totais gastos, OS abertas, OS finalizadas

#### 📄 PDF com Logo da Empresa
- Incluir `companyName`, `logoData` (Base64) e dados de contato no cabeçalho dos PDFs de OS
- Configurável na tela de Configurações

#### 📮 CEP Auto-fill
- No cadastro de cliente, campo CEP com botão "Buscar"
- Chamada à API ViaCEP (`https://viacep.com.br/ws/{cep}/json/`)
- Preenche: logradouro, bairro, cidade, UF

---

### Prioridade Baixa / Futuro

#### 📧 Notificações por E-mail
- Envio automático quando OS muda para "Finalizado" ou "Entregue"
- Template HTML com dados da OS e resumo do serviço
- Configurar SMTP na tela de Configurações

#### 📦 Controle de Estoque
- Novo módulo para gerenciar peças em estoque
- Entrada manual e saída automática ao fechar uma OS
- Alerta quando estoque mínimo é atingido
- Integração com `produtos_servicos` (campo `estoque_atual`)

#### 📊 Lucratividade por Serviço
- Relatório de quais serviços geram mais receita e maior margem
- Cross-referência com `os_itens` e `produtos_servicos`

#### ☰ Sidebar Colapsável
- Botão hambúrguer para recolher sidebar a 60px (só ícones)
- Estado salvo no localStorage
- Ganha 180px de espaço horizontal para grids

---

## 5. Roadmap de Implementação

```
Sprint 1 (atual)  — Performance, Responsividade, Scrollbars ✅
Sprint 2          — Home Dashboard + Painel de Garantias
Sprint 3          — Backup/Restauração + CEP Auto-fill + PDF com Logo
Sprint 4          — Timeline do Cliente + Agenda de OS
Sprint 5+         — Estoque, Notificações, Sidebar Colapsável
```

---

## 6. Dívida Técnica Registrada

| Item | Tipo | Prioridade |
|------|------|-----------|
| Sidebar fixa (não colapsa) | UX | Baixa |
| Sem timeout em queries PostgreSQL | Robustez | Média |
| Geração de PDF síncrona (bloqueia main process) | Performance | Média |
| Sem testes automatizados | Qualidade | Alta |
| Bundle JS > 1.3MB (sem code splitting) | Performance | Baixa |
| `alert()` ainda presente em CustomerForm e OSForm | UX | Baixa |
