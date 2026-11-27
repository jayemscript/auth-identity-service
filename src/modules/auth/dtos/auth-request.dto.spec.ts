import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ListSessionsQueryDto, VerifyTokenRequestDto } from './auth-request.dto';

describe('auth request DTOs', () => {
  it('rejects unsupported token types', async () => {
    const dto = plainToInstance(VerifyTokenRequestDto, {
      token: 'token',
      tokenType: 'id',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('transforms and validates session pagination values', async () => {
    const valid = plainToInstance(ListSessionsQueryDto, {
      limit: '30',
      offset: '10',
      status: 'expired',
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid).toMatchObject({ limit: 30, offset: 10, status: 'expired' });

    const invalid = plainToInstance(ListSessionsQueryDto, { limit: '1000' });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
