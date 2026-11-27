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
project-settings:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/project-settings.ts $(SETTINGS_FILE)
# make project-settings SETTINGS_FILE=docs/examples/project-settings.example.json
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
