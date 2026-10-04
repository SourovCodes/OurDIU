// A small routine sheet laid out like SWE's (an .xlsx file: a zip of XML), for
// tests: the slots over a "Class | Course | Teacher …" header, then each day's rooms.
// Also used by the web's end-to-end tests.

/** Rows of cells from column A; null leaves a cell empty. */
type Rows = (string | null)[][];

const SLOTS = [
  "08:30-10:00",
  "10:00-11:30",
  "11.30-01:00",
  "01:00-2:30",
  "02:30 - 04:00",
  "04:00 - 05:30",
];

/** The sheet's rows: SWE's heading, the slots, then Saturday and Monday. */
function rows(): Rows {
  const header = ["Class"];
  for (let i = 0; i < SLOTS.length; i++) header.push("Course", "Teacher");
  const slots: (string | null)[] = [null];
  for (const s of SLOTS) slots.push(s, null);
  return [
    [
      "Effective from 03 October, 2026",
      null,
      null,
      null,
      null,
      null,
      null,
      "Prepared by: \nRoutine Committee",
    ],
    [" Department of Software Engineering"],
    ["Fall 2026"],
    slots,
    header,
    ["Saturday"],
    // A double class (two slots in a row), then 44_G's class.
    [
      "611",
      null,
      null,
      null,
      null,
      "GE324-43-C",
      "SK",
      "GE324-43-C",
      "SK",
      "SE232-44-G",
      "KM",
    ],
    // A lab over two slots, for lab group G1 only.
    ["Annex - 409 (LAB)", "SE231-44-G1", "FAJ", "SE231-44-G1", "FAJ"],
    // A course for an old-curriculum section, left out; a cell that can't be read.
    ["701A", "SE221-UC-A", "SKS", "SE2X-44", "AB"],
    // Two online classes at once: no room clash.
    ["ONLINE", "SE331-41-DSA1", "RA"],
    ["ONLINE", "SE133-46-C1", "MF"],
    ["Monday"],
    [
      "G1-007 (COM LAB)",
      null,
      null,
      "SE231-44-G2",
      "FAJ",
      "SE231-44-G2",
      "FAJ",
    ],
    ["612", null, null, null, null, null, null, "SE235-44-G", "PS"],
  ];
}

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const column = (n: number) =>
  n <= 26
    ? String.fromCharCode(64 + n)
    : String.fromCharCode(64 + Math.floor((n - 1) / 26)) +
      String.fromCharCode(65 + ((n - 1) % 26));

/** The sheet and its shared strings; the heading cell is an inline string. */
function sheetXml(): Record<string, string> {
  const shared: string[] = [];
  const body = rows()
    .map((cells, r) => {
      const xml = cells
        .map((text, c) => {
          if (text === null) return "";
          const ref = `${column(c + 1)}${r + 1}`;
          if (r === 1 && c === 0) {
            return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escape(text)}</t></is></c>`;
          }
          shared.push(text);
          return `<c r="${ref}" s="1" t="s"><v>${shared.length - 1}</v></c>`;
        })
        .join("");
      return `<row r="${r + 1}">${xml}</row>`;
    })
    .join("");
  const ns =
    'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"';
  return {
    "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`,
    "_rels/.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8"?><workbook ${ns} xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Student Version" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`,
    "xl/worksheets/sheet1.xml": `<?xml version="1.0" encoding="UTF-8"?><worksheet ${ns}><dimension ref="A1:M1023"/><sheetData>${body}</sheetData><mergeCells count="1"><mergeCell ref="A6:M6"/></mergeCells></worksheet>`,
    "xl/sharedStrings.xml": `<?xml version="1.0" encoding="UTF-8"?><sst ${ns} count="${shared.length}" uniqueCount="${shared.length}">${shared
      .map((t) => `<si><t xml:space="preserve">${escape(t)}</t></si>`)
      .join("")}</sst>`,
  };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflate(data: Uint8Array) {
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A zip of the files: the sheet compressed, as Excel does, the rest stored. */
async function zip(files: Record<string, string>): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const raw = new TextEncoder().encode(text);
    const compress = name.endsWith("sheet1.xml");
    const data = compress ? await deflate(raw) : raw;
    const fileName = new TextEncoder().encode(name);
    const header = (size: number, signature: number) => {
      const b = new DataView(new ArrayBuffer(size));
      b.setUint32(0, signature, true);
      return b;
    };
    const local = header(30, 0x04034b50);
    local.setUint16(4, 20, true);
    local.setUint16(8, compress ? 8 : 0, true);
    local.setUint32(14, crc32(raw), true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, fileName.length, true);
    const entry = header(46, 0x02014b50);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(10, compress ? 8 : 0, true);
    entry.setUint32(16, crc32(raw), true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, raw.length, true);
    entry.setUint16(28, fileName.length, true);
    entry.setUint32(42, offset, true);
    parts.push(new Uint8Array(local.buffer), fileName, data);
    central.push(new Uint8Array(entry.buffer), fileName);
    offset += 30 + fileName.length + data.length;
  }
  const centralSize = central.reduce((n, p) => n + p.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  const all = [...parts, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** SWE's routine sheet, as DIU publishes it (an .xlsx file). */
export const sweRoutineXlsx = () => zip(sheetXml());
