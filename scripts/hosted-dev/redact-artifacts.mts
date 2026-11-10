import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { redactText, secretsFromEnv } from '../../lib/hosted-dev/redactText.ts';
import { redactZipBuffer } from '../../lib/hosted-dev/redactZip.ts';

const root = 'hosted-dev-results';
const secrets = secretsFromEnv(process.env);
const textExtensions = new Set(['.json', '.md', '.txt', '.log', '.yml', '.html', '.htm', '.har']);

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(fullPath)));
    else files.push(fullPath);
  }
  return files;
}

for (const filePath of await walk(root)) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.zip') {
    const original = await readFile(filePath);
    await writeFile(filePath, redactZipBuffer(original, secrets));
    continue;
  }
  if (!textExtensions.has(extension)) continue;
  const original = await readFile(filePath, 'utf8');
  const redacted = redactText(original, secrets);
  if (redacted !== original) await writeFile(filePath, redacted);
}
