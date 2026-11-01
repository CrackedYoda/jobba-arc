export type ApiSuccess<T> = { data: T; requestId?: string };

export type ApiFailure = {
  error: { code: string; message: string; details?: unknown };
  requestId?: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export function success<T>(data: T, requestId?: string): ApiSuccess<T> {
  return requestId ? { data, requestId } : { data };
}

export function failure(
  code: string,
  message: string,
  details?: unknown,
  requestId?: string,
): ApiFailure {
  return {
    error: { code, message, ...(details === undefined ? {} : { details }) },
    ...(requestId ? { requestId } : {}),
  };
}
