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

project-settings:
	pnpm exec ts-node -r tsconfig-paths/register src/modules/system/commands/project-settings.ts $(SETTINGS_FILE)
