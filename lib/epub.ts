import { getChapterDraft, extractTitleFromMarkdown, stripTitleFromMarkdown } from './series';
import { API_BASE } from "./constants";

// Simple CRC32 implementation for ZIP
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  const table = new Uint32Array(256);

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Create a ZIP file manually
class ZipWriter {
  private files: { name: string; data: Uint8Array; crc: number; compress: boolean }[] = [];

  addFile(name: string, content: string | Uint8Array, compress = true) {
    const data = typeof content === 'string'
      ? new TextEncoder().encode(content)
      : content;
    const crc = crc32(data);
    this.files.push({ name, data, crc, compress });
  }

  generate(): Blob {
    const parts: Uint8Array[] = [];
    const centralDirectory: Uint8Array[] = [];
    let offset = 0;

    for (const file of this.files) {
      const nameBytes = new TextEncoder().encode(file.name);

      // Local file header
      const localHeader = new ArrayBuffer(30 + nameBytes.length);
      const localView = new DataView(localHeader);
      const localArray = new Uint8Array(localHeader);

      localView.setUint32(0, 0x04034b50, true); // Local file header signature
      localView.setUint16(4, 20, true); // Version needed to extract
      localView.setUint16(6, 0, true); // General purpose bit flag
      localView.setUint16(8, 0, true); // Compression method (0 = store)
      localView.setUint16(10, 0, true); // File last mod time
      localView.setUint16(12, 0, true); // File last mod date
      localView.setUint32(14, file.crc, true); // CRC-32
      localView.setUint32(18, file.data.length, true); // Compressed size
      localView.setUint32(22, file.data.length, true); // Uncompressed size
      localView.setUint16(26, nameBytes.length, true); // File name length
      localView.setUint16(28, 0, true); // Extra field length
      localArray.set(nameBytes, 30);

      parts.push(localArray);
      parts.push(file.data);

      // Central directory entry
      const centralEntry = new ArrayBuffer(46 + nameBytes.length);
      const centralView = new DataView(centralEntry);
      const centralArray = new Uint8Array(centralEntry);

      centralView.setUint32(0, 0x02014b50, true); // Central directory signature
      centralView.setUint16(4, 20, true); // Version made by
      centralView.setUint16(6, 20, true); // Version needed to extract
      centralView.setUint16(8, 0, true); // General purpose bit flag
      centralView.setUint16(10, 0, true); // Compression method
      centralView.setUint16(12, 0, true); // File last mod time
      centralView.setUint16(14, 0, true); // File last mod date
      centralView.setUint32(16, file.crc, true); // CRC-32
      centralView.setUint32(20, file.data.length, true); // Compressed size
      centralView.setUint32(24, file.data.length, true); // Uncompressed size
      centralView.setUint16(28, nameBytes.length, true); // File name length
      centralView.setUint16(30, 0, true); // Extra field length
      centralView.setUint16(32, 0, true); // File comment length
      centralView.setUint16(34, 0, true); // Disk number start
      centralView.setUint16(36, 0, true); // Internal file attributes
      centralView.setUint32(38, 0, true); // External file attributes
      centralView.setUint32(42, offset, true); // Relative offset of local header
      centralArray.set(nameBytes, 46);

      centralDirectory.push(centralArray);
      offset += 30 + nameBytes.length + file.data.length;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const entry of centralDirectory) {
      parts.push(entry);
      centralDirSize += entry.length;
    }

    // End of central directory record
    const endRecord = new ArrayBuffer(22);
    const endView = new DataView(endRecord);

    endView.setUint32(0, 0x06054b50, true); // End of central directory signature
    endView.setUint16(4, 0, true); // Number of this disk
    endView.setUint16(6, 0, true); // Disk where central directory starts
    endView.setUint16(8, this.files.length, true); // Number of central directory records on this disk
    endView.setUint16(10, this.files.length, true); // Total number of central directory records
    endView.setUint32(12, centralDirSize, true); // Size of central directory
    endView.setUint32(16, centralDirOffset, true); // Offset of start of central directory
    endView.setUint16(20, 0, true); // Comment length

    parts.push(new Uint8Array(endRecord));

    return new Blob(parts as BlobPart[], { type: 'application/epub+zip' });
  }
}

// Convert markdown to basic XHTML
function markdownToXhtml(markdown: string): string {
  let html = markdown
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr/>')
    // Line breaks - convert double newlines to paragraph breaks
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => {
      const trimmed = p.trim();
      // Don't wrap if already a block element
      if (trimmed.startsWith('<h') || trimmed.startsWith('<hr')) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('\n\n');

  return html;
}

// EPUB structure files
const MIMETYPE = 'application/epub+zip';

const CONTAINER_XML = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`;

const STYLES_CSS = `
body {
  font-family: Georgia, serif;
  line-height: 1.6;
  margin: 1em;
  color: #333;
}
h1, h2, h3 {
  font-weight: normal;
  margin-top: 1.5em;
  margin-bottom: 0.5em;
}
h1 {
  font-size: 1.8em;
  text-align: center;
  margin-top: 2em;
}
h2 {
  font-size: 1.4em;
}
h3 {
  font-size: 1.2em;
}
p {
  margin: 0.8em 0;
  text-indent: 1.5em;
}
p:first-of-type {
  text-indent: 0;
}
hr {
  border: none;
  border-top: 1px solid #ccc;
  margin: 2em auto;
  width: 30%;
}
.cover-page {
  text-align: center;
  padding: 0;
  margin: 0;
}
.cover-page img {
  max-width: 100%;
  max-height: 100%;
}
`;

function generateContentOpf(
  title: string,
  author: string,
  chapters: { id: string; title: string }[],
  hasCover: boolean,
  coverMediaType: string
): string {
  const uuid = 'urn:uuid:' + crypto.randomUUID();
  const date = new Date().toISOString().split('T')[0];

  const manifestItems = chapters
    .map(ch => `    <item id="${ch.id}" href="${ch.id}.xhtml" media-type="application/xhtml+xml"/>`)
    .join('\n');

  const spineItems = chapters
    .map(ch => `    <itemref idref="${ch.id}"/>`)
    .join('\n');

  const coverManifest = hasCover ? `
    <item id="cover-image" href="cover.jpg" media-type="${coverMediaType}" properties="cover-image"/>
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/>` : '';

  const coverSpine = hasCover ? `    <itemref idref="cover"/>\n` : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${uuid}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:date>${date}</dc:date>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${coverManifest}
    <item id="css" href="styles.css" media-type="text/css"/>
${manifestItems}
  </manifest>
  <spine>
${coverSpine}${spineItems}
  </spine>
</package>`;
}

function generateNavXhtml(
  title: string,
  chapters: { id: string; title: string }[]
): string {
  const tocItems = chapters
    .map(ch => `      <li><a href="${ch.id}.xhtml">${escapeXml(ch.title)}</a></li>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <nav epub:type="toc">
    <h1>Table of Contents</h1>
    <ol>
${tocItems}
    </ol>
  </nav>
</body>
</html>`;
}

function generateChapterXhtml(title: string, content: string): string {
  const xhtmlContent = markdownToXhtml(content);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body>
  <h1>${escapeXml(title)}</h1>
${xhtmlContent}
</body>
</html>`;
}

function generateCoverXhtml(title: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="styles.css"/>
</head>
<body class="cover-page">
  <img src="cover.jpg" alt="${escapeXml(title)}"/>
</body>
</html>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface EpubOptions {
  seriesId: string;
  title: string;
  author: string;
  chapters: number[];
  cover?: string; // Path to cover image (e.g., "cover.jpg")
}

export async function generateEpub(options: EpubOptions): Promise<Blob> {
  const { seriesId, title, author, chapters, cover } = options;

  // Fetch all chapter content
  const chapterData: { id: string; title: string; content: string }[] = [];

  for (const chapterNum of chapters) {
    const draft = await getChapterDraft(seriesId, chapterNum);
    const chapterTitle = extractTitleFromMarkdown(draft) || `Chapter ${chapterNum}`;
    const content = stripTitleFromMarkdown(draft);

    chapterData.push({
      id: `chapter${chapterNum}`,
      title: chapterTitle,
      content,
    });
  }

  // Fetch cover image if provided
  let coverData: Uint8Array | null = null;
  let coverMediaType = 'image/jpeg';
  if (cover) {
    try {
      const coverUrl = `${API_BASE}/${seriesId}/${cover}`;
      const res = await fetch(coverUrl);
      if (res.ok) {
        const blob = await res.blob();
        coverMediaType = blob.type || 'image/jpeg';
        coverData = new Uint8Array(await blob.arrayBuffer());
      }
    } catch (e) {
      console.warn('Failed to fetch cover image:', e);
    }
  }

  const zip = new ZipWriter();

  // mimetype must be first and uncompressed
  zip.addFile('mimetype', MIMETYPE, false);

  // META-INF
  zip.addFile('META-INF/container.xml', CONTAINER_XML);

  // OEBPS content
  zip.addFile('OEBPS/styles.css', STYLES_CSS);
  zip.addFile('OEBPS/content.opf', generateContentOpf(title, author, chapterData, !!coverData, coverMediaType));
  zip.addFile('OEBPS/nav.xhtml', generateNavXhtml(title, chapterData));

  // Cover image and page
  if (coverData) {
    zip.addFile('OEBPS/cover.jpg', coverData, false);
    zip.addFile('OEBPS/cover.xhtml', generateCoverXhtml(title));
  }

  // Chapters
  for (const chapter of chapterData) {
    const xhtml = generateChapterXhtml(chapter.title, chapter.content);
    zip.addFile(`OEBPS/${chapter.id}.xhtml`, xhtml);
  }

  return zip.generate();
}

export function downloadEpub(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
