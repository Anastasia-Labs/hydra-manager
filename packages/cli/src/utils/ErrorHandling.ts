import { Effect } from "effect";

/**
 * Standard error handling utility for Effect wrappers
 *
 * @param error The error to handle
 * @param context Context information about the operation (e.g., "connecting to node")
 * @param specificErrorHandlers Optional specific error handlers for known error types
 * @returns A standardized Error object
 */
export function handleEffectError(
  error: unknown,
  context: string,
  specificErrorHandlers?: {
    condition: (error: Error) => boolean;
    message: string;
  }[],
): Error {
  if (error instanceof Error) {
    // Check for specific error conditions first
    if (specificErrorHandlers) {
      for (const handler of specificErrorHandlers) {
        if (handler.condition(error)) {
          return new Error(handler.message);
        }
      }
    }

    // Standard error with context
    return new Error(`Error ${context}: ${error.message}`);
  }

  // Try to stringify non-Error objects
  const errorString = typeof error === "string" ? error : JSON.stringify(error);
  if (errorString) {
    return new Error(`Error ${context}: ${errorString}`);
  }

  // Generic fallback
  return new Error(`Unknown error ${context}`);
}

/**
 * Creates a standardized tryPromise with error handling
 *
 * @param promiseFn The promise-returning function to execute
 * @param context Context information about the operation
 * @param specificErrorHandlers Optional specific error handlers for known error types
 * @returns An Effect with standardized error handling
 */
export function tryPromiseWithErrorHandling<T>(
  promiseFn: () => Promise<T>,
  context: string,
  specificErrorHandlers?: {
    condition: (error: Error) => boolean;
    message: string;
  }[],
) {
  return Effect.tryPromise({
    try: promiseFn,
    catch: (error) => handleEffectError(error, context, specificErrorHandlers),
  });
}

/**
 * Creates a standardized try with error handling for synchronous functions
 *
 * @param tryFn The synchronous function to execute
 * @param context Context information about the operation
 * @param specificErrorHandlers Optional specific error handlers for known error types
 * @returns An Effect with standardized error handling
 */
export function tryWithErrorHandling<T>(
  tryFn: () => T,
  context: string,
  specificErrorHandlers?: {
    condition: (error: Error) => boolean;
    message: string;
  }[],
) {
  return Effect.try({
    try: tryFn,
    catch: (error) => handleEffectError(error, context, specificErrorHandlers),
  });
}
