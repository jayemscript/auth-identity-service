import { IsString, MinLength } from 'class-validator';

export class AppAccessCheckDto {
  @IsString()
  @MinLength(1)
  userId!: string;
}

export class AppAccessCheckResponseDto {
  allowed!: boolean;
}
