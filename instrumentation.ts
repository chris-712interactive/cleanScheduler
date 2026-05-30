export async function register() {
  if (process.env.DEBUG_PERF === '1') {
    console.info('[portal-perf] DEBUG_PERF=1 — server timing logs enabled');
  }
}
