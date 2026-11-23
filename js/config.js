/**
 * Ocson Finance Management System - public frontend configuration
 *
 * This file is served publicly by GitHub Pages. It must contain ONLY public
 * values. Never put credentials, spreadsheet IDs or secrets here.
 * Replace bridgeUrl with the /exec URL from your Apps Script web app deployment.
 */
window.OCSON_CONFIG = Object.freeze({
  bridgeUrl: 'https://script.google.com/macros/s/AKfycbwH_-th2ii9aAsIW5q9nfK2QF39FiPXnDBZbjGqdEkWokNHI-DfBcvqwB0v8ondI_a6/exec',
  brandName: 'OCSON',
  rpcTimeoutMs: 25000,
  connectTimeoutMs: 12000,
  themeKey: 'ocson-theme',
  sessionKey: 'ocson-session',
  loginPage: 'index.html',
  dashboardPage: 'dashboard.html'
});
