import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { redactText, secretsFromEnv } from '../../lib/hosted-dev/redactText.ts';

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

function redactZip(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('python3', ['-c', PYTHON, filePath], {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, HOSTED_DEV_REDACT_SECRETS: secrets.join('\n') },
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`trace redaction failed for ${path.basename(filePath)}`));
    });
  });
}

const PYTHON = String.raw`
import os, sys, zipfile, tempfile, shutil, re
path = sys.argv[1]
secrets = [s for s in os.environ.get("HOSTED_DEV_REDACT_SECRETS", "").split("\n") if s]
secrets.sort(key=len, reverse=True)
email = re.compile(rb"[A-Z0-9._%+\-]+@[A-Z0-9.\-]+\.[A-Z]{2,}", re.I)
jwt = re.compile(rb"eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}")
stripe = re.compile(rb"(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]+")
webhook = re.compile(rb"whsec_[A-Za-z0-9]+")
supabase_secret = re.compile(rb"sb_secret_[A-Za-z0-9_\-]+")
postgres = re.compile(rb"postgres(?:ql)?://\S+")
text_ext = (".json", ".txt", ".log", ".md", ".html", ".htm", ".har", ".trace", ".network", ".stacks", ".yml")
binary_ext = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp")
tmp = tempfile.mkdtemp()
out = os.path.join(tmp, "redacted.zip")
omitted = []
with zipfile.ZipFile(path, "r") as src, zipfile.ZipFile(out, "w") as dst:
    for info in src.infolist():
        name = info.filename.lower()
        if name.endswith(binary_ext):
            omitted.append(info.filename)
            continue
        data = src.read(info.filename)
        if name.endswith(text_ext) or name.endswith(".trace"):
            for secret in secrets:
                data = data.replace(secret.encode(), b"[redacted]")
            data = postgres.sub(b"[redacted-database-url]", data)
            data = stripe.sub(b"[redacted-stripe]", data)
            data = webhook.sub(b"[redacted-webhook]", data)
            data = supabase_secret.sub(b"[redacted-supabase-secret]", data)
            data = jwt.sub(b"[redacted-jwt]", data)
            data = email.sub(b"[redacted-email]", data)
        dst.writestr(info, data)
    if omitted:
        dst.writestr("redacted-omitted-binaries.txt", "\n".join(omitted).encode())
os.replace(out, path)
shutil.rmtree(tmp)
`;

for (const filePath of await walk(root)) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.zip') {
    await redactZip(filePath);
    continue;
  }
  if (!textExtensions.has(extension)) continue;
  const original = await readFile(filePath, 'utf8');
  const redacted = redactText(original, secrets);
  if (redacted !== original) await writeFile(filePath, redacted);
}
