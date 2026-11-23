/**
 * Ocson Finance Management System - public frontend configuration
 *
 * This file is served publicly by GitHub Pages. It must contain ONLY public
 * values. Never put credentials, spreadsheet IDs or secrets here.
 * Replace bridgeUrl with the /exec URL from your Apps Script web app deployment.
 */
window.OCSON_CONFIG = Object.freeze({
  bridgeUrl: 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE',
  brandName: 'OCSON',
  rpcTimeoutMs: 25000,
  connectTimeoutMs: 12000,
  themeKey: 'ocson-theme',
  sessionKey: 'ocson-session',
  loginPage: 'index.html',
  dashboardPage: 'dashboard.html'
});
