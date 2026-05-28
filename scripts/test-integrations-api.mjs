#!/usr/bin/env node
/**
 * Local integration test helper for Pro API keys + webhooks.
 * Usage: node scripts/test-integrations-api.mjs [--setup-billing]
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createHash, createHmac, randomBytes } from 'crypto';

function loadEnvLocal() {
  const path = resolve(process.cwd(), '.env.local');
  const raw = readFileSync(path, 'utf8');
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function hashSecret(value) {
  return createHash('sha256').update(value).digest('hex');
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? 'lvh.me:3000';
  const setupBilling = process.argv.includes('--setup-billing');

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const apiBase = `http://${domain}/api/v1`;

  console.log('\n=== cleanScheduler Integrations test ===\n');

  const { error: tableErr } = await admin.from('tenant_api_keys').select('id').limit(1);
  if (tableErr) {
    console.error('❌ tenant_api_keys table missing or inaccessible.');
    console.error(
      '   Apply supabase/migrations/0040_tenant_api_webhooks.sql in Supabase SQL editor first.',
    );
    console.error('   Error:', tableErr.message);
    process.exit(1);
  }
  console.log('✓ Migration 0040 tables reachable');

  const { data: billingRows, error: billingErr } = await admin
    .from('tenant_billing_accounts')
    .select('tenant_id, platform_plan, status, activated_at, tenants ( slug, name )')
    .order('created_at', { ascending: false })
    .limit(10);

  if (billingErr) {
    console.error('Could not load billing accounts:', billingErr.message);
    process.exit(1);
  }

  console.log('\nRecent workspaces:');
  for (const row of billingRows ?? []) {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    console.log(
      `  - ${tenant?.slug ?? '?'} (${tenant?.name ?? '?'}) plan=${row.platform_plan} status=${row.status}`,
    );
  }

  let target =
    billingRows?.find((r) => r.platform_plan === 'pro' && r.status === 'active') ??
    billingRows?.find((r) => r.platform_plan === 'pro' && r.status === 'past_due') ??
    billingRows?.find((r) => r.platform_plan === 'pro') ??
    billingRows?.[0];

  if (!target) {
    console.error(
      '\n❌ No tenant_billing_accounts rows found. Create a workspace via /start-trial first.',
    );
    process.exit(1);
  }

  const tenant = Array.isArray(target.tenants) ? target.tenants[0] : target.tenants;
  const tenantId = target.tenant_id;
  const slug = tenant?.slug ?? 'unknown';

  if (setupBilling) {
    console.log(`\n⚙️  Setting ${slug} to Pro + active for API test…`);
    const { error: upErr } = await admin
      .from('tenant_billing_accounts')
      .update({
        platform_plan: 'pro',
        status: 'active',
        activated_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId);
    if (upErr) {
      console.error('Billing update failed:', upErr.message);
      process.exit(1);
    }
    target = { ...target, platform_plan: 'pro', status: 'active' };
    console.log('✓ Billing updated (test only — revert manually if needed)');
  }

  const paidOk = target.status === 'active' || target.status === 'past_due';
  const proOk = target.platform_plan === 'pro';
  if (!proOk || !paidOk) {
    console.log(
      `\n⚠️  ${slug} is plan=${target.platform_plan} status=${target.status} — API will return 403.`,
    );
    console.log('   Re-run with --setup-billing to temporarily set Pro + active for this tenant.');
  }

  const random = randomBytes(24).toString('base64url');
  const fullKey = `cs_live_${random}`;
  const keyPrefix = fullKey.slice(0, 16);
  const keyHash = hashSecret(fullKey);
  const keyName = `integration-test-${new Date().toISOString().slice(0, 19)}`;

  const { data: keyRow, error: keyErr } = await admin
    .from('tenant_api_keys')
    .insert({
      tenant_id: tenantId,
      name: keyName,
      key_prefix: keyPrefix,
      key_hash: keyHash,
    })
    .select('id')
    .single();

  if (keyErr) {
    console.error('\n❌ Could not insert test API key:', keyErr.message);
    process.exit(1);
  }

  console.log(`\n✓ Created test API key for ${slug}`);
  console.log(`  Key (save for manual calls): ${fullKey}`);

  const endpoints = [`${apiBase}/quotes?limit=3`, `${apiBase}/customers?limit=3`];

  console.log('\n--- REST API ---');
  for (const endpoint of endpoints) {
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${fullKey}` },
    });
    const body = await res.json();
    const count = Array.isArray(body.data) ? body.data.length : 0;
    console.log(`${res.status} GET ${endpoint.replace(apiBase, '/api/v1')} → ${count} row(s)`);
    if (!res.ok) {
      console.log('   ', body.error ?? body);
    }
  }

  const webhookSecret = `whsec_${randomBytes(24).toString('base64url')}`;
  const webhookUrl = process.env.WEBHOOK_TEST_URL?.trim();
  let endpointId = null;

  if (webhookUrl) {
    const { data: whRow, error: whErr } = await admin
      .from('tenant_webhook_endpoints')
      .insert({
        tenant_id: tenantId,
        url: webhookUrl,
        description: 'Integration test endpoint',
        signing_secret: webhookSecret,
        signing_secret_prefix: webhookSecret.slice(0, 12),
        event_types: ['quote.sent'],
        enabled: true,
      })
      .select('id')
      .single();

    if (whErr) {
      console.error('\n❌ Webhook endpoint insert failed:', whErr.message);
    } else {
      endpointId = whRow.id;
      console.log(`\n✓ Registered webhook → ${webhookUrl}`);
    }
  } else {
    console.log('\n--- Webhooks ---');
    console.log(
      '   Skip (set WEBHOOK_TEST_URL in .env.local to test delivery, e.g. webhook.site URL)',
    );
  }

  const testPayload = {
    id: crypto.randomUUID(),
    type: 'quote.sent',
    created_at: new Date().toISOString(),
    data: {
      quote_id: 'test_quote_id',
      customer_id: 'test_customer_id',
      title: 'Integration test payload',
      status: 'sent',
      test: true,
    },
  };

  if (endpointId && webhookUrl) {
    const { data: delivery, error: delErr } = await admin
      .from('tenant_webhook_deliveries')
      .insert({
        tenant_id: tenantId,
        endpoint_id: endpointId,
        event_type: 'quote.sent',
        event_id: testPayload.id,
        payload: testPayload,
        status: 'pending',
      })
      .select('id')
      .single();

    if (delErr) {
      console.error('Delivery enqueue failed:', delErr.message);
    } else {
      const body = JSON.stringify(testPayload);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', webhookSecret)
        .update(`${timestamp}.${body}`)
        .digest('hex');

      const whRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CleanScheduler-Signature': `t=${timestamp},v1=${signature}`,
        },
        body,
      });
      console.log(`   Direct POST to webhook: HTTP ${whRes.status}`);
      await admin
        .from('tenant_webhook_deliveries')
        .update({
          status: whRes.ok ? 'delivered' : 'failed',
          http_status: whRes.status,
          delivered_at: whRes.ok ? new Date().toISOString() : null,
          attempt_count: 1,
        })
        .eq('id', delivery.id);
    }
  }

  console.log('\n--- UI test ---');
  console.log(`   1. Open http://${slug}.${domain}/settings/integrations`);
  console.log('   2. Confirm the test API key appears (or create one in UI)');
  console.log('   3. Add a webhook URL and click “Send test”');
  console.log('\n--- Cleanup (optional) ---');
  console.log(`   Revoke test key id=${keyRow.id} from Integrations settings`);
  if (endpointId) console.log(`   Delete webhook endpoint id=${endpointId}`);
  console.log('');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
