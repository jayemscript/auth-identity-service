import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { AppDataSource } from '../../../database/data-source';

type RuleSet = {
  appSlug: string;
  ipRules?: Array<{ type: 'allow' | 'block'; operation: 'login' | 'registration'; network: string; expiresAt?: string }>;
  emailDomainRules?: Array<{ type: 'allow' | 'block'; domain: string; expiresAt?: string }>;
};

function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase().replace(/^@/, '');
  if (!domain || domain.includes('@') || !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(domain))
    throw new Error(`Invalid email domain ${value}`);
  return domain;
}

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('Usage: make security-rules RULES_FILE=path');
  const config = JSON.parse(await readFile(path, 'utf8')) as { apps: RuleSet[] };
  if (!Array.isArray(config.apps) || config.apps.length === 0)
    throw new Error('Rules file must contain a non-empty apps array.');
  await AppDataSource.initialize();
  try {
    await AppDataSource.transaction(async (tx) => {
      for (const appRules of config.apps) {
        const [app] = await tx.query(`SELECT id FROM apps.applications WHERE slug = $1 AND status = 'active'`, [appRules.appSlug.trim().toLowerCase()]);
        if (!app) throw new Error(`Active app ${appRules.appSlug} was not found.`);
        if (appRules.ipRules !== undefined) {
          await tx.query(`DELETE FROM security.ip_rules WHERE application_id = $1`, [app.id]);
          for (const rule of appRules.ipRules) {
            if (!['allow', 'block'].includes(rule.type) || !['login', 'registration'].includes(rule.operation)) throw new Error('Invalid IP rule type or operation.');
            await tx.query(`INSERT INTO security.ip_rules(application_id, effect, operation, network, expires_at) VALUES ($1,$2,$3,$4,$5)`, [app.id, rule.type === 'block' ? 'deny' : 'allow', rule.operation, rule.network, rule.expiresAt ?? null]);
          }
        }
        if (appRules.emailDomainRules !== undefined) {
          await tx.query(`DELETE FROM security.email_domain_rules WHERE application_id = $1`, [app.id]);
          for (const rule of appRules.emailDomainRules) {
            if (!['allow', 'block'].includes(rule.type)) throw new Error('Invalid email domain rule type.');
            await tx.query(`INSERT INTO security.email_domain_rules(application_id, effect, domain, expires_at) VALUES ($1,$2,$3,$4)`, [app.id, rule.type === 'block' ? 'deny' : 'allow', normalizeDomain(rule.domain), rule.expiresAt ?? null]);
          }
        }
      }
    });
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not apply security rules.');
  process.exitCode = 1;
});
