export function getErrorMessage(error: unknown): string {
  if (!error) return 'An unknown error occurred.';
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'An unexpected error occurred. Please try again.';
}
