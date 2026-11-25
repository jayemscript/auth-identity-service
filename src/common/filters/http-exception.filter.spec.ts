import { ConflictException, Logger } from '@nestjs/common';
import { HttpExceptionFilter } from './http-exception.filter';

const logError = jest
  .spyOn(Logger.prototype, 'error')
  .mockImplementation(() => undefined);

describe('HttpExceptionFilter', () => {
  const filter = new HttpExceptionFilter();
  const response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const request = { method: 'POST', url: '/v1/auth/login' };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => logError.mockRestore());

  it('returns a readable message and preserves a client-facing error code', () => {
    const exception = new ConflictException({
      code: 'SESSION_LIMIT_REACHED',
      message:
        'You have reached the maximum number of active sessions for this app. End another session before signing in again.',
    });

    filter.catch(exception, host as never);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        error: 'Conflict',
        code: 'SESSION_LIMIT_REACHED',
        message:
          'You have reached the maximum number of active sessions for this app. End another session before signing in again.',
        path: '/v1/auth/login',
      }),
    );
  });

  it('does not expose unexpected internal error details', () => {
    filter.catch(new Error('database password leaked'), host as never);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 500,
        message: 'Something went wrong. Please try again later.',
      }),
    );
    expect(JSON.stringify(response.json.mock.calls)).not.toContain(
      'database password leaked',
    );
  });
});
