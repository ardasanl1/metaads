export type MetaApiErrorPayload = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export function extractMetaErrorMessage(
  data: { error?: MetaApiErrorPayload },
  fallback = "Meta API isteği başarısız oldu",
): string {
  const error = data.error;
  if (!error?.message) return fallback;

  if (error.code) {
    return `${error.message} (kod: ${error.code})`;
  }

  return error.message;
}
