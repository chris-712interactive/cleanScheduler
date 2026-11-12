const SIGN_IN_QUERY_ERRORS: Record<string, string> = {
  masquerade_handoff:
    'Support sign-in did not complete. Start support again from the admin tenant page.',
};

/** Map known sign-in query codes to a sentence. Other values are shown as given. */
export function signInQueryErrorMessage(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return SIGN_IN_QUERY_ERRORS[raw] ?? raw;
}
