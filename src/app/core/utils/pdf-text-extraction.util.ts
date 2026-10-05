interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
}

const ROW_Y_TOLERANCE = 2;

/** Extracts each PDF page's text as an array of lines, reconstructing column spacing from
 * glyph x-positions (mirrors what `pdftotext -layout` does) so line-based regex parsing works. */
export async function extractLayoutLines(file: File): Promise<string[]> {
  // Statically (well, lazily-but-bundler-tracked) importing the worker module and handing it to
  // pdf.js via `globalThis.pdfjsWorker` makes pdf.js skip its default `new Worker(workerSrc)` +
  // runtime-string dynamic-import fallback dance entirely (see pdfjs-dist's PDFWorker#initialize /
  // _setupFakeWorkerGlobal) — that fallback's raw `import(workerSrc)` gets mangled by Angular's
  // Vite-based dev server ("Failed to fetch dynamically imported module ...?import"). Running the
  // parser on the main thread instead of a real Worker is a non-issue for a few-page statement PDF.
  const [pdfjsLib, pdfjsWorker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs')
  ]);
  (globalThis as unknown as { pdfjsWorker: unknown }).pdfjsWorker = pdfjsWorker;

  const buffer = await file.arrayBuffer();
  if (buffer.byteLength < 1024) {
    // Seen in practice: the OS file picker occasionally hands back a near-empty File object
    // (byteLength of a few bytes) for a real, multi-MB file on disk — a one-off browser/OS
    // glitch, not a parsing problem. Surface it clearly instead of a confusing pdf.js error.
    throw new Error('El archivo llegó vacío o incompleto desde el explorador de archivos. Probá seleccionarlo de nuevo.');
  }

  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;

  const lines: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent();
    lines.push(...reconstructLines(content.items as PdfTextItem[]));
  }

  return lines;
}

function reconstructLines(items: PdfTextItem[]): string[] {
  const rows: { y: number; items: PdfTextItem[] }[] = [];

  for (const item of items) {
    if (!item.str) continue;
    const y = item.transform[5];
    const row = rows.find((r) => Math.abs(r.y - y) <= ROW_Y_TOLERANCE);
    if (row) row.items.push(item);
    else rows.push({ y, items: [item] });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) => {
      const sorted = [...row.items].sort((a, b) => a.transform[4] - b.transform[4]);
      let line = '';
      let prevEndX: number | null = null;
      for (const item of sorted) {
        const x = item.transform[4];
        const fontSize = Math.abs(item.transform[3]) || 10;
        if (prevEndX !== null) {
          const gap = x - prevEndX;
          if (gap > fontSize * 0.6) line += '  ';
          else if (gap > fontSize * 0.15) line += ' ';
        }
        line += item.str;
        prevEndX = x + item.width;
      }
      return line;
    });
}
