# GSTI - Gestor de Serviços de TI (v1.2)

Este projeto é um aplicativo de desktop multiplataforma (Windows, macOS, Linux) para gestão de serviços de manutenção de computadores, desenvolvido com Electron e React.

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

### Frontend (Processo de Renderização - React)
* **[React](https://react.dev/):** Biblioteca para construção da interface de usuário.
* **[Vite](https://vitejs.dev/):** Ferramenta de build para o ambiente de desenvolvimento do frontend.
* **[MUI (Material-UI)](https://mui.com/):** Biblioteca de componentes React para o design visual.
    * `@mui/material`
    * `@mui/x-data-grid`
    * `@mui/icons-material`
* **[react-imask](https://www.npmjs.com/package/react-imask):** Biblioteca para aplicar máscaras de formatação em campos de texto (CPF, CNPJ, Telefone).

---

## 📂 Estrutura do Projeto (Simplificada)

* `/` (Raiz): Contém os arquivos de configuração do Electron (`main.js`, `preload.js`), do projeto (`package.json`) e o script SQL principal (`script.sql`).
* `/renderer`: Contém todo o código da interface do usuário (frontend) desenvolvido em React (`src/`).

---

## ✅ Módulos Concluídos (v1.2)

### 1. **Gestão de Clientes (CRUD Completo)**
* [X] Listagem de clientes (`DataGrid`).
* [X] Adição, Edição e Exclusão de clientes (Pessoa Física e Jurídica).
* [X] Formulário com campos de dados completos (CPF/CNPJ, Nome/Razão Social, Telefone, Email, Endereço).
* [X] Máscaras de formatação (CPF, CNPJ, Telefone).
* [X] Validação de CNPJ via API externa (BrasilAPI) com preenchimento automático (Opcional, se implementado).

### 2. **Gestão de Produtos e Serviços (CRUD Completo)**
* [X] Listagem de produtos e serviços (`DataGrid`).
* [X] Adição, Edição e Exclusão de itens (Descrição, Valor, Tipo - Produto/Serviço).
* [X] Formulário em modal para gerenciamento.

### 3. **Gestão de Ordens de Serviço (OS)**
* [X] Listagem de Ordens de Serviço (`DataGrid`) com dados do cliente e equipamento.
* [X] **Adição de Nova OS:**
    * Seleção de cliente existente.
    * Cadastro de detalhes do equipamento (Tipo, Marca, Modelo, Nº Série).
    * Registro de Defeito Relatado e Observações.
    * Definição de Status inicial ('Orçamento' como padrão).
    * Seleção de Data de Entrada.
    * Adição/Remoção de múltiplos Produtos/Serviços (com Quantidade).
    * Cálculo automático do Valor Total.
* [X] **Edição de OS Existente:**
    * Alteração de todos os campos (exceto cliente).
    * Adição/Remoção/Alteração de Quantidade de itens.
    * Campos para Laudo Técnico e Solução Aplicada (visíveis em status avançados).
    * Campo para Dias de Garantia (visível em status finais).
    * Recálculo do Valor Total.
* [X] **Exclusão de OS.**
* [X] **Busca de OS:** Filtragem da lista por nome do cliente.
* [X] **Regra de Garantia:** Impede a edição de OS 'Entregue' após o vencimento da garantia. Define `data_saida` automaticamente ao marcar como 'Entregue'.
* [X] **Geração de PDF (Comprovante de Entrada):**
    * Documento em 2 vias (Empresa/Cliente).
    * Inclui dados completos do cliente (com formatação CPF/CNPJ/Telefone).
    * Inclui detalhes do equipamento e defeito.
    * Inclui Termos de Serviço focados em Orçamento (baseado no CDC).
    * Opção de salvar e abrir o PDF gerado.
* [X] **Geração de PDF (Recibo de Saída / Garantia):**
    * Aparece para OS 'Finalizado' ou 'Entregue'.
    * Inclui dados completos do cliente (formatados).
    * Inclui detalhes do serviço (Laudo, Solução).
    * Lista detalhada dos Itens utilizados (Descrição, Qtd, Vlr. Unit., Subtotal) com layout ajustado e quebra de página.
    * Exibe Valor Total.
    * Calcula e exibe o período e data de expiração da Garantia.
    * Inclui texto resumido da garantia e espaço para assinatura.
    * Opção de salvar e abrir o PDF gerado.

---

## 🔜 Próximos Passos (Planejamento)

* **Módulo Financeiro (Fase 3):**
    * Implementar CRUD para a tabela `despesas`.
    * Criar tela de Despesas com formulário (incluindo cálculo de combustível).
    * Criar Dashboard Financeiro (Receitas x Despesas).
* **Relatórios (Fase 4):**
    * Relatórios de OS por período, cliente, status.
    * Relatórios financeiros.