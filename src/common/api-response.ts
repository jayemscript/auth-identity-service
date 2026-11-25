export class ApiResponseDto<T> {
  constructor(
    public readonly message: string,
    public readonly data: T,
  ) {}
}

export function successResponse<T>(
  message: string,
  data: T,
): ApiResponseDto<T> {
  return new ApiResponseDto(message, data);
}
