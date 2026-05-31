'use strict';
const { parentPort, workerData } = require('worker_threads');
const PDFDocument = require('pdfkit');
const fs = require('fs');

// ── Utilitários ────────────────────────────────────────────────────────────
function formatDocument(doc) {
  if (doc == null) return '';
  const c = String(doc).replace(/\D/g, '');
  if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  if (c.length === 14) return c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
  return String(doc);
}

function formatPhone(phone) {
  if (phone == null) return '';
  const c = String(phone).replace(/\D/g, '');
  if (c.length === 11) return c.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  if (c.length === 10) return c.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  return String(phone);
}

// ── Comprovante de Entrada (duas vias) ─────────────────────────────────────
function buildEntryPDF({ osData, filePath, companyName, logoPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    stream.on('error', reject);

    const M  = 38;
    const CW = doc.page.width - M * 2;

    const CONDITIONS =
      'LEIA COM ATENÇÃO! O prazo para orçamento é de até 7 (sete) dias úteis a partir da data de entrada, de acordo com a demanda de serviços. ' +
      'O orçamento é apresentado ao cliente para aprovação prévia - nenhum serviço é executado sem autorização expressa. ' +
      'Ao realizar diagnóstico em equipamentos eletrônicos, podem ser identificados defeitos adicionais além do informado, podendo inviabilizar o conserto total ou parcial. ' +
      'Por isso, informe qualquer defeito pré-existente; somente o defeito descrito nesta ordem será considerado. ' +
      'Não cobramos taxa de orçamento. Serviços em placa-mãe possuem taxa de bancada, independentemente do resultado. ' +
      'O cliente é o único responsável pelo backup de seus dados - a empresa não se responsabiliza por perda de informações durante o serviço. ' +
      'O equipamento deve ser retirado em até 90 (noventa) dias após conclusão ou recusa do serviço; após esse prazo, poderão ser aplicadas taxas de armazenamento conforme legislação vigente (Lei 8.078/90 - CDC).';

    const labeledBox = (label, value, x, y, w, h = 26) => {
      doc.rect(x, y, w, h).lineWidth(0.4).strokeColor('#888').stroke();
      doc.font('Helvetica').fontSize(7).fillColor('#555')
         .text(label, x + 3, y + 3, { width: w - 6, lineBreak: false });
      doc.font('Helvetica').fontSize(10).fillColor('#000')
         .text(String(value || ''), x + 3, y + 13, { width: w - 6, lineBreak: false, ellipsis: true });
    };

    const secTitle = (text, y) =>
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(text, M, y, { width: CW });

    const drawVia = (isClientCopy) => {
      const via = isClientCopy ? 'Via do Cliente' : 'Via da Empresa';
      const dataEntrada = new Date(osData.data_entrada);
      const dateStr = dataEntrada.toLocaleDateString('pt-BR');
      const timeStr = dataEntrada.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      let y = M;

      // Cabeçalho
      let logoW = 0;
      if (logoPath && fs.existsSync(logoPath)) {
        try { doc.image(logoPath, M, y, { height: 44, fit: [70, 44] }); logoW = 78; } catch (_) {}
      }
      const hTx = M + logoW, hTw = CW - logoW;
      doc.font('Helvetica-Bold').fontSize(13).fillColor('#000').text(companyName, hTx, y, { width: hTw, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#222').text('COMPROVANTE DE ENTRADA INTERNO', hTx, y + 17, { width: hTw, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#000').text(`OS Nº ${String(osData.id).padStart(6, '0')}`, M, y, { width: CW, align: 'right' });
      doc.font('Helvetica').fontSize(8).fillColor('#444').text(via, M, y + 14, { width: CW, align: 'right' });
      y += 44;
      doc.moveTo(M, y).lineTo(M + CW, y).lineWidth(1.5).strokeColor('#000').stroke();
      y += 6;

      // Dados do cliente
      labeledBox('OS Nº', String(osData.id).padStart(6, '0'), M, y, CW * 0.18);
      labeledBox('Data de Entrada', dateStr, M + CW * 0.18, y, CW * 0.32);
      labeledBox('Hora', timeStr, M + CW * 0.50, y, CW * 0.50);
      y += 26;
      labeledBox('Cliente', osData.nome_cliente, M, y, CW);
      y += 26;
      labeledBox('CPF/CNPJ', formatDocument(osData.cpf_cnpj), M, y, CW * 0.5);
      labeledBox('Telefone / Contato', formatPhone(osData.telefone_cliente), M + CW * 0.5, y, CW * 0.5);
      y += 26;
      const rua = osData.logradouro || osData.endereco_cliente || '';
      labeledBox('CEP', osData.cep || '', M, y, CW * 0.25);
      labeledBox('Endereço / Logradouro', rua, M + CW * 0.25, y, CW * 0.55);
      labeledBox('Número', osData.num_end || '', M + CW * 0.80, y, CW * 0.20);
      y += 26;
      labeledBox('Bairro', osData.bairro || '', M, y, CW * 0.40);
      labeledBox('Cidade', osData.cidade || '', M + CW * 0.40, y, CW * 0.40);
      labeledBox('UF', osData.estado || '', M + CW * 0.80, y, CW * 0.20);
      y += 26 + 10;

      // Equipamento
      secTitle('DADOS DO EQUIPAMENTO', y); y += 16;
      labeledBox('Tipo / Equipamento', osData.tipo_equipamento, M, y, CW * 0.35);
      labeledBox('Marca', osData.marca, M + CW * 0.35, y, CW * 0.30);
      labeledBox('Modelo', osData.modelo, M + CW * 0.65, y, CW * 0.35);
      y += 26;
      labeledBox('Nº de Série', osData.numero_serie, M, y, CW * 0.40);
      labeledBox('Acessórios / Itens Entregues', osData.observacoes_entrada, M + CW * 0.40, y, CW * 0.60);
      y += 26 + 10;

      // Defeito
      secTitle('DEFEITO / PROBLEMA RELATADO', y); y += 16;
      const probH = 60;
      doc.rect(M, y, CW, probH).lineWidth(0.4).strokeColor('#888').stroke();
      doc.font('Helvetica').fontSize(10).fillColor('#000')
         .text(osData.defeito_relatado || '', M + 5, y + 5, { width: CW - 10, height: probH - 10 });
      y += probH + 10;

      // Condições
      secTitle('CONDIÇÕES DE SERVIÇO', y); y += 16;
      const condH = 120;
      doc.rect(M, y, CW, condH).lineWidth(0.4).strokeColor('#888').stroke();
      doc.font('Helvetica').fontSize(9).fillColor('#000')
         .text(CONDITIONS, M + 5, y + 5, { width: CW - 10, height: condH - 10, align: 'justify' });
      y += condH + 12;

      // Rodapé
      doc.font('Helvetica').fontSize(9.5).fillColor('#000')
         .text(`Data Entrega/Entrada: ${dateStr}     Hora: ${timeStr}`, M, y);
      y += 16;
      const atendente = osData.nome_atendente ? `Técnico: ${osData.nome_atendente}` : 'Técnico Responsável: _______________________';
      doc.font('Helvetica').fontSize(9.5).text('Situação da Ordem: _________________________________', M, y);
      doc.text(atendente, M, y, { width: CW, align: 'right' });
      y += 20;

      // Vias (checkboxes)
      const bs = 9;
      doc.rect(M, y, bs, bs).lineWidth(0.5).stroke();
      if (isClientCopy) doc.font('Helvetica-Bold').fontSize(9).text('X', M + 1.8, y + 0.5);
      doc.font('Helvetica').fontSize(9.5).fillColor('#000').text('Via do Cliente', M + bs + 4, y + 0.5);
      doc.rect(M + 125, y, bs, bs).lineWidth(0.5).stroke();
      if (!isClientCopy) doc.font('Helvetica-Bold').fontSize(9).text('X', M + 126.8, y + 0.5);
      doc.font('Helvetica').fontSize(9.5).text('Via da Empresa', M + 125 + bs + 4, y + 0.5);

      // Assinaturas — área ampla para assinar à mão
      y += 58;
      const lw = CW * 0.44, l2x = M + CW - lw;
      doc.moveTo(M, y).lineTo(M + lw, y).lineWidth(0.6).strokeColor('#333').stroke();
      doc.font('Helvetica').fontSize(8.5).fillColor('#333').text('Visto / Assinatura do Cliente', M, y + 4, { width: lw, align: 'center' });
      doc.moveTo(l2x, y).lineTo(l2x + lw, y).lineWidth(0.6).strokeColor('#333').stroke();
      doc.font('Helvetica').fontSize(8.5).fillColor('#333').text('Visto / Assinatura da Empresa', l2x, y + 4, { width: lw, align: 'center' });
    };

    drawVia(false);
    doc.addPage();
    drawVia(true);
    doc.end();
    stream.on('finish', resolve);
  });
}

// ── Recibo de Saída / Garantia ─────────────────────────────────────────────
function buildExitPDF({ osData, itemsData, filePath, companyName, logoPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    stream.on('error', reject);

    const margin = 50;
    const contentWidth = doc.page.width - margin * 2;
    const startY = doc.y;
    let logoDrawn = false;

    // Cabeçalho de branding
    if (logoPath && fs.existsSync(logoPath)) {
      try { doc.image(logoPath, margin, startY, { height: 50, fit: [90, 50] }); logoDrawn = true; } catch (_) {}
    }
    const tX = logoDrawn ? margin + 100 : margin;
    const tW = logoDrawn ? contentWidth - 100 : contentWidth;
    const al = logoDrawn ? 'left' : 'center';
    doc.font('Helvetica-Bold').fontSize(logoDrawn ? 15 : 18).text(companyName, tX, startY, { width: tW, align: al });
    doc.font('Helvetica').fontSize(logoDrawn ? 12 : 14).text('Recibo de Entrega e Termo de Garantia', tX, doc.y, { width: tW, align: al });
    doc.fontSize(10).text(`OS Nº: ${osData.id}  ·  ${new Date().toLocaleDateString('pt-BR')}`, tX, doc.y, { width: tW, align: al });
    if (logoDrawn) doc.y = Math.max(doc.y, startY + 58);
    doc.moveDown(0.5);
    doc.moveTo(margin, doc.y).lineTo(margin + contentWidth, doc.y).strokeColor('#aaaaaa').lineWidth(0.75).stroke();
    doc.strokeColor('black').lineWidth(1);
    doc.font('Helvetica').fontSize(10).moveDown(1);

    const checkPage = (curY, needed) => {
      if (curY + needed > doc.page.height - 50) { doc.addPage(); return 50; }
      return curY;
    };

    const dataSaida = new Date(osData.data_saida);
    doc.fontSize(10).text(`Data de Entrega: ${dataSaida.toLocaleDateString('pt-BR')}`, { align: 'right' });
    doc.moveDown(1);
    let y = doc.y;

    // Cliente
    y = checkPage(y, 60);
    doc.fontSize(14).text('Cliente', margin, y, { underline: true }); y += 20;
    doc.fontSize(10);
    doc.text(`Nome: ${osData.nome_cliente}`, margin, y); y += 15;
    doc.text(`CPF/CNPJ: ${formatDocument(osData.cpf_cnpj) || 'Não informado'}`, margin, y); y += 15;
    doc.text(`Telefone: ${formatPhone(osData.telefone_cliente) || 'Não informado'}`, margin, y); y += 15;
    doc.text(`Email: ${osData.email_cliente || 'Não informado'}`, margin, y); y += 15;
    const addr = [osData.logradouro || osData.endereco_cliente, osData.num_end, osData.bairro, osData.cidade, osData.estado].filter(Boolean).join(', ');
    doc.text(`Endereço: ${addr || 'Não informado'}`, margin, y); y += 25;
    doc.y = y;

    // Equipamento
    y = checkPage(y, 50);
    doc.fontSize(14).text('Equipamento', margin, y, { underline: true }); y += 20;
    doc.fontSize(10);
    doc.text(`Tipo: ${osData.tipo_equipamento || ''} ${osData.marca || ''} ${osData.modelo || ''}`, margin, y); y += 15;
    doc.text(`Nº de Série: ${osData.numero_serie || 'Não informado'}`, margin, y); y += 25;
    doc.y = y;

    // Serviço
    y = checkPage(y, 80);
    doc.fontSize(14).text('Serviço Realizado', margin, y, { underline: true }); y += 20;
    doc.fontSize(10);
    doc.text('Defeito Relatado:', margin, y, { continued: true }).text(osData.defeito_relatado || 'Não informado.'); y = doc.y + 5;
    doc.text('Laudo Técnico:', margin, y, { continued: true }).text(osData.laudo_tecnico || 'Não informado.'); y = doc.y + 5;
    doc.text('Solução Aplicada:', margin, y, { continued: true }).text(osData.solucao_aplicada || 'Não informada.'); y = doc.y + 15;
    doc.y = y;

    // Itens
    y = checkPage(y, 40);
    doc.fontSize(14).text('Itens e Custos', margin, y, { underline: true }); y += 20;
    const qX = 370, uX = 420, sX = 480, eX = doc.page.width - margin;
    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Descrição', margin, y);
    doc.text('Qtd.', qX, y, { width: 40, align: 'right' });
    doc.text('Vlr. Unit.', uX, y, { width: 60, align: 'right' });
    doc.text('Subtotal', sX, y, { width: 70, align: 'right' });
    doc.font('Helvetica'); y += 15;
    doc.moveTo(margin, y).lineTo(eX, y).stroke(); y += 5;
    doc.y = y;

    itemsData.forEach((item) => {
      const sub = item.quantidade * item.valor_unitario;
      const dH = Math.max(15, doc.heightOfString(item.descricao, { width: qX - margin - 10 })) + 4;
      y = checkPage(y, dH);
      doc.fontSize(9);
      doc.text(item.descricao, margin, y, { width: qX - margin - 10 });
      doc.text(String(item.quantidade), qX, y, { width: 40, align: 'right' });
      doc.text(Number(item.valor_unitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), uX, y, { width: 60, align: 'right' });
      doc.text(sub.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }), sX, y, { width: 70, align: 'right' });
      y += dH; doc.y = y;
    });

    y = checkPage(y, 30);
    doc.moveTo(margin, y).lineTo(eX, y).stroke(); y += 10;
    doc.fontSize(12).text(`Valor Total: ${Number(osData.valor_total).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`, margin, y, { align: 'right' });
    y += 30; doc.y = y;

    // Garantia
    const gDias = osData.garantia_dias || 0;
    const gExp = new Date(dataSaida); gExp.setDate(gExp.getDate() + gDias);
    const gTxt = `Este serviço possui garantia de ${gDias} dias, válida a partir da data de entrega (${dataSaida.toLocaleDateString('pt-BR')}). A garantia expira em: ${gExp.toLocaleDateString('pt-BR')}.`;
    y = checkPage(y, doc.heightOfString(gTxt, { width: contentWidth }) + 60);
    doc.fontSize(14).text('Termo de Garantia', margin, y, { underline: true }); y += 20;
    doc.fontSize(9).text(gTxt, margin, y, { width: contentWidth, align: 'justify' }); y = doc.y + 5;
    doc.text('A garantia cobre defeitos de fabricação nas peças substituídas e/ou mão de obra referente ao serviço descrito em "Solução Aplicada". Não cobre mau uso, danos por software, acidentes ou defeitos não relacionados ao reparo original.', margin, y, { width: contentWidth, align: 'justify' }); y = doc.y + 30;
    doc.y = y;

    // Assinatura
    y = checkPage(y, 60);
    doc.fontSize(10);
    doc.text('___________________________________________', margin, y, { align: 'center' }); y += 15;
    doc.text('Assinatura do Cliente', margin, y, { align: 'center' }); y += 15;
    doc.text('Declaro ter recebido o equipamento descrito acima nas condições especificadas.', margin, y, { align: 'center', width: 450 });

    doc.end();
    stream.on('finish', resolve);
  });
}

// ── Ponto de entrada do worker ─────────────────────────────────────────────
async function main() {
  try {
    if (workerData.type === 'entry') await buildEntryPDF(workerData);
    else await buildExitPDF(workerData);
    parentPort.postMessage({ success: true });
  } catch (err) {
    parentPort.postMessage({ success: false, error: err.message });
  }
}

main();
