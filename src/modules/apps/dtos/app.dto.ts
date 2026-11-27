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
