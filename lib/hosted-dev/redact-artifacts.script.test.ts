import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { isImageBytes, readZip, writeZip } from '@/lib/hosted-dev/redactZip';

const execFileAsync = promisify(execFile);

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

describe('redact-artifacts script', () => {
  it('redacts a sample zip when invoked the same way as the suite', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'hosted-dev-redact-'));
    try {
      await writeFile(
        path.join(directory, 'trace.zip'),
        writeZip([
          {
            name: 'resources/abc123deadbeef',
            data: Buffer.from('password=shortpw Authorization: Basic dXNlcjpwYXNz'),
          },
          { name: 'resources/78485ad26ab49de2007fe98b0854715a58aaf5b6', data: PNG },
          { name: 'resources/page-shot', data: JPEG },
        ]),
      );
      await execFileAsync(process.execPath, ['scripts/hosted-dev/redact-artifacts.mts'], {
        cwd: process.cwd(),
        env: { ...process.env, HOSTED_DEV_RESULTS_DIR: directory, QA_PASSWORD: 'shortpw' },
      });
      const entries = readZip(await readFile(path.join(directory, 'trace.zip')));
      const names = entries.map((entry) => entry.name);
      expect(names).toContain('redacted-omitted-binaries.txt');
      expect(names).not.toContain('resources/78485ad26ab49de2007fe98b0854715a58aaf5b6');
      expect(names).not.toContain('resources/page-shot');
      expect(entries.some((entry) => isImageBytes(entry.data))).toBe(false);
      const text = entries
        .find((entry) => entry.name === 'resources/abc123deadbeef')
        ?.data.toString('utf8');
      expect(text).not.toContain('shortpw');
      expect(text).not.toContain('dXNlcjpwYXNz');
      expect(await readFile(path.join(directory, '.redaction-complete'), 'utf8')).toBe('ok\n');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
