# GSTI - Gestor de Serviços de TI (v1.2 - Gráficos em Andamento)

Este projeto é um aplicativo de desktop multiplatforma (Windows, macOS, Linux) para gestão de serviços de manutenção de computadores, desenvolvido com Electron e React.

---

## 📋 Requisitos Mínimos de Sistema

Para garantir o bom funcionamento do GSTI App, recomendamos a seguinte configuração mínima:

* **Sistema Operacional:**
    * Windows 10 (64 bits) ou superior
    * macOS 10.15 (Catalina) ou superior
    * Linux (Distribuições baseadas em Debian/Ubuntu LTS recomendadas, 64 bits)
* **Processador:** Processador Dual-Core de 1.5 GHz ou superior
* **Memória RAM:** 4 GB de RAM (8 GB recomendados)
* **Espaço em Disco:** 500 MB de espaço livre (para instalação)
* **Banco de Dados:** Servidor MySQL v5.7+ (configurado separadamente)
* **Conexão com a Internet:** Para validação de CNPJ e recuperação de senha.
* **Resolução de Tela:** 1280x768 ou superior.

---


## 🚀 Como Rodar o Projeto

1.  **Pré-requisitos:**
    * [Node.js](https://nodejs.org/) (versão LTS)
    * Um servidor MySQL em execução.

2.  **Configuração do Banco de Dados:**
    * Crie um banco de dados chamado `gsti_db` (preferencialmente com `CHARACTER SET utf8mb4` e `COLLATE utf8mb4_unicode_ci`).
    * Crie um usuário com permissões completas para este banco.
    * Execute o arquivo `script.sql` (localizado na raiz ou em `/database_migrations`) para criar a estrutura completa das tabelas.
    * **Importante:** Configure as credenciais do banco (host, user, password, database) no arquivo `main.js`.

3.  **Instalação das Dependências:**
    * Clone o repositório e, no terminal, dentro da pasta raiz do projeto (`gsti-app`), execute:
        ```bash
        npm install
        ```

4.  **Execução em Modo de Desenvolvimento:**
    * Após a instalação, execute o seguinte comando para iniciar a aplicação:
        ```bash
        npm run dev
        ```
    * Isso iniciará o servidor de desenvolvimento do Vite e a aplicação Electron simultaneamente.

---

## 🛠️ Tecnologias e Dependências Principais

### Backend (Processo Principal - Electron)
* **[Electron.js](https://www.electronjs.org/):** Framework principal para a criação do aplicativo desktop.
* **[Node.js](https://nodejs.org/):** Ambiente de execução do backend.
* **[mysql2](https://www.npmjs.com/package/mysql2):** Driver de conexão com o banco de dados MySQL (com suporte a Promises).
* **[pdfkit](https://pdfkit.org/):** Biblioteca para geração de documentos PDF no backend.
* **[exceljs](https://www.npmjs.com/package/exceljs):** Biblioteca para criação de arquivos Excel (.xlsx).
* **[bcrypt](https://www.npmjs.com/package/bcrypt):** Biblioteca para hashing de senhas.
* **[nodemailer](https://nodemailer.com/):** Biblioteca para envio de e-mails.

### Frontend (Processo de Renderização - React)
* **[React](https://react.dev/):** Biblioteca para construção da interface de usuário.
* **[Vite](https://vitejs.dev/):** Ferramenta de build para o ambiente de desenvolvimento do frontend.
* **[MUI (Material-UI)](https://mui.com/):** Biblioteca de componentes React para o design visual.
    * `@mui/material`
    * `@mui/x-data-grid`
    * `@mui/icons-material`
* **[react-imask](https://www.npmjs.com/package/react-imask):** Biblioteca para aplicar máscaras de formatação em campos de texto (CPF, CNPJ, Telefone).
* **[react-chartjs-2](https://react-chartjs-2.js.org/):** Componentes React para a biblioteca Chart.js.
* **[Chart.js](https://www.chartjs.org/):** Biblioteca para criação de gráficos interativos.


### Build e Empacotamento
* **[electron-builder](https://www.electron.build/):** Ferramenta para empacotar e construir instaladores/executáveis Electron para Windows, macOS e Linux.
---

## 📂 Estrutura do Projeto (Simplificada)

* `/` (Raiz): Contém os arquivos de configuração do Electron (`main.js`, `preload.js`), do projeto (`package.json`) e o script SQL principal (`script.sql`).
* `/renderer`: Contém todo o código da interface do usuário (frontend) desenvolvido em React (`src/`).

---

## ✅ Módulos Concluídos (v1.2)

### 1. **Gestão de Clientes (CRUD Completo)**
* [X] Listagem, Adição, Edição, Exclusão.
* [X] Formulário completo com máscaras e validação CNPJ (opcional).

### 2. **Gestão de Produtos e Serviços (CRUD Completo)**
* [X] Listagem, Adição, Edição, Exclusão.

### 3. **Gestão de Ordens de Serviço (OS)**
* [X] Listagem, Adição, Edição, Exclusão.
* [X] Busca por nome do cliente.
* [X] Detalhes do equipamento estruturados.
* [X] Adição/Edição de múltiplos itens com quantidade.
* [X] Cálculo de valor total.
* [X] Campos de Laudo e Solução.
* [X] Regra de Garantia (bloqueio pós-vencimento).
* [X] Geração de PDF: Comprovante de Entrada (com Termos de Orçamento).
* [X] Geração de PDF: Recibo de Saída / Garantia (com cálculo de expiração).

### 4. **Módulo Financeiro (Básico)**
* [X] **Gestão de Despesas (CRUD Completo):**
    * Listagem, Adição, Edição, Exclusão.
    * Cálculo automático para combustível.
    * Classificação Fixa/Variável.
* [X] **Gestão de Receitas Avulsas (CRUD Completo):**
    * Listagem, Adição, Edição, Exclusão.
* [X] **Resumo Financeiro:**
    * Seleção de período (datas + botões pré-definidos).
    * Exibição em cards: Receita Total (OS + Avulsas), Despesa Fixa, Despesa Variável, Despesa Total, Lucro Líquido.

---

## 🔜 Próximos Passos (Planejamento)

* **Refinamento Módulo Financeiro:**
    * Adicionar Gráficos comparativos (Receita x Despesa Mensal/Anual).
    * Implementar Exportação para Excel.
    * (Opcional) Fluxo de Caixa Detalhado.
* **Fase 4 (Relatórios):**
    * Relatórios de OS por cliente, status, etc.
* **(Avançado/Futuro):**
    * Provisões/Projeções Financeiras.
    * Cálculo de tempo para investimentos.
    * Lucratividade por OS.