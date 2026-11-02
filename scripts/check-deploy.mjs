// Production deploys must have the central freeze wired: without these secrets the central
// check silently turns off (or the internal API stays closed) and frozen accounts could act.
import { execSync } from 'node:child_process';
const out = execSync('npx wrangler secret list --format json 2>/dev/null || echo "[]"', { encoding: 'utf8' });
const names = JSON.parse(out).map(s => s.name);
const missing = ['INTERNAL_API_SECRETS', 'ACCOUNT_STATUS_TOKEN', 'FREEZE_FEE_TOKEN'].filter(n => !names.includes(n));
if (missing.length) {
  console.error(`Missing secrets: ${missing.join(', ')}. INTERNAL_API_SECRETS = the per-service JSON map; ACCOUNT_STATUS_TOKEN = Banking's ACCOUNT_STATUS_SECRET value. Refusing to deploy with the account freeze off.`);
  process.exit(1);
}
console.log('deploy check ok: account freeze is wired');
