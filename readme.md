# GSTI - Gestor de Serviços de TI (v1.1)

Este projeto é um aplicativo de desktop multiplataforma (Windows, macOS, Linux) para gestão de serviços de manutenção de computadores, desenvolvido com Electron e React.

---

## 🚀 Como Rodar o Projeto

1.  **Pré-requisitos:**
    * [Node.js](https://nodejs.org/) (versão LTS)
    * Um servidor MySQL em execução.

2.  **Configuração do Banco de Dados:**
    * Crie um banco de dados chamado `gsti_db`.
    * Crie um usuário com permissões para este banco.
    * Execute os scripts da pasta `database_migrations` em ordem para criar a estrutura das tabelas.

3.  **Instalação das Dependências:**
    * Clone o repositório e, no terminal, dentro da pasta raiz do projeto (`gsti-project`), execute:
        ```bash
        npm install
        ```

4.  **Execução em Modo de Desenvolvimento:**
    * Após a instalação, execute o seguinte comando para iniciar a aplicação:
        ```bash
        npm start
        ```
    * Isso iniciará o servidor de desenvolvimento do Vite e a aplicação Electron simultaneamente.

---

## 🛠️ Tecnologias e Dependências Principais

### Backend (Processo Principal - Electron)
* **[Electron.js](https://www.electronjs.org/):** Framework principal para a criação do aplicativo desktop.
* **[Node.js](https://nodejs.org/):** Ambiente de execução do backend.
* **[mysql2](https://www.npmjs.com/package/mysql2):** Driver de conexão com o banco de dados MySQL.
* **[axios](https://www.npmjs.com/package/axios):** Cliente HTTP para fazer chamadas a APIs externas (ex: BrasilAPI).

### Frontend (Processo de Renderização - React)
* **[React](https://react.dev/):** Biblioteca para construção da interface de usuário.
* **[Vite](https://vitejs.dev/):** Ferramenta de build para o ambiente de desenvolvimento do frontend.
* **[MUI (Material-UI)](https://mui.com/):** Biblioteca de componentes React para o design visual.
    * `@mui/material`
    * `@mui/x-data-grid`
* **[react-imask](https://www.npmjs.com/package/react-imask):** Biblioteca para aplicar máscaras de formatação em campos de texto (CPF, CNPJ, Telefone).

---

## 📂 Estrutura do Projeto

* `/` (Raiz): Contém os arquivos de configuração do Electron (`main.js`, `preload.js`) e do projeto (`package.json`).
* `/renderer`: Contém todo o código da interface do usuário (frontend) desenvolvido em React.
* `/database_migrations`: Contém os scripts SQL versionados para criar e atualizar a estrutura do banco de dados.

---

## ✅ Módulos Concluídos

### 1. **Gestão de Clientes (CRUD Completo)**
* [X] Listagem de clientes em uma tabela profissional (`DataGrid`).
* [X] Conexão com o banco de dados MySQL para buscar e listar clientes.
* [X] Funcionalidade de adicionar novos clientes (Pessoa Física e Jurídica).
* [X] Formulário em modal com campos para CPF/CNPJ, Nome/Razão Social, Telefone, Email e Endereço.
* [X] Máscaras de formatação automática para os campos CPF, CNPJ e Telefone.
* [X] Validação de CNPJ via API externa (BrasilAPI) com preenchimento automático de Nome e Endereço.