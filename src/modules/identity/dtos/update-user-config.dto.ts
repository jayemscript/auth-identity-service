import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateUserConfigDto {
  @IsOptional()
  @IsBoolean()
  canCreateUsers?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  sessionLimitOverride?: number | null;
}

export class UserConfigResponseDto {
  userId!: string;
  canCreateUsers!: boolean;
  sessionLimitOverride!: number | null;
}

export class UserApplicationAccessResponseDto {
  id!: string;
  userId!: string;
  appId!: string;
  status!: string;
  grantSource!: string;
  grantedByUserId!: string | null;
  grantedAt!: Date;
  revokedAt!: Date | null;
}
