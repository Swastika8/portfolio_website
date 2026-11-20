export const siteSecurityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

export const errorPageHeaders = {
  ...siteSecurityHeaders,
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Portfolio-Error': '1',
  'X-Robots-Tag': 'noindex',
};

const messages = new Map([
  [400, ['That request didn’t go through', 'Check the address or the information you sent, then try again.']],
  [401, ['Sign in to continue', 'This part of the portfolio requires a sign-in.']],
  [403, ['This page is restricted', 'Choose a public page to keep exploring.']],
  [404, ['Page not found', 'This page may have moved, or the address may be out of date.']],
  [405, ['That action isn’t available', 'Open the page directly from the notebook.']],
  [408, ['The request timed out', 'The request took too long. Try opening the page again.']],
  [409, ['The page has changed', 'Open the current page before trying that action again.']],
  [410, ['This page has been removed', 'Head back to the notebook for the current projects and writing.']],
  [413, ['That request is too large', 'Send less text or data and try again.']],
  [415, ['That format isn’t supported', 'Check the format of what you sent before trying again.']],
  [421, ['This address isn’t served here', 'Use the address where you originally opened the portfolio.']],
  [429, ['Too many attempts', 'Give it a few minutes before trying again.']],
  [431, ['The request headers are too large', 'Try opening the portfolio in a private window.']],
  [500, ['Something went wrong', 'The portfolio couldn’t finish loading this page. Try again in a moment.']],
  [502, ['The server couldn’t respond', 'A service the portfolio relies on didn’t respond correctly. Try again in a moment.']],
  [503, ['Temporarily unavailable', 'The portfolio is taking a short break. Try again in a moment.']],
  [504, ['The server took too long', 'The page didn’t finish loading in time. Try again in a moment.']],
  ['offline', ['You’re offline', 'Reconnect to the internet, then try opening this page again.']],
  ['unreachable', ['Couldn’t connect', 'Check your connection or give the portfolio a moment, then try again.']],
]);

export function renderErrorPage(status) {
  const networkError = status === 'offline' || status === 'unreachable';
  const serverError = Number.isInteger(status) && status >= 500 && status <= 599;
  const [title, description] = messages.get(status) ?? messages.get(serverError ? 500 : 400);
  const label = Number.isInteger(status) ? status : 'Error';
  const tryAgain = networkError || serverError || status === 408;
  const primary = tryAgain ? ['', 'Try again'] : status === 401 ? ['/studio.html', 'Open writing studio'] : ['/', 'Back to the notebook'];
  const secondary = tryAgain ? ['/', 'Back to the notebook'] : ['/index.html#work', 'See selected work'];

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#f4eef8">
  <meta name="robots" content="noindex">
  <title>${title} — Swastika Sinha</title>
  <link rel="stylesheet" href="/error.css">
  ${networkError ? '' : '<script src="/register-offline.js" defer></script>'}
</head>
<body class="error-page">
  <header class="error-header">
    ${networkError ? '<span class="error-brand">Swastika Sinha<span>.</span></span>' : '<a class="error-brand" href="/">Swastika Sinha<span>.</span></a>'}
  </header>
  <main class="error-main" aria-labelledby="error-title">
    <div class="error-paper">
      <img class="error-bow" src="/assets/notebook/error-bow.webp" alt="" width="600" height="350" fetchpriority="high">
      ${networkError ? '' : `<p class="error-code">${label}</p>`}
      <h1 id="error-title">${title}</h1>
      <p class="error-description">${description}</p>
      <nav class="error-actions" aria-label="Ways to continue">
        <a class="error-primary" href="${primary[0]}">${primary[1]}</a>
        ${networkError ? '' : `<a class="error-link" href="${secondary[0]}">${secondary[1]}</a>`}
      </nav>
    </div>
  </main>
</body>
</html>`;
}
