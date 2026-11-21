/** An error from the API, carrying the backend's error code. */
export class ApiError extends Error {
  constructor(public readonly code: string) {
    super(code)
  }
}

/**
 * Calls the backend. Returns the JSON body, or throws an ApiError with the backend's code.
 * The Vite dev server forwards /api/... to the backend.
 */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR') // no response at all, e.g. the backend is down
  }

  const body = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(body?.code ?? 'UNKNOWN_ERROR')
  return body as T
}
