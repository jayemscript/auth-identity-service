import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateAppDto } from './app.dto';

describe('CreateAppDto', () => {
  it('normalizes app slugs and validates nested policy data', async () => {
    const valid = plainToInstance(CreateAppDto, {
      slug: '  Merchant-Mobile ',
      name: 'Merchant Mobile',
      clientType: 'mobile',
      policy: { registrationMode: 'public', maxConcurrentSessions: 5 },
    });
    expect(await validate(valid)).toHaveLength(0);
    expect(valid.slug).toBe('merchant-mobile');

    const invalid = plainToInstance(CreateAppDto, {
      slug: 'merchant-mobile',
      name: 'Merchant Mobile',
      clientType: 'mobile',
      policy: { registrationMode: 'open', maxConcurrentSessions: 0 },
    });
    expect(await validate(invalid)).not.toHaveLength(0);
  });
});
