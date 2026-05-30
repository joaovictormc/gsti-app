# Avaliação Técnica — GSTI App

> Documento gerado na sprint de otimização — Maio/2026  
> Última atualização: Maio/2026 (após Sprint 5)

---

## 1. Motor Electron — Diagnóstico e Recomendação

### Versão atual
| Item | Valor |
|------|-------|
| Electron | 31.7.7 (Mid-2024) |
| Node.js embutido | 20.x |
| Builder | electron-builder 26.0.12 |

### Veredicto: **Manter o Electron** ✅

Trocar para Tauri ou NW.js não é recomendado neste momento:
- Tauri exige reescrita do backend em Rust — custo muito alto
- O app já tem IPC bem estruturado e segurança correta (contextIsolation, sandbox)
- Electron 31 tem suporte ativo e boa performance para apps de uso interno

### Correções aplicadas ✅
| Problema | Correção |
|----------|----------|
| Sem `minWidth`/`minHeight` | `minWidth: 1024, minHeight: 680` |
| `backgroundThrottling` padrão | `backgroundThrottling: false` |

### Pontos de segurança (todos OK) ✅
- ✅ `contextIsolation: true` · `nodeIntegration: false` · `sandbox: true`
- ✅ DevTools bloqueados em produção (`devTools: !app.isPackaged`)
- ✅ API exposta via `contextBridge` (preload.js)

---

## 2. Responsividade — Diagnóstico e Correções ✅

Todas as correções foram aplicadas:

| Item | Status | Detalhe |
|------|--------|---------|
| DataGrids `height: 500` fixo | ✅ Corrigido | `calc(100vh - 240px)` + `minHeight: 320` em 11 componentes |
| Modais com largura fixa | ✅ Corrigido | Objetos responsivos MUI `{ xs: '95vw', sm: N }` em 6 modais |
| Borders de debug nos modais | ✅ Removido | `border: "2px solid #000"` eliminado |
| OSForm flex sem wrap | ✅ Corrigido | `flexWrap: 'wrap'` nas rows de múltiplos campos |
| Sidebar permanente e fixa | ✅ Corrigido | Sidebar colapsável implementada no Sprint 5 |

### Dimensões suportadas
| Resolução | Status |
|-----------|--------|
| 1024×680 | Mínimo suportado |
| 1280×800 | Padrão ao abrir |
| 1366×768 | Funcional |
| 1920×1080 | Ideal |
| 2560×1440 | Excelente |

---

## 3. Scrollbars Temáticas ✅

`GlobalStyles` MUI com `::-webkit-scrollbar` — cores do tema aplicadas automaticamente em light e dark mode.

---

## 4. Módulos Implementados

### Sprint 1 ✅ — Base técnica
- ✅ Performance Electron (minWidth, minHeight, backgroundThrottling)
- ✅ Responsividade (DataGrids, modais, forms)
- ✅ Scrollbars temáticas
- ✅ Tema MUI customizado (Inter, indigo/cyan, dark mode consistente)
- ✅ Sidebar com dark theme e avatar do usuário

### Sprint 2 ✅ — Módulos core
- ✅ **Home Dashboard** — saudação dinâmica, 4 KPI cards, painel de garantias vencendo, últimas OS ativas
- ✅ **Painel de Garantias** — grid com dias restantes, chips coloridos, filtros por urgência e busca

### Sprint 3 ✅ — Integrações e documentos
- ✅ **Backup e Restauração** — pg_dump/psql com detecção automática do PostgreSQL, dialog de arquivo
- ✅ **CEP Auto-fill** — ViaCEP no cadastro de clientes, IMaskInput `00000-000`, preenchimento automático
- ✅ **PDF com Logo** — `drawPdfHeader()` lê `appConfig.branding`, logo à esquerda, nome + título à direita

### Sprint 4 ✅ — Histórico e agenda
- ✅ **Timeline do Cliente** — Dialog com 3 stat cards + lista cronológica de OS com bordas coloridas por status
- ✅ **Agenda de OS** — Campo `data_prevista` no formulário, calendário mensal, chips por dia, painel de detalhes

### Sprint 5 ✅ — UX, estoque e relatórios
- ✅ **Sidebar Colapsável** — 60px/240px com transição, Tooltips, estado no localStorage
- ✅ **Controle de Estoque** — `estoque_atual` + `estoque_minimo` em produtos, entrada/saída/ajuste de mínimo, alertas visuais
- ✅ **Lucratividade por Serviço** — cross com `os_itens`, gráfico Top 5, DataGrid com receita destacada

---

## 5. Roadmap Atualizado

```
Sprint 1  ✅  Performance, Responsividade, Scrollbars, Tema visual
Sprint 2  ✅  Home Dashboard + Painel de Garantias
Sprint 3  ✅  Backup/Restauração + CEP Auto-fill + PDF com Logo
Sprint 4  ✅  Timeline do Cliente + Agenda de OS
Sprint 5  ✅  Sidebar Colapsável + Controle de Estoque + Lucratividade
Sprint 6  🔲  Notificações por E-mail + melhorias pontuais (a definir)
```

---

## 6. Pendências e Dívida Técnica

| Item | Tipo | Prioridade | Status |
|------|------|-----------|--------|
| Notificações por e-mail ao finalizar OS | Feature | Média | 🔲 Pendente |
| Saída automática de estoque ao fechar OS | Feature | Média | 🔲 Pendente |
| Drag-and-drop na Agenda de OS | UX | Baixa | 🔲 Pendente |
| Sem timeout em queries PostgreSQL | Robustez | Média | 🔲 Pendente |
| Geração de PDF síncrona (bloqueia main process) | Performance | Média | 🔲 Pendente |
| Sem testes automatizados | Qualidade | Alta | 🔲 Pendente |
| Bundle JS > 1.3MB (sem code splitting) | Performance | Baixa | 🔲 Pendente |
| `alert()` ainda presente em OSForm (validações) | UX | Baixa | 🔲 Pendente |
| Sidebar fixa (não colapsa) | UX | —— | ✅ Resolvido |

---

## 7. Arquitetura Atual do Sistema

```
gsti-app/
├── main.js              — Processo principal Electron (IPC, DB, PDFs, backups)
├── preload.js           — contextBridge: ~70 métodos expostos ao renderer
├── script.sql           — Schema PostgreSQL (referência para novas instalações)
├── renderer/
│   └── src/
│       ├── App.jsx              — Tema MUI, sidebar colapsável, roteamento por componente
│       ├── contexts/
│       │   └── AuthContext.jsx  — Autenticação global
│       ├── screens/             — Telas principais
│       │   ├── HomeScreen.jsx        ✅ Dashboard com KPIs
│       │   ├── LoginScreen.jsx       ✅ Gradiente dark
│       │   ├── WarrantyPanel.jsx     ✅ Painel de garantias
│       │   ├── OSAgenda.jsx          ✅ Calendário mensal
│       │   ├── StockControl.jsx      ✅ Controle de estoque
│       │   ├── ProfitabilityReport.jsx ✅ Lucratividade
│       │   └── InitialSetupScreen.jsx
│       └── components/          — Grids e formulários
│           ├── OSGrid.jsx / OSForm.jsx
│           ├── CustomerGrid.jsx / CustomerForm.jsx
│           ├── ProductServiceGrid.jsx
│           ├── ExpensesGrid.jsx / MiscRevenueGrid.jsx
│           ├── UserManagement.jsx / SettingsScreen.jsx
│           ├── ConfirmDialog.jsx
│           └── FinancialPages/
│               ├── FinancialDashboard.jsx
│               ├── SummaryCards.jsx / MonthlyChart.jsx
│               ├── AnnualChart.jsx / PeriodSelector.jsx
│               └── InvestmentGoal.jsx
```
