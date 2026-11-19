import { runBackfillCli } from '../lib/geo/backfillPropertyGeocodesCli.ts';

const code = await runBackfillCli(process.argv.slice(2));
process.exit(code);
