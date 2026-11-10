import { inflateRawSync, deflateRawSync } from 'node:zlib';
import { redactText } from '@/lib/hosted-dev/redactText';

export type ZipEntry = { name: string; data: Buffer };

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n += 1) {
  let crc = n;
  for (let k = 0; k < 8; k += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  CRC_TABLE[n] = crc;
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    const index = (crc ^ byte) & 0xff;
    const next = CRC_TABLE[index];
    if (next === undefined) throw new Error('CRC table is incomplete.');
    crc = next ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function isImageBytes(data: Uint8Array): boolean {
  if (
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a
  ) {
    return true;
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return true;
  if (data.length >= 6 && data[0] === 0x47 && data[1] === 0x49 && data[2] === 0x46) return true;
  if (data.length >= 2 && data[0] === 0x42 && data[1] === 0x4d) return true;
  return (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  );
}

/** Drop images by magic bytes. Scrub every other entry, including names with no extension. */
export function redactZipEntry(
  name: string,
  data: Buffer,
  secrets: readonly string[],
): { action: 'drop' } | { action: 'keep'; data: Buffer } {
  if (name.endsWith('/')) return { action: 'keep', data };
  if (isImageBytes(data)) return { action: 'drop' };
  const redacted = redactText(data.toString('latin1'), secrets);
  return { action: 'keep', data: Buffer.from(redacted, 'latin1') };
}

export function readZip(buf: Buffer): ZipEntry[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error('Not a zip archive.');
  const count = buf.readUInt16LE(eocd + 10);
  let cursor = buf.readUInt32LE(eocd + 16);
  const entries: ZipEntry[] = [];
  for (let index = 0; index < count; index += 1) {
    if (buf.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Bad zip central directory.');
    const flags = buf.readUInt16LE(cursor + 8);
    if (flags & 0x1) throw new Error('Encrypted zip entries are not redacted.');
    const method = buf.readUInt16LE(cursor + 10);
    const compressedSize = buf.readUInt32LE(cursor + 20);
    const nameLength = buf.readUInt16LE(cursor + 28);
    const extraLength = buf.readUInt16LE(cursor + 30);
    const commentLength = buf.readUInt16LE(cursor + 32);
    const localOffset = buf.readUInt32LE(cursor + 42);
    if (compressedSize === 0xffffffff || localOffset === 0xffffffff) {
      throw new Error('Zip64 archives are not redacted.');
    }
    const name = buf.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    const localNameLength = buf.readUInt16LE(localOffset + 26);
    const localExtraLength = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buf.subarray(dataStart, dataStart + compressedSize);
    const data =
      method === 0 ? Buffer.from(compressed) : method === 8 ? inflateRawSync(compressed) : null;
    if (!data) throw new Error(`Unsupported zip method ${method}.`);
    entries.push({ name, data });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

export function writeZip(entries: readonly ZipEntry[], method: 0 | 8 = 0): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const stored = method === 0 ? entry.data : deflateRawSync(entry.data);
    const crc = crc32(entry.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(stored.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(20, 6);
    header.writeUInt16LE(method, 10);
    header.writeUInt32LE(crc, 16);
    header.writeUInt32LE(stored.length, 20);
    header.writeUInt32LE(entry.data.length, 24);
    header.writeUInt16LE(name.length, 28);
    header.writeUInt32LE(offset, 42);
    locals.push(local, name, stored);
    central.push(header, name);
    offset += local.length + name.length + stored.length;
  }
  const directory = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(directory.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, eocd]);
}

export function redactZipBuffer(zip: Buffer, secrets: readonly string[]): Buffer {
  const kept: ZipEntry[] = [];
  const omitted: string[] = [];
  for (const entry of readZip(zip)) {
    const result = redactZipEntry(entry.name, entry.data, secrets);
    if (result.action === 'drop') omitted.push(entry.name);
    else kept.push({ name: entry.name, data: result.data });
  }
  if (omitted.length > 0) {
    kept.push({
      name: 'redacted-omitted-binaries.txt',
      data: Buffer.from(`${omitted.join('\n')}\n`),
    });
  }
  return writeZip(kept);
}
