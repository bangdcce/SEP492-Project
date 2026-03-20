import archiver from 'archiver';
import { once } from 'events';
import { PassThrough } from 'stream';

type XlsxPrimitive = string | number | boolean | null | undefined;

export interface XlsxSheetColumn {
  key: string;
  title: string;
  width?: number;
  wrap?: boolean;
}

export interface XlsxSheetDefinition {
  name: string;
  columns: XlsxSheetColumn[];
  rows: Array<Record<string, XlsxPrimitive>>;
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

function columnLetter(index: number): string {
  let current = index;
  let label = '';

  while (current > 0) {
    const remainder = (current - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    current = Math.floor((current - 1) / 26);
  }

  return label;
}

function buildCellXml(
  rowIndex: number,
  columnIndex: number,
  value: XlsxPrimitive,
  styleId: number,
): string {
  const ref = `${columnLetter(columnIndex)}${rowIndex}`;

  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}" s="${styleId}"/>`;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}" s="${styleId}"><v>${value}</v></c>`;
  }

  if (typeof value === 'boolean') {
    return `<c r="${ref}" s="${styleId}" t="b"><v>${value ? 1 : 0}</v></c>`;
  }

  return `<c r="${ref}" s="${styleId}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(
    String(value),
  )}</t></is></c>`;
}

function buildWorksheetXml(sheet: XlsxSheetDefinition): string {
  const lastColumn = columnLetter(sheet.columns.length);
  const rowsXml = [
    `<row r="1">${sheet.columns
      .map((column, index) => buildCellXml(1, index + 1, column.title, 1))
      .join('')}</row>`,
    ...sheet.rows.map((row, rowIndex) => {
      const excelRow = rowIndex + 2;
      const cells = sheet.columns.map((column, columnIndex) => {
        const rawValue = row[column.key];
        const normalizedValue =
          typeof rawValue === 'object' && rawValue !== null ? JSON.stringify(rawValue) : rawValue;
        const baseStyle = column.wrap ? 2 : 0;
        const styleId =
          column.key === 'riskLevel' && String(normalizedValue || '').toUpperCase() === 'HIGH'
            ? column.wrap
              ? 4
              : 3
            : baseStyle;

        return buildCellXml(excelRow, columnIndex + 1, normalizedValue, styleId);
      });

      return `<row r="${excelRow}">${cells.join('')}</row>`;
    }),
  ].join('');

  const colsXml = sheet.columns
    .map(
      (column, index) =>
        `<col min="${index + 1}" max="${index + 1}" width="${column.width || 18}" customWidth="1"/>`,
    )
    .join('');

  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<sheetViews><sheetView workbookViewId="0"/></sheetViews>',
    `<cols>${colsXml}</cols>`,
    `<sheetData>${rowsXml}</sheetData>`,
    `<autoFilter ref="A1:${lastColumn}1"/>`,
    '<pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/>',
    '</worksheet>',
  ].join('');
}

function buildStylesXml(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<fonts count="2">',
    '<font><sz val="11"/><color rgb="FF111827"/><name val="Calibri"/></font>',
    '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>',
    '</fonts>',
    '<fills count="4">',
    '<fill><patternFill patternType="none"/></fill>',
    '<fill><patternFill patternType="gray125"/></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>',
    '<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>',
    '</fills>',
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="5">',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1"/>',
    '<xf numFmtId="0" fontId="0" fillId="3" borderId="0" xfId="0" applyFill="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>',
    '</cellXfs>',
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
    '</styleSheet>',
  ].join('');
}

export async function buildXlsxWorkbook(sheets: XlsxSheetDefinition[]): Promise<Buffer> {
  const archive = archiver('zip', { zlib: { level: 9 } });
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  archive.pipe(stream);
  stream.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));

  archive.append(
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
      ...sheets.map(
        (_sheet, index) =>
          `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      ),
      '</Types>',
    ].join(''),
    { name: '[Content_Types].xml' },
  );

  archive.append(
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>',
      '</Relationships>',
    ].join(''),
    { name: '_rels/.rels' },
  );

  archive.append(
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">',
      '<sheets>',
      ...sheets.map(
        (sheet, index) =>
          `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
      ),
      '</sheets>',
      '</workbook>',
    ].join(''),
    { name: 'xl/workbook.xml' },
  );

  archive.append(
    [
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">',
      ...sheets.map(
        (_sheet, index) =>
          `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
      ),
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
      '</Relationships>',
    ].join(''),
    { name: 'xl/_rels/workbook.xml.rels' },
  );

  archive.append(buildStylesXml(), { name: 'xl/styles.xml' });

  sheets.forEach((sheet, index) => {
    archive.append(buildWorksheetXml(sheet), {
      name: `xl/worksheets/sheet${index + 1}.xml`,
    });
  });

  void archive.finalize();
  await once(stream, 'end');

  return Buffer.concat(chunks);
}
