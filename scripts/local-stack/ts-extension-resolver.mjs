/**
 * Node runs the geocode backfill as TypeScript. Those files import siblings
 * without a suffix. This resolver tries `.ts` before giving up.
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\.(?:[cm]?[jt]s|json|node)$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      // Keep the original error when the file is not TypeScript.
    }
  }
  return nextResolve(specifier, context);
}
