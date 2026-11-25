import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AppPolicyDto {
  @IsOptional()
  @IsIn(['public', 'operator_only', 'disabled'])
  registrationMode?: 'public' | 'operator_only' | 'disabled';

  @IsOptional()
  @IsBoolean()
  emailVerificationRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  idleTimeoutSeconds?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxConcurrentSessions?: number;
}

export class CreateAppDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{1,62}$/)
  slug!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  clientType!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AppPolicyDto)
  policy?: AppPolicyDto;
}

export class UpdateAppDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(80)
  clientType?: string;

  @IsOptional()
  @IsIn(['active', 'disabled'])
  status?: 'active' | 'disabled';

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => AppPolicyDto)
  policy?: AppPolicyDto;
}

export class ApplicationResponseDto {
  id!: string;
  slug!: string;
  name!: string;
  clientType!: string;
  status!: string;
  policy!: Record<string, unknown>;
  createdAt!: Date;
  updatedAt!: Date;
}
