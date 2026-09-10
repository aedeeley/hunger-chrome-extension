import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { deflateRawSync } from "node:zlib";
const root = resolve(import.meta.dirname, "..");
const files = ["manifest.json", "README.md", "PRIVACY.md", "PUBLISHING.md"];
for (const dir of ["src", "pages", "icons"]) for (const file of await readdir(join(root, dir))) files.push(`${dir}/${file}`);
// Small, dependency-free ZIP writer. Packages only extension assets and docs.
const table = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(data) { let crc = 0xffffffff; for (const byte of data) crc = table[(crc ^ byte) & 255] ^ (crc >>> 8); return (crc ^ 0xffffffff) >>> 0; }
const entries = [], central = []; let offset = 0;
for (const file of files) {
  const content = await readFile(join(root, file)), name = Buffer.from(file), data = deflateRawSync(content), crc = crc32(content);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50); header.writeUInt16LE(20, 4); header.writeUInt16LE(8, 8); header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14); header.writeUInt32LE(data.length, 18); header.writeUInt32LE(content.length, 22); header.writeUInt16LE(name.length, 26);
  entries.push(header, name, data);
  const record = Buffer.alloc(46); record.writeUInt32LE(0x02014b50); record.writeUInt16LE(20, 4); record.writeUInt16LE(20, 6); record.writeUInt16LE(8, 10); record.writeUInt16LE(0x21, 14); record.writeUInt32LE(crc, 16); record.writeUInt32LE(data.length, 20); record.writeUInt32LE(content.length, 24); record.writeUInt16LE(name.length, 28); record.writeUInt32LE(offset, 42);
  central.push(record, name); offset += header.length + name.length + data.length;
}
const directory = Buffer.concat(central), end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
await mkdir(join(root, "dist"), { recursive: true });
const out = join(root, "dist", "hunger-extension.zip");
await writeFile(out, Buffer.concat([...entries, directory, end]));
console.log(`Packaged ${files.length} files: ${out}`);
