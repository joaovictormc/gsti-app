const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const path = require("path");
const mysql = require("mysql2");
const axios = require("axios");
const fs = require("fs");
const PDFDocument = require("pdfkit");

const isDev = process.env.NODE_ENV !== "production";

// Configuração da Pool de Conexão com o MySQL
// Lembre-se de usar os dados que você configurou (usuário e senha do BD)
const dbPool = mysql
  .createPool({
    host: "192.168.100.4", // ou o IP do seu servidor caseiro
    user: "gsit_app",
    password: "gstiapp", // <<-- SUA SENHA AQUI
    database: "gsti_db",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  })
  .promise(); // Usar a versão com Promises para código mais limpo

// --- FUNÇÕES DE FORMATAÇÃO (Definidas globalmente no módulo) ---
const formatDocument = (doc) => {
  if (doc === null || doc === undefined) return "";
  const cleaned = String(doc).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  if (cleaned.length === 14)
    return cleaned.replace(
      /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
      "$1.$2.$3/$4-$5"
    );
  return String(doc);
};

const formatPhone = (phone) => {
  if (phone === null || phone === undefined) return "";
  const cleaned = String(phone).replace(/\D/g, "");
  if (cleaned.length === 11)
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (cleaned.length === 10)
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return String(phone);
};
// --- FIM DAS FUNÇÕES DE FORMATAÇÃO ---

// Listener para buscar os clientes
ipcMain.handle("get-customers", async () => {
  try {
    const [rows] = await dbPool.query("SELECT * FROM clientes");
    return rows;
  } catch (error) {
    console.error(error);
    return []; // Retorna um array vazio em caso de erro
  }
});

// Listener para adicionar um novo cliente
ipcMain.handle("add-customer", async (event, customerData) => {
  // Agora pegamos os novos campos do objeto recebido
  const { nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } =
    customerData;
  const sql =
    "INSERT INTO clientes (nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco) VALUES (?, ?, ?, ?, ?, ?)";

  try {
    // Passamos os novos campos como parâmetros na ordem correta
    const [result] = await dbPool.query(sql, [
      nome,
      tipo_pessoa,
      cpf_cnpj,
      telefone,
      email,
      endereco,
    ]);
    return { success: true, id: result.insertId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Listener para validar APENAS CNPJ
ipcMain.handle("validate-cnpj", async (event, cnpj) => {
  const docNumber = cnpj.replace(/\D/g, "");
  if (docNumber.length !== 14) {
    return { success: false, error: "CNPJ deve ter 14 dígitos." };
  }

  const apiUrl = `https://brasilapi.com.br/api/cnpj/v1/${docNumber}`;

  try {
    const response = await axios.get(apiUrl);
    const name = response.data.razao_social;
    return { success: true, name: name, data: response.data };
  } catch (error) {
    return { success: false, error: "CNPJ não encontrado ou inválido." };
  }
});

ipcMain.handle("update-customer", async (event, customerData) => {
  const { id, nome, tipo_pessoa, cpf_cnpj, telefone, email, endereco } =
    customerData;
  const sql =
    "UPDATE clientes SET nome = ?, tipo_pessoa = ?, cpf_cnpj = ?, telefone = ?, email = ?, endereco = ? WHERE id = ?";

  try {
    await dbPool.query(sql, [
      nome,
      tipo_pessoa,
      cpf_cnpj,
      telefone,
      email,
      endereco,
      id,
    ]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar cliente:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR um cliente
ipcMain.handle("delete-customer", async (event, customerId) => {
  const sql = "DELETE FROM clientes WHERE id = ?";

  try {
    await dbPool.query(sql, [customerId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar cliente:", error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar todos os produtos e serviços
ipcMain.handle("get-products", async () => {
  try {
    const [rows] = await dbPool.query("SELECT * FROM produtos_servicos");
    return rows;
  } catch (error) {
    console.error("Erro ao buscar produtos/serviços:", error);
    return [];
  }
});

// Listener para adicionar um novo produto/serviço
ipcMain.handle("add-product", async (event, productData) => {
  const { descricao, valor, tipo } = productData;
  const sql =
    "INSERT INTO produtos_servicos (descricao, valor, tipo) VALUES (?, ?, ?)";
  try {
    const [result] = await dbPool.query(sql, [descricao, valor, tipo]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error("Erro ao adicionar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR um produto/serviço existente
ipcMain.handle("update-product", async (event, productData) => {
  const { id, descricao, valor, tipo } = productData;
  const sql =
    "UPDATE produtos_servicos SET descricao = ?, valor = ?, tipo = ? WHERE id = ?";

  try {
    await dbPool.query(sql, [descricao, valor, tipo, id]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR um produto/serviço
ipcMain.handle("delete-product", async (event, productId) => {
  const sql = "DELETE FROM produtos_servicos WHERE id = ?";

  try {
    await dbPool.query(sql, [productId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar produto/serviço:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("get-os-list", async () => {
  const sql = `
    SELECT 
      os.id, 
      -- Concatena os novos campos para exibição no grid
      CONCAT(os.tipo_equipamento, ' ', os.marca, ' ', os.modelo) AS equipamento, 
      os.status, os.data_entrada, os.valor_total,
      c.nome AS nome_cliente 
    FROM ordens_servico AS os
    JOIN clientes AS c ON os.id_cliente = c.id
    ORDER BY os.id DESC`;
  try {
    const [rows] = await dbPool.query(sql);
    return rows;
  } catch (error) {
    return [];
  }
});

ipcMain.handle("get-active-data", async () => {
  try {
    const [customers] = await dbPool.query(
      "SELECT id, nome FROM clientes ORDER BY nome ASC"
    );
    const [products] = await dbPool.query(
      "SELECT id, descricao, valor, tipo FROM produtos_servicos ORDER BY descricao ASC"
    );
    return { success: true, customers, products };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- CORREÇÃO DO BUG (get-os-details) ---
ipcMain.handle("get-os-details", async (event, osId) => {
  try {
    const [osRows] = await dbPool.query(
      "SELECT * FROM ordens_servico WHERE id = ?",
      [osId]
    );
    if (osRows.length === 0)
      return { success: false, error: "OS não encontrada." };

    // CORREÇÃO: Alterado de 'produtos_serviços' para 'produtos_servicos'
    const [itemRows] = await dbPool.query(
      `SELECT ps.id, ps.descricao, ps.valor, ps.tipo, oi.quantidade 
       FROM os_itens oi 
       JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id 
       WHERE oi.id_os = ?`,
      [osId]
    );

    return { success: true, os: osRows[0], items: itemRows };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-os", async (event, { osData, total }) => {
  // Atualizado para os novos campos
  const {
    id_cliente,
    tipo_equipamento,
    marca,
    modelo,
    numero_serie,
    defeito_relatado,
    observacoes_entrada,
    status,
    data_entrada,
    garantia_dias,
  } = osData;
  const sql = `INSERT INTO ordens_servico 
    (id_cliente, tipo_equipamento, marca, modelo, numero_serie, defeito_relatado, observacoes_entrada, status, data_entrada, valor_total, garantia_dias) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  try {
    const [result] = await dbPool.query(sql, [
      id_cliente,
      tipo_equipamento,
      marca,
      modelo,
      numero_serie,
      defeito_relatado,
      observacoes_entrada,
      status,
      data_entrada,
      total,
      garantia_dias,
    ]);
    return { success: true, osId: result.insertId };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os", async (event, { osData, total }) => {
  // Atualizado para os novos campos (incluindo laudo/solucao)
  const {
    id,
    id_cliente,
    tipo_equipamento,
    marca,
    modelo,
    numero_serie,
    defeito_relatado,
    observacoes_entrada,
    laudo_tecnico,
    solucao_aplicada,
    status,
    data_entrada,
    garantia_dias,
  } = osData;

  const connection = await dbPool.getConnection();
  try {
    const [rows] = await connection.query(
      "SELECT status, data_saida, garantia_dias FROM ordens_servico WHERE id = ?",
      [id]
    );
    const osAtual = rows[0];

    if (osAtual.status === "Entregue" && osAtual.data_saida) {
      const dataSaida = new Date(osAtual.data_saida);
      const dataExpiracaoGarantia = new Date(
        dataSaida.setDate(dataSaida.getDate() + osAtual.garantia_dias)
      );
      const hoje = new Date();
      if (hoje > dataExpiracaoGarantia) {
        throw new Error(
          "Esta OS está fora da garantia e não pode ser alterada."
        );
      }
    }

    let sqlDataSaida = "";
    if (status === "Entregue" && osAtual.status !== "Entregue") {
      sqlDataSaida = ", data_saida = NOW()";
    }

    const sql = `
      UPDATE ordens_servico SET 
      id_cliente = ?, tipo_equipamento = ?, marca = ?, modelo = ?, 
      numero_serie = ?, defeito_relatado = ?, observacoes_entrada = ?, 
      laudo_tecnico = ?, solucao_aplicada = ?, status = ?, 
      data_entrada = ?, valor_total = ?, garantia_dias = ?
      ${sqlDataSaida}
      WHERE id = ?`;

    await connection.query(sql, [
      id_cliente,
      tipo_equipamento,
      marca,
      modelo,
      numero_serie,
      defeito_relatado,
      observacoes_entrada,
      laudo_tecnico,
      solucao_aplicada,
      status,
      data_entrada,
      total,
      garantia_dias,
      id,
    ]);

    connection.release();
    return { success: true };
  } catch (error) {
    connection.release();
    return { success: false, error: error.message };
  }
});

ipcMain.handle("add-os-items", async (event, { osId, items }) => {
  if (items.length === 0) return { success: true };
  const sql =
    "INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario) VALUES ?";
  const values = items.map((item) => [
    osId,
    item.id,
    item.quantidade,
    item.valor,
  ]);
  try {
    await dbPool.query(sql, [values]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle("update-os-items", async (event, { osId, items }) => {
  const connection = await dbPool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query("DELETE FROM os_itens WHERE id_os = ?", [osId]);
    if (items.length > 0) {
      const sql =
        "INSERT INTO os_itens (id_os, id_produto_servico, quantidade, valor_unitario) VALUES ?";
      const values = items.map((item) => [
        osId,
        item.id,
        item.quantidade,
        item.valor,
      ]);
      await connection.query(sql, [values]);
    }
    await connection.commit();
    return { success: true };
  } catch (error) {
    await connection.rollback();
    return { success: false, error: error.message };
  } finally {
    connection.release();
  }
});

ipcMain.handle("delete-os", async (event, osId) => {
  try {
    await dbPool.query("DELETE FROM ordens_servico WHERE id = ?", [osId]);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- FUNÇÃO PDF ATUALIZADA ---
ipcMain.handle("generate-entry-receipt", async (event, osId) => {
  // 1. Buscar todos os dados necessários (SQL ATUALIZADO)
  const sql = `SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj, c.email AS email_cliente, c.endereco AS endereco_cliente FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id WHERE os.id = ?`;
  let osData;
  try {
    const [rows] = await dbPool.query(sql, [osId]);
    if (rows.length === 0) throw new Error("OS não encontrada.");
    osData = rows[0];
  } catch (error) {
    return { success: false, error: error.message };
  }

  // 2. Perguntar onde salvar o arquivo
  const { filePath } = await dialog.showSaveDialog({
    title: "Salvar Comprovante de Entrada",
    defaultPath: `os_entrada_${osId}.pdf`,
    filters: [{ name: "Arquivos PDF", extensions: ["pdf"] }],
  });

  if (!filePath) {
    return { success: false, error: "Usuário cancelou a gravação." };
  }

  // 3. Gerar o PDF
  try {
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Seus Termos de Serviço (do passo anterior)
    const termosDeServico = `
TERMOS PARA ORÇAMENTO E SERVIÇO (Baseado na Lei 8.078/90 - CDC)
1. ORÇAMENTO PRÉVIO (Art. 40, CDC): O presente documento registra o recebimento do equipamento para análise. O fornecedor é obrigado a entregar ao CLIENTE um orçamento prévio discriminando o valor da mão-de-obra, materiais, condições de pagamento e prazo de execução.
2. PRAZO DE ORÇAMENTO: O prazo para apresentação do orçamento é de até 5 (cinco) dias úteis. O orçamento apresentado terá validade de 10 (dez) dias, a contar do seu recebimento (aprovação) pelo CLIENTE.
3. AUTORIZAÇÃO DE SERVIÇO (Art. 39, CDC): Nenhum serviço será executado sem a autorização expressa e prévia do CLIENTE. Serviços executados sem autorização são equiparados a amostras grátis, não gerando ônus ao consumidor.
4. DADOS E SOFTWARE: O CLIENTE é o único responsável por realizar o backup prévio de seus dados (arquivos, fotos, etc.). A empresa não se responsabiliza por qualquer perda de dados.
5. ABANDONO DE EQUIPAMENTO: O CLIENTE deve retirar o equipamento em até 90 (noventa) dias após ser notificado da conclusão do serviço (ou da recusa do orçamento). Após este prazo, o equipamento será considerado abandonado, podendo a empresa tomar as medidas legais cabíveis para cobrir custos de serviço e armazenamento.
6. GARANTIA PÓS-SERVIÇO (Art. 26, CDC): Se o orçamento for aprovado e o serviço executado, a garantia legal para os serviços e peças é de 90 (noventa) dias a contar da data de efetiva entrega do equipamento. Esta garantia cobre exclusivamente o defeito solucionado e as peças substituídas, conforme descrito no laudo de saída.
`;

    // --- Função para desenhar o conteúdo (para as 2 vias) ---
    const drawReceipt = (isCliente) => {
      const via = isCliente ? "Via do Cliente" : "Via da Empresa";
      doc
        .fontSize(16)
        .text("Comprovante de Entrada de Equipamento", { align: "center" });
      doc.fontSize(10).text(via, { align: "right" });
      doc.fontSize(12).text(`OS Nº: ${osData.id}`, { align: "left" });
      doc.moveDown(1);

      // --- Dados do Cliente (ATUALIZADO) ---
      doc.fontSize(14).text("Dados do Cliente", { underline: true });
      doc.fontSize(10).text(`Nome: ${osData.nome_cliente}`);
      doc.text(
        `CPF/CNPJ: ${formatDocument(osData.cpf_cnpj) || "Não informado"}`
      );
      doc.text(
        `Telefone: ${formatPhone(osData.telefone_cliente) || "Não informado"}`
      );
      doc.text(`Email: ${osData.email_cliente || "Não informado"}`);
      doc.text(`Endereço: ${osData.endereco_cliente || "Não informado"}`);
      doc.moveDown(1);
      // --- FIM DA ATUALIZAÇÃO ---

      // Dados do Equipamento
      doc.fontSize(14).text("Dados do Equipamento", { underline: true });
      const dataEntrada = new Date(osData.data_entrada).toLocaleString(
        "pt-BR",
        {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );
      doc.fontSize(10).text(`Data de Entrada: ${dataEntrada}`);
      doc.text(`Tipo: ${osData.tipo_equipamento || "Não informado"}`);
      doc.text(`Marca: ${osData.marca || "Não informado"}`);
      doc.text(`Modelo: ${osData.modelo || "Não informado"}`);
      doc.text(`Nº de Série: ${osData.numero_serie || "Não informado"}`);
      doc.moveDown(0.5);
      doc.text(`Defeito Relatado: ${osData.defeito_relatado || "Nenhum"}`);
      doc.moveDown(0.5);
      doc.text(`Observações: ${osData.observacoes_entrada || "Nenhuma"}`);
      doc.moveDown(2);

      // Termos de Serviço
      doc
        .fontSize(12)
        .text("Termos de Serviço e Orçamento", { underline: true });
      doc.fontSize(8).text(termosDeServico, { align: "justify" });
      doc.moveDown(2);

      // Assinatura
      doc.fontSize(10);
      doc.text("___________________________________________", {
        align: "center",
      });
      doc.text("Assinatura do Cliente", { align: "center" });
      doc.text(
        "Declaro estar ciente e de acordo com os termos acima e das condições do equipamento descrito.",
        { align: "center", width: 450 }
      );
    };

    // --- Desenha as duas vias ---
    drawReceipt(false); // Via da Empresa
    doc
      .addPage()
      .fontSize(10)
      .text(
        "----------------------------------------------------------------------------------------------------------",
        { align: "center" }
      );
    doc.moveDown(2);
    drawReceipt(true); // Via do Cliente

    doc.end();

    // 4. Abrir o PDF após salvar
    stream.on("finish", () => {
      shell.openPath(filePath);
    });

    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- NOVA FUNÇÃO: GERAR PDF DE SAÍDA/GARANTIA ---
ipcMain.handle("generate-exit-receipt", async (event, osId) => {
  // 1. Buscar dados da OS, Cliente e Itens
  let osData, itemsData;
  try {
    const osSql = `
      SELECT os.*, c.nome AS nome_cliente, c.telefone AS telefone_cliente, c.cpf_cnpj,
             c.email AS email_cliente, c.endereco AS endereco_cliente
      FROM ordens_servico os JOIN clientes c ON os.id_cliente = c.id
      WHERE os.id = ?`;
    const [osRows] = await dbPool.query(osSql, [osId]);
    if (osRows.length === 0) throw new Error("OS não encontrada.");
    osData = osRows[0];

    // Verifica se a OS tem data de saída (necessária para garantia)
    if (!osData.data_saida) {
      // Define a data de saída como AGORA se ainda não tiver sido definida
      await dbPool.query(
        "UPDATE ordens_servico SET data_saida = NOW() WHERE id = ?",
        [osId]
      );
      // Busca novamente os dados para pegar a data_saida atualizada
      const [updatedOsRows] = await dbPool.query(osSql, [osId]);
      osData = updatedOsRows[0];
    }

    const itemsSql = `
      SELECT ps.descricao, oi.quantidade, oi.valor_unitario
      FROM os_itens oi JOIN produtos_servicos ps ON oi.id_produto_servico = ps.id
      WHERE oi.id_os = ?`;
    const [itemRows] = await dbPool.query(itemsSql, [osId]);
    itemsData = itemRows;
  } catch (error) {
    return { success: false, error: `Erro ao buscar dados: ${error.message}` };
  }

  // 2. Perguntar onde salvar
  const { filePath } = await dialog.showSaveDialog({
    title: "Salvar Recibo de Saída e Garantia",
    defaultPath: `os_saida_garantia_${osId}.pdf`,
    filters: [{ name: "Arquivos PDF", extensions: ["pdf"] }],
  });

  if (!filePath) return { success: false, error: "Usuário cancelou." };

  // 3. Gerar o PDF
  try {
    const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // --- Constantes de Layout ---
    const pageTopMargin = 50;
    const pageBottomMargin = 50;
    const contentWidth =
      doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const leftMargin = doc.page.margins.left;

    // --- Função para adicionar nova página se necessário ---
    const checkAddPage = (currentY, neededHeight) => {
      if (currentY + neededHeight > doc.page.height - pageBottomMargin) {
        doc.addPage();
        return pageTopMargin; // Retorna a nova posição Y inicial
      }
      return currentY; // Mantém a posição Y atual
    };

    // --- Cabeçalho ---
    doc
      .fontSize(18)
      .text("Recibo de Entrega e Termo de Garantia", { align: "center" });
    let currentY = doc.y; // Pega a posição Y após o título
    doc.fontSize(12).text(`OS Nº: ${osData.id}`, leftMargin, currentY); // Posição X explícita
    const dataSaida = new Date(osData.data_saida);
    doc
      .fontSize(10)
      .text(
        `Data de Entrega: ${dataSaida.toLocaleDateString("pt-BR")}`,
        leftMargin,
        currentY,
        { align: "right" }
      ); // Alinhado à direita da página
    doc.moveDown(2);
    currentY = doc.y;

    // --- Dados do Cliente ---
    currentY = checkAddPage(currentY, 60); // Estima altura necessária
    doc.fontSize(14).text("Cliente", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc.fontSize(10);
    doc.text(`Nome: ${osData.nome_cliente}`, leftMargin, currentY);
    currentY += 15;
    doc.text(
      `CPF/CNPJ: ${formatDocument(osData.cpf_cnpj) || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 15;
    doc.text(
      `Telefone: ${formatPhone(osData.telefone_cliente) || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 15;
    doc.text(
      `Email: ${osData.email_cliente || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 15;
    doc.text(
      `Endereço: ${osData.endereco_cliente || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 25; // Mais espaço após
    doc.y = currentY; // Atualiza cursor do PDFKit

    // --- Dados do Equipamento ---
    currentY = checkAddPage(currentY, 50);
    doc
      .fontSize(14)
      .text("Equipamento", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc
      .fontSize(10)
      .text(
        `Tipo: ${osData.tipo_equipamento || ""} ${osData.marca || ""} ${
          osData.modelo || ""
        }`,
        leftMargin,
        currentY
      );
    currentY += 15;
    doc.text(
      `Nº de Série: ${osData.numero_serie || "Não informado"}`,
      leftMargin,
      currentY
    );
    currentY += 25;
    doc.y = currentY;

    // --- Detalhes do Serviço ---
    currentY = checkAddPage(currentY, 80); // Estima altura
    doc
      .fontSize(14)
      .text("Serviço Realizado", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc.fontSize(10);
    doc
      .text("Defeito Relatado:", leftMargin, currentY, { continued: true })
      .text(osData.defeito_relatado || "Não informado.");
    currentY = doc.y + 5; // Pega Y após texto
    doc
      .text("Laudo Técnico:", leftMargin, currentY, { continued: true })
      .text(osData.laudo_tecnico || "Não informado.");
    currentY = doc.y + 5;
    doc
      .text("Solução Aplicada:", leftMargin, currentY, { continued: true })
      .text(osData.solucao_aplicada || "Não informada.");
    currentY = doc.y + 15;
    doc.y = currentY;

    // --- Itens e Custos (Layout Controlado) ---
    currentY = checkAddPage(currentY, 40); // Espaço para título e cabeçalho da tabela
    doc
      .fontSize(14)
      .text("Itens e Custos", leftMargin, currentY, { underline: true });
    currentY += 20;
    const tableTopY = currentY;
    const descX = leftMargin;
    const qtyX = 370;
    const unitX = 420;
    const subtotalX = 480;
    const endX = doc.page.width - leftMargin;
    const rowHeight = 15;

    doc.fontSize(9).font("Helvetica-Bold");
    doc.text("Descrição", descX, tableTopY);
    doc.text("Qtd.", qtyX, tableTopY, { width: 40, align: "right" });
    doc.text("Vlr. Unit.", unitX, tableTopY, { width: 60, align: "right" });
    doc.text("Subtotal", subtotalX, tableTopY, { width: 70, align: "right" });
    doc.font("Helvetica");
    currentY += 15; // Pula linha do cabeçalho
    doc.moveTo(descX, currentY).lineTo(endX, currentY).stroke(); // Linha abaixo
    currentY += 5;
    doc.y = currentY;

    itemsData.forEach((item) => {
      const subtotal = item.quantidade * item.valor_unitario;
      const descHeight = doc.heightOfString(item.descricao, {
        width: qtyX - descX - 10,
      });
      const actualRowHeight = Math.max(rowHeight, descHeight) + 4; // Altura + margem

      currentY = checkAddPage(currentY, actualRowHeight); // Verifica se cabe na página ANTES

      doc.fontSize(9);
      doc.text(item.descricao, descX, currentY, {
        width: qtyX - descX - 10,
        align: "left",
      });
      // Salva a posição Y antes de desenhar os itens alinhados à direita
      const rightItemsY = currentY;
      doc.text(item.quantidade, qtyX, rightItemsY, {
        width: 40,
        align: "right",
      });
      doc.text(
        Number(item.valor_unitario).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        unitX,
        rightItemsY,
        { width: 60, align: "right" }
      );
      doc.text(
        subtotal.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        }),
        subtotalX,
        rightItemsY,
        { width: 70, align: "right" }
      );

      currentY += actualRowHeight; // Atualiza Y para próxima linha
      doc.y = currentY;
    });

    currentY = checkAddPage(currentY, 30); // Espaço para linha e total
    doc.moveTo(descX, currentY).lineTo(endX, currentY).stroke(); // Linha abaixo dos itens
    currentY += 10;

    // --- Valor Total (Posição Controlada) ---
    doc.fontSize(12).text(
      `Valor Total: ${Number(osData.valor_total).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      })}`,
      leftMargin,
      currentY,
      { align: "right" }
    );
    currentY += 30; // Mais espaço após o total
    doc.y = currentY;

    // --- Garantia (Layout Controlado) ---
    // Calcula a altura estimada do texto da garantia
    const garantiaText = `Este serviço possui garantia de ${
      osData.garantia_dias || 0
    } dias... Consulte os Termos de Serviço completos para detalhes.`;
    const garantiaHeight = doc.heightOfString(garantiaText, {
      width: contentWidth,
      align: "justify",
    });
    currentY = checkAddPage(currentY, garantiaHeight + 30); // Verifica espaço para título e texto

    doc
      .fontSize(14)
      .text("Termo de Garantia", leftMargin, currentY, { underline: true });
    currentY += 20;
    doc.fontSize(9);
    const garantiaDias = osData.garantia_dias || 0;
    const dataExpiracao = new Date(dataSaida);
    dataExpiracao.setDate(dataExpiracao.getDate() + garantiaDias);

    doc.text(
      `Este serviço possui garantia de ${garantiaDias} dias, válida a partir da data de entrega (${dataSaida.toLocaleDateString(
        "pt-BR"
      )}). A garantia expira em: ${dataExpiracao.toLocaleDateString("pt-BR")}.`,
      leftMargin,
      currentY,
      { width: contentWidth, align: "justify" }
    );
    currentY = doc.y + 5; // Pega Y após o texto
    doc.text(
      'A garantia cobre defeitos de fabricação nas peças substituídas e/ou mão de obra referente ao serviço descrito em "Solução Aplicada". Não cobre mau uso, danos por software, acidentes ou defeitos não relacionados ao reparo original. Consulte os Termos de Serviço completos para detalhes.',
      leftMargin,
      currentY,
      { width: contentWidth, align: "justify" }
    );
    currentY = doc.y + 30; // Mais espaço após garantia
    doc.y = currentY;

    // --- Assinatura (Posição Controlada) ---
    currentY = checkAddPage(currentY, 60); // Espaço para assinatura
    doc.fontSize(10);
    doc.text(
      "___________________________________________",
      leftMargin,
      currentY,
      { align: "center" }
    );
    currentY += 15;
    doc.text("Assinatura do Cliente", leftMargin, currentY, {
      align: "center",
    });
    currentY += 15;
    doc.text(
      "Declaro ter recebido o equipamento descrito acima nas condições especificadas.",
      leftMargin,
      currentY,
      { align: "center", width: 450 }
    );

    // --- Finaliza o PDF ---
    // Não precisa mais mexer no buffer, o pdfkit lida com isso
    doc.end();
    stream.on("finish", () => {
      shell.openPath(filePath);
    });
    return { success: true, path: filePath };
  } catch (error) {
    console.error("Erro detalhado ao gerar PDF:", error);
    return { success: false, error: `Erro ao gerar PDF: ${error.message}` };
  }
});

// --- MÓDULO FINANCEIRO - DESPESAS ---

// Listener para buscar TODAS as despesas
ipcMain.handle("get-expenses", async () => {
  const sql = "SELECT * FROM despesas ORDER BY data DESC, id DESC"; // Ordena da mais recente para mais antiga
  try {
    const [rows] = await dbPool.query(sql);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar despesas:", error);
    return [];
  }
});

// Listener para ADICIONAR uma nova despesa
ipcMain.handle("add-expense", async (event, expenseData) => {
  let {
    descricao,
    data,
    categoria,
    km_rodados,
    preco_litro,
    consumo_medio,
    valor,
  } = expenseData;

  // Garante que campos numéricos opcionais sejam null se vazios, e não string vazia
  km_rodados = km_rodados ? parseFloat(km_rodados) : null;
  preco_litro = preco_litro ? parseFloat(preco_litro) : null;
  consumo_medio = consumo_medio ? parseFloat(consumo_medio) : null;
  valor = valor ? parseFloat(valor) : 0; // Valor principal não pode ser null

  // Calcula o valor se for combustível e os dados estiverem presentes
  if (
    categoria === "Combustível" &&
    km_rodados &&
    preco_litro &&
    consumo_medio &&
    consumo_medio > 0
  ) {
    valor = (km_rodados / consumo_medio) * preco_litro;
  }

  const sql = `
    INSERT INTO despesas 
    (descricao, data, categoria, km_rodados, preco_litro, consumo_medio, valor) 
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;
  try {
    const [result] = await dbPool.query(sql, [
      descricao,
      data,
      categoria,
      km_rodados,
      preco_litro,
      consumo_medio,
      valor,
    ]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error("Erro ao adicionar despesa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR uma despesa existente
ipcMain.handle("update-expense", async (event, expenseData) => {
  let {
    id,
    descricao,
    data,
    categoria,
    km_rodados,
    preco_litro,
    consumo_medio,
    valor,
  } = expenseData;

  // Garante que campos numéricos opcionais sejam null se vazios
  km_rodados = km_rodados ? parseFloat(km_rodados) : null;
  preco_litro = preco_litro ? parseFloat(preco_litro) : null;
  consumo_medio = consumo_medio ? parseFloat(consumo_medio) : null;
  valor = valor ? parseFloat(valor) : 0;

  // Recalcula o valor se for combustível
  if (
    categoria === "Combustível" &&
    km_rodados &&
    preco_litro &&
    consumo_medio &&
    consumo_medio > 0
  ) {
    valor = (km_rodados / consumo_medio) * preco_litro;
  }

  const sql = `
    UPDATE despesas SET 
    descricao = ?, data = ?, categoria = ?, 
    km_rodados = ?, preco_litro = ?, consumo_medio = ?, valor = ? 
    WHERE id = ?
  `;
  try {
    await dbPool.query(sql, [
      descricao,
      data,
      categoria,
      km_rodados,
      preco_litro,
      consumo_medio,
      valor,
      id,
    ]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar despesa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR uma despesa
ipcMain.handle("delete-expense", async (event, expenseId) => {
  const sql = "DELETE FROM despesas WHERE id = ?";
  try {
    await dbPool.query(sql, [expenseId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar despesa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para buscar o Resumo Financeiro (ATUALIZADO para incluir Receitas Avulsas)
ipcMain.handle(
  "get-financial-summary",
  async (event, { startDate, endDate }) => {
    const formattedStartDate = new Date(startDate).toISOString().split("T")[0];
    const formattedEndDate = new Date(endDate).toISOString().split("T")[0];

    try {
      // 1. Calcula Receita das OS no período
      const osRevenueSql = `
      SELECT SUM(valor_total) AS totalOSRevenue 
      FROM ordens_servico 
      WHERE status IN ('Finalizado', 'Entregue') AND data_saida IS NOT NULL AND DATE(data_saida) BETWEEN ? AND ?`;
      const [osRevenueResult] = await dbPool.query(osRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);
      const totalOSRevenue = osRevenueResult[0].totalOSRevenue || 0;

      // 2. Calcula Receita Avulsa no período
      const miscRevenueSql = `
      SELECT SUM(valor) AS totalMiscRevenue 
      FROM receitas_avulsas 
      WHERE data BETWEEN ? AND ?`;
      const [miscRevenueResult] = await dbPool.query(miscRevenueSql, [
        formattedStartDate,
        formattedEndDate,
      ]);
      const totalMiscRevenue = miscRevenueResult[0].totalMiscRevenue || 0;

      // 3. Receita Total
      const totalRevenue = totalOSRevenue + totalMiscRevenue;

      // 4. Calcula Despesa Total no período
      const expenseSql = `SELECT SUM(valor) AS totalExpenses FROM despesas WHERE data BETWEEN ? AND ?`;
      const [expenseResult] = await dbPool.query(expenseSql, [
        formattedStartDate,
        formattedEndDate,
      ]);
      const totalExpenses = expenseResult[0].totalExpenses || 0;

      // 5. Calcula Lucro Líquido
      const netProfit = totalRevenue - totalExpenses;

      return {
        success: true,
        summary: {
          totalRevenue,
          totalExpenses,
          netProfit,
          /* Opcional: podemos retornar os subtotais também */ totalOSRevenue,
          totalMiscRevenue,
        },
      };
    } catch (error) {
      console.error("Erro ao calcular resumo financeiro:", error);
      return { success: false, error: error.message };
    }
  }
);

// --- MÓDULO FINANCEIRO - RECEITAS AVULSAS ---

// Listener para buscar TODAS as receitas avulsas
ipcMain.handle("get-misc-revenues", async () => {
  const sql = "SELECT * FROM receitas_avulsas ORDER BY data DESC, id DESC";
  try {
    const [rows] = await dbPool.query(sql);
    return rows;
  } catch (error) {
    console.error("Erro ao buscar receitas avulsas:", error);
    return [];
  }
});

// Listener para ADICIONAR uma nova receita avulsa
ipcMain.handle("add-misc-revenue", async (event, revenueData) => {
  const { descricao, valor, data } = revenueData;
  const sql =
    "INSERT INTO receitas_avulsas (descricao, valor, data) VALUES (?, ?, ?)";
  try {
    const [result] = await dbPool.query(sql, [
      descricao,
      parseFloat(valor) || 0,
      data,
    ]);
    return { success: true, id: result.insertId };
  } catch (error) {
    console.error("Erro ao adicionar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para ATUALIZAR uma receita avulsa existente
ipcMain.handle("update-misc-revenue", async (event, revenueData) => {
  const { id, descricao, valor, data } = revenueData;
  const sql =
    "UPDATE receitas_avulsas SET descricao = ?, valor = ?, data = ? WHERE id = ?";
  try {
    await dbPool.query(sql, [descricao, parseFloat(valor) || 0, data, id]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao atualizar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// Listener para DELETAR uma receita avulsa
ipcMain.handle("delete-misc-revenue", async (event, revenueId) => {
  const sql = "DELETE FROM receitas_avulsas WHERE id = ?";
  try {
    await dbPool.query(sql, [revenueId]);
    return { success: true };
  } catch (error) {
    console.error("Erro ao deletar receita avulsa:", error);
    return { success: false, error: error.message };
  }
});

// --- FUNÇÕES DA JANELA ---
function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: { preload: path.join(__dirname, "preload.js") },
  });
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "renderer/dist/index.html"));
  }
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
