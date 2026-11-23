/* Ocson Finance Management System - dashboard (Phase 1 layout) */
(function (global) {
  'use strict';

  var api = global.OcsonAPI;
  var app = global.OcsonApp;

  function wireRefresh() {
    var button = document.querySelector('[data-refresh-status]');
    if (!button) return;
    button.addEventListener('click', function () {
      button.disabled = true;
      button.textContent = 'Checking...';
      api.call('health.ping', {}).then(function (result) {
        app.toast('Backend online. Version ' + result.version + '.', 'success');
      }).catch(function (error) {
        app.toast(error.message, 'error');
      }).then(function () {
        button.disabled = false;
        button.textContent = 'Check connection';
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    wireRefresh();
    if (!api.isConfigured()) {
      app.toast('Backend bridge is not configured yet. See docs/DEPLOYMENT.md.', 'info');
    }
    app.ready.then(function (profile) {
      if (!profile) return;
      var greeting = document.querySelector('[data-dashboard-greeting]');
      if (greeting) {
        greeting.textContent = 'Welcome back, ' + String(profile.user.displayName || '').split(' ')[0] + '.';
      }
      if (profile.user.mustChangePassword) {
        app.toast('Please change your temporary password before using the system.', 'info');
        app.openChangePasswordDialog();
      }
    });
  });
}(window));
