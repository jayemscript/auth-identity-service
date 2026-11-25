export class ErrorResponseDto {
  statusCode!: number;
  message!: string;
  code?: string;
  error?: string;
  timestamp!: string;
  path?: string;
  details?: Record<string, any>;
}
