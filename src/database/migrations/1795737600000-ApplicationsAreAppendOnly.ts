import { MigrationInterface, QueryRunner } from 'typeorm';

export class ApplicationsAreAppendOnly1795737600000 implements MigrationInterface {
  name = 'ApplicationsAreAppendOnly1795737600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION apps.reject_application_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'Application records are immutable. Add a new app with a new slug instead.'
          USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_applications_append_only
      BEFORE UPDATE OR DELETE ON apps.applications
      FOR EACH ROW EXECUTE FUNCTION apps.reject_application_mutation()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_applications_append_only ON apps.applications`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS apps.reject_application_mutation()`,
    );
  }
}
