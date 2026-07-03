export type MetaErrorDetails = {
  message: string;
  type?: string;
  code?: number;
  subcode?: number;
  userTitle?: string;
  userMessage?: string;
  fbtraceId?: string;
  isTransient?: boolean;
};

type RawMetaError = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  error_user_title?: string;
  error_user_msg?: string;
  fbtrace_id?: string;
  is_transient?: boolean;
};

export function parseMetaErrorPayload(data: {
  error?: RawMetaError;
}): MetaErrorDetails | null {
  const error = data.error;
  if (!error?.message) return null;

  return {
    message: error.message,
    type: error.type,
    code: error.code,
    subcode: error.error_subcode,
    userTitle: error.error_user_title,
    userMessage: error.error_user_msg,
    fbtraceId: error.fbtrace_id,
    isTransient: error.is_transient,
  };
}

export function formatMetaErrorForUser(details: MetaErrorDetails): string {
  const parts: string[] = [];
  if (details.userTitle) parts.push(details.userTitle);
  if (details.userMessage) parts.push(details.userMessage);
  if (parts.length === 0) parts.push(details.message);
  if (details.code) parts.push(`(kod: ${details.code}${details.subcode ? ` / ${details.subcode}` : ""})`);
  return parts.join(" — ");
}
