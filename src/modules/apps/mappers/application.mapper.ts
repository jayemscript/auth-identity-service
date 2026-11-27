export interface ApplicationRow {
  id: string;
  slug: string;
  name: string;
  client_type: string;
  status: string;
  policy: Record<string, unknown>;
  effective_policy?: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export class ApplicationMapper {
  static toResponse(row: ApplicationRow): ApplicationResponseDto {
    return Object.assign(new ApplicationResponseDto(), {
      id: row.id,
      slug: row.slug,
      name: row.name,
      clientType: row.client_type,
      status: row.status,
      policy: row.policy,
      effectivePolicy: row.effective_policy ?? row.policy,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  }
}
import { ApplicationResponseDto } from '../dtos';

