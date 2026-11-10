const repoRoot = new URL('../../', import.meta.url);

function withTypeScriptExtension(specifier) {
  if (
    specifier.endsWith('.ts') ||
    specifier.endsWith('.js') ||
    specifier.endsWith('.mjs') ||
    specifier.endsWith('.json')
  ) {
    return specifier;
  }
  return `${specifier}.ts`;
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@/')) {
    return nextResolve(
      new URL(withTypeScriptExtension(specifier.slice(2)), repoRoot).href,
      context,
    );
  }
  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return nextResolve(withTypeScriptExtension(specifier), context);
  }
  return nextResolve(specifier, context);
}
