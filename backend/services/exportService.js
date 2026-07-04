const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { Readable } = require('stream');

/**
 * Helper to convert a stream or document into a binary buffer
 */
const getPdfBuffer = (doc) => {
  return new Promise((resolve, reject) => {
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', (err) => reject(err));
    doc.end();
  });
};

/**
 * Generate a styled PDF report
 * @param {string} title Report Title
 * @param {Array<string>} headers Column header names
 * @param {Array<Array<string>>} rows Row data
 * @param {Object} metadata Key-value pairs for report info (e.g., Batch, Date)
 */
const buildPdfReport = async (title, headers, rows, metadata = {}) => {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  // Color palette (Navy / Sleek Accent)
  const primaryColor = '#1e293b'; // slate-800
  const secondaryColor = '#475569'; // slate-600
  const tableHeaderBg = '#f1f5f9'; // slate-100
  const borderColor = '#cbd5e1'; // slate-300
  const textColor = '#0f172a'; // slate-900

  // 1. Header Title
  doc
    .fillColor(primaryColor)
    .font('Helvetica-Bold')
    .fontSize(20)
    .text('BRIGHT STAR COACHING CENTER', { align: 'center' });
  
  doc
    .fontSize(10)
    .fillColor(secondaryColor)
    .text('Coaching Institute Management System', { align: 'center' })
    .moveDown(1.5);

  doc
    .fillColor(textColor)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(title.toUpperCase(), { align: 'left' })
    .moveDown(0.5);

  // Draw separator line
  doc
    .moveTo(40, doc.y)
    .lineTo(555, doc.y)
    .strokeColor(borderColor)
    .lineWidth(1)
    .stroke()
    .moveDown(1);

  // 2. Metadata Section (2 columns grid)
  const metaKeys = Object.keys(metadata);
  if (metaKeys.length > 0) {
    doc.font('Helvetica').fontSize(9).fillColor(secondaryColor);
    
    let yPos = doc.y;
    metaKeys.forEach((key, index) => {
      const text = `${key}: ${metadata[key]}`;
      const xPos = index % 2 === 0 ? 40 : 300;
      doc.text(text, xPos, yPos);
      if (index % 2 === 1 || index === metaKeys.length - 1) {
        yPos = doc.y + 5;
      }
    });
    doc.moveDown(2);
  }

  // 3. Draw Tabular Grid
  const tableTop = doc.y;
  const colWidth = 515 / headers.length;
  
  // Table Header Row
  doc.font('Helvetica-Bold').fontSize(9).fillColor(textColor);
  
  // Background for headers
  doc
    .rect(40, tableTop - 5, 515, 20)
    .fill(tableHeaderBg);
  
  doc.fillColor(primaryColor);
  headers.forEach((header, index) => {
    doc.text(header, 42 + index * colWidth, tableTop, {
      width: colWidth - 4,
      align: 'left',
    });
  });

  // Table Body Rows
  let currentY = tableTop + 15;
  doc.font('Helvetica').fontSize(8).fillColor(textColor);

  rows.forEach((row) => {
    // Page breaking check
    if (currentY > 750) {
      doc.addPage();
      currentY = 50; // reset y on new page
    }

    row.forEach((cell, cellIndex) => {
      doc.text(String(cell || ''), 42 + cellIndex * colWidth, currentY, {
        width: colWidth - 4,
        align: 'left',
      });
    });

    // Draw horizontal separator
    doc
      .moveTo(40, currentY + 12)
      .lineTo(555, currentY + 12)
      .strokeColor(borderColor)
      .lineWidth(0.5)
      .stroke();

    currentY += 18;
  });

  // 4. Footer Page Numbers
  const pages = doc.bufferedPageRange();
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i);
    doc
      .fillColor(secondaryColor)
      .fontSize(8)
      .text(
        `Page ${i + 1} of ${pages.count}  |  Generated on ${new Date().toLocaleString()}`,
        40,
        800,
        { align: 'center', width: 515 }
      );
  }

  return await getPdfBuffer(doc);
};

/**
 * Generate a styled Excel workbook buffer
 * @param {string} title Sheet/Report Title
 * @param {Array<string>} headers Column header names
 * @param {Array<Array<string>>} rows Row data
 * @param {Object} metadata Key-value pairs for sheet info
 */
const buildExcelReport = async (title, headers, rows, metadata = {}) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(title.substring(0, 30));

  // Style helper
  const headerFont = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFF' } };
  const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E293B' } }; // Slate-800
  const borderStyle = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } },
  };

  // Add Metadata Header
  worksheet.addRow(['BRIGHT STAR COACHING CENTER']).font = { name: 'Arial', size: 14, bold: true };
  worksheet.addRow([title.toUpperCase()]).font = { name: 'Arial', size: 12, bold: true, italic: true };
  worksheet.addRow([]); // empty spacing

  Object.keys(metadata).forEach((key) => {
    worksheet.addRow([key, metadata[key]]);
  });
  worksheet.addRow([]); // spacing before table

  // Add Headers row
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  // Add Data Rows
  rows.forEach((row) => {
    const addedRow = worksheet.addRow(row);
    addedRow.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10 };
      cell.border = borderStyle;
    });
  });

  // Autoresize columns
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value ? String(cell.value).length : 0;
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.max(maxLength + 3, 10);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};

module.exports = {
  buildPdfReport,
  buildExcelReport,
};
