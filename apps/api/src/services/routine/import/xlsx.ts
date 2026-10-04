// The cells of an Excel workbook's first sheet, for reading a routine published as a
// spreadsheet (SWE's). An .xlsx file is a zip of XML files: the sheet's cells
// (`xl/worksheets/sheet1.xml`), whose text mostly sits in a shared list
// (`xl/sharedStrings.xml`). Read with the runtime's own inflate and a few patterns,
// so no library: the files Excel writes are regular enough.

/** A cell's text by row and column, both from 1: `cells.get(7)?.get(2)` is B7. */
export type SheetCells = Map<number, Map<number, string>>;

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04];

/** Whether the bytes are a zip file, as an .xlsx is. */
export const isZip = (bytes: Uint8Array) =>
  ZIP_MAGIC.every((b, i) => bytes[i] === b);

/** The files in a zip, by name: read from its central directory. */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The end of central directory record: its signature, searched from the end
  // (a comment of up to 64 KB may follow it).
  let end = -1;
  for (
    let i = bytes.length - 22;
    i >= Math.max(0, bytes.length - 65_557);
    i--
  ) {
    if (view.getUint32(i, true) === 0x06054b50) {
      end = i;
      break;
    }
  }
  if (end < 0) throw new Error("Not a zip file");
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const files = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(at, true) !== 0x02014b50) throw new Error("Bad zip");
    const method = view.getUint16(at + 10, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const extraLength = view.getUint16(at + 30, true);
    const commentLength = view.getUint16(at + 32, true);
    const local = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(
      bytes.subarray(at + 46, at + 46 + nameLength),
    );
    at += 46 + nameLength + extraLength + commentLength;
    // The local header has its own name and extra field before the data.
    const data =
      local +
      30 +
      view.getUint16(local + 26, true) +
      view.getUint16(local + 28, true);
    const stored = bytes.subarray(data, data + size);
    if (method === 0) files.set(name, stored);
    else if (method === 8) files.set(name, await inflate(stored));
  }
  return files;
}

async function inflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([new Uint8Array(data)])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** XML text with its entities (`&amp;`, `&#10;`) turned back into characters. */
function unescape(text: string) {
  return text.replace(/&(#x?[0-9a-fA-F]+|\w+);/g, (whole, name: string) => {
    if (name.startsWith("#x"))
      return String.fromCodePoint(parseInt(name.slice(2), 16));
    if (name.startsWith("#"))
      return String.fromCodePoint(Number(name.slice(1)));
    return ENTITIES[name] ?? whole;
  });
}

/** The text of a shared string or an inline one: its `<t>` runs, joined. */
function textOf(xml: string) {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((m) => unescape(m[1]!))
    .join("");
}

/** "B7" as row 7, column 2. */
function position(ref: string) {
  const [, letters, row] = /^([A-Z]+)(\d+)$/.exec(ref)!;
  let column = 0;
  for (const ch of letters!) column = column * 26 + ch.charCodeAt(0) - 64;
  return { row: Number(row), column };
}

/** The first sheet's cells that have something in them, as text. */
export async function sheetCells(bytes: Uint8Array): Promise<SheetCells> {
  const files = await unzip(bytes);
  const decode = (name: string) => {
    const file = files.get(name);
    return file ? new TextDecoder().decode(file) : null;
  };
  const sheet = decode("xl/worksheets/sheet1.xml");
  if (sheet === null) throw new Error("No sheet");
  const shared = [
    ...(decode("xl/sharedStrings.xml") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) => textOf(m[1]!));

  const cells: SheetCells = new Map();
  for (const m of sheet.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attributes = m[1]!;
    const body = m[2] ?? "";
    const ref = /\br="([A-Z]+\d+)"/.exec(attributes)?.[1];
    if (!ref) continue;
    const type = /\bt="(\w+)"/.exec(attributes)?.[1];
    const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    const text =
      type === "s"
        ? shared[Number(value)]
        : type === "inlineStr"
          ? textOf(body)
          : value === undefined
            ? undefined
            : unescape(value);
    if (text === undefined || !text.trim()) continue;
    const { row, column } = position(ref);
    if (!cells.has(row)) cells.set(row, new Map());
    cells.get(row)!.set(column, text);
  }
  return cells;
}
