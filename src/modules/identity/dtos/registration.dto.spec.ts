import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterUserDto } from './registration.dto';

describe('RegisterUserDto', () => {
  it('normalizes identifiers and accepts the V1 password bounds', async () => {
    const dto = plainToInstance(RegisterUserDto, {
      name: '  Jordan Lee ',
      email: ' JORDAN@EXAMPLE.COM ',
      password: 'correct-horse-battery-staple',
      username: 'Jordan_Lee',
      phone: ' 123456 ',
      verifiedEmail: 'JORDAN@EXAMPLE.COM',
    });

    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Jordan Lee',
      email: 'jordan@example.com',
      username: 'jordan_lee',
      phone: '123456',
      verifiedEmail: 'jordan@example.com',
    });
  });

  it('rejects passwords shorter than the Better Auth policy', async () => {
    const dto = plainToInstance(RegisterUserDto, {
      name: 'Jordan',
      email: 'jordan@example.com',
      password: 'short',
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
