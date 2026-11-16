/**
 * `psql` `\quit 1` exits 0. PostgreSQL ignores the extra argument, so a script
 * that prints FAIL or BLOCKED and then `\quit` is a pass unless the runner
 * reads the output. A non-zero status with no verdict line is also a failure.
 * The message is only the verdict line, not the rest of the client output.
 */
export function directSqlRlsOutcome(input: {
  exitCode: number | null;
  stdout: string;
  stderr: string;
}): { ok: true } | { ok: false; message: string } {
  const verdict = verdictLine(`${input.stdout}\n${input.stderr}`);
  if (verdict) return { ok: false, message: verdict };
  if (input.exitCode !== 0) {
    return { ok: false, message: 'FAIL: direct SQL RLS did not finish cleanly.' };
  }
  return { ok: true };
}

function verdictLine(output: string): string | null {
  for (const raw of output.split('\n')) {
    const line = raw.trim();
    const blocked = line.indexOf('BLOCKED:');
    const failed = line.indexOf('FAIL:');
    const candidates = [blocked, failed].filter((index) => index >= 0);
    if (candidates.length === 0) continue;
    const start = Math.min(...candidates);
    return line
      .slice(start)
      .replace(/["']+$/, '')
      .slice(0, 400);
  }
  return null;
}
