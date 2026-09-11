/** Resolves DSL navigation against the configured application root and blocks cross-origin navigation by default. */
export function resolveDeclarativeNavigationUrl(configuredUiBaseUrl: string, requestedUrl: string): string {
  const base = new URL(configuredUiBaseUrl);
  const appRootPath = ensureTrailingSlash(base.pathname || '/');
  const appRoot = new URL(appRootPath, base.origin);

  if (/^https?:\/\//i.test(requestedUrl)) {
    const absolute = new URL(requestedUrl);
    if (absolute.origin !== base.origin && process.env.DECLARATIVE_ALLOW_EXTERNAL_NAVIGATION !== 'true') {
      throw new Error(
        `Declarative scenario blocked cross-origin navigation to ${absolute.origin}. ` +
        'Use TypeScript for cross-origin workflows or explicitly set DECLARATIVE_ALLOW_EXTERNAL_NAVIGATION=true after security review.',
      );
    }
    return absolute.toString();
  }

  if (!requestedUrl.startsWith('/') && !requestedUrl.startsWith('./')) {
    throw new Error(`Declarative goto '${requestedUrl}' must be app-relative (/path, ./path) or an http(s) URL.`);
  }

  if (requestedUrl.startsWith('/') && requestedUrl !== '/' && requestedUrl.startsWith(appRootPath)) {
    return new URL(requestedUrl, base.origin).toString();
  }

  const relative = requestedUrl === '/' ? './' : requestedUrl.replace(/^\//, '');
  return new URL(relative, appRoot).toString();
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
