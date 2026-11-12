import { register } from 'node:module';
import { readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

register(new URL('./ts-resolver.mts', import.meta.url));
const { redactText, secretsFromEnv } = await import('../../lib/hosted-dev/redactText.ts');
const { redactZipBuffer } = await import('../../lib/hosted-dev/redactZip.ts');

const root = process.env.HOSTED_DEV_RESULTS_DIR?.trim() || 'hosted-dev-results';
const secrets = secretsFromEnv(process.env);
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const markerPath = path.join(root, '.redaction-complete');

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

async function deleteUnredacted(files: string[]): Promise<void> {
  await Promise.all(
    files
      .filter((filePath) => {
        const extension = path.extname(filePath).toLowerCase();
        return (
          extension === '.zip' ||
          extension === '.png' ||
          extension === '.jpg' ||
          extension === '.jpeg' ||
          extension === '.gif' ||
          extension === '.webp'
        );
      })
      .map((filePath) => rm(filePath, { force: true })),
  );
}

const files = await walk(root);
await rm(markerPath, { force: true });
let uncovered = false;
try {
  for (const filePath of files) {
    if (filePath === markerPath) continue;
    const extension = path.extname(filePath).toLowerCase();
    if (imageExtensions.has(extension)) continue;
    if (extension === '.zip') {
      const original = await readFile(filePath);
      await writeFile(filePath, redactZipBuffer(original, secrets));
      continue;
    }
    const original = await readFile(filePath);
    if (original.includes(0)) {
      uncovered = true;
      continue;
    }
    const text = original.toString('utf8');
    const redacted = redactText(text, secrets);
    if (redacted !== text) await writeFile(filePath, redacted);
  }
} catch (error) {
  await deleteUnredacted(files);
  console.error(error instanceof Error ? error.message : 'Trace redaction failed.');
  process.exit(1);
}
if (uncovered) {
  await deleteUnredacted(files);
  console.error('Trace redaction did not cover every artifact.');
  process.exit(1);
}
await writeFile(markerPath, 'ok\n');
