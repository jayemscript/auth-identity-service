import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class LoginRequestDto {
  @IsString()
  @MinLength(1)
  @MaxLength(320)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class VerifyTokenRequestDto {
  @IsString()
  @MinLength(1)
  token!: string;

  @IsIn(['access', 'refresh'])
  tokenType!: 'access' | 'refresh';
}

export class RefreshTokenRequestDto {
  @IsString()
  @MinLength(1)
  refreshToken!: string;
}

export class ListSessionsQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 20 : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 20;

  @IsOptional()
  @Transform(({ value }) => (value === undefined ? 0 : Number(value)))
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset = 0;

  @IsOptional()
  @IsIn(['active', 'revoked', 'expired', 'all'])
  status: 'active' | 'revoked' | 'expired' | 'all' = 'active';
}

export class AuthTokenPairResponseDto {
  sessionId!: string;
  accessToken!: string;
  refreshToken!: string;
  accessTokenExpiresAt!: string;
  refreshTokenExpiresAt!: string;
}

export class VerifyTokenResponseDto {
  active!: boolean;
  userId?: string;
  appId?: string;
  sessionId?: string;
  expiresAt?: string | null;
}

export class SessionResponseDto {
  id!: string;
  status!: 'active' | 'revoked' | 'expired';
  createdAt!: Date;
  lastRefreshAt!: Date | null;
  idleExpiresAt!: Date;
  hardExpiresAt!: Date;
}
