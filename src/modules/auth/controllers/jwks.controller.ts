import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('.well-known')
export class JwksController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('jwks.json')
  async getKeys() {
    const graceSeconds =
      Number(process.env.JWT_ACCESS_EXPIRATION ?? 900) + 60;
    const rows = await this.dataSource.query(
      `SELECT id, public_key, alg, crv FROM auth.jwks
       WHERE expires_at IS NULL OR expires_at + ($1 * interval '1 second') > now()
       ORDER BY created_at DESC`,
      [graceSeconds],
    );
    return {
      keys: rows.map((row: { id: string; public_key: string; alg: string; crv: string }) => ({
        ...JSON.parse(row.public_key),
        kid: row.id,
        alg: row.alg ?? 'ES256',
        ...(row.crv ? { crv: row.crv } : {}),
      })),
    };
  }
}
