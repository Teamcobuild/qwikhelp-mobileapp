// Clerk throws { errors: [{ message, longMessage, code }] }; network failures are plain Errors.
export const clerkErrorMessage = (err: any, fallback = "Something went wrong") =>
    err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || fallback;

export const clerkErrorCode = (err: any): string | undefined => err?.errors?.[0]?.code;
