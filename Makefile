generate_migration:
	npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:generate -d src/database/data-source.ts src/database/migrations/$(name)

empty_migration:
	npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:create src/database/migrations/$(name)

run_migration:
	npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:run -d src/database/data-source.ts

show_migration:
	npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:show -d src/database/data-source.ts

revert_migration:
	npx ts-node -r tsconfig-paths/register ./node_modules/typeorm/cli.js migration:revert -d src/database/data-source.ts

build:
	pnpm build
dev:
	pnpm start:dev
prod:
	pnpm build && pnpm start

bootstrap:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/bootstrap.ts $(SEED_FILE)
# make bootstrap SEED_FILE=docs/examples/bootstrap.seed.example.json
# Apply deployment-wide policy settings after migrations and bootstrap.
# Example: make project-settings SETTINGS_FILE=docs/examples/project-settings.example.json
project-settings:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/project-settings.ts $(SETTINGS_FILE)

# Apply developer-managed, app-scoped IP and email-domain rules after migrations and bootstrap.
# Example: make security-rules RULES_FILE=docs/examples/security-rules.example.json
# In a rules file, omitted rule lists are left unchanged and [] clears that list for the app.
security-rules:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/security-rules.ts $(RULES_FILE)

# Apply developer-managed webhook endpoint subscriptions after migrations and bootstrap.
# Example: make webhook-endpoints ENDPOINTS_FILE=docs/examples/webhook-endpoints.example.json
# Each file replaces the active endpoint set for each listed app. Use a new key when changing a URL.
webhook-endpoints:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/events/commands/webhook-endpoints.ts $(ENDPOINTS_FILE)
issue-app-credential:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/app-credentials.ts issue $(APP_SLUG) $(CREDENTIAL_NAME) $(SCOPES) $(EXPIRES_AT)
# make issue-app-credential APP_SLUG=public-ecommerce-web CREDENTIAL_NAME=public-ecommerce-web SCOPES=auth:login,tokens:verify,tokens:refresh,users:register
revoke-app-credential:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/app-credentials.ts revoke $(APP_SLUG) $(CREDENTIAL_ID)

test-e2e:
	pnpm test:e2e

test-e2e-serial:
	pnpm test:e2e:serial

test-e2e-file:
	pnpm test:e2e:one -- $(FILE)

test-e2e-safety:
	pnpm test:e2e:safety
