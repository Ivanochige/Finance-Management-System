/* Ocson Finance Management System - shared shell behaviour */
(function (global) {
  'use strict';

  var config = global.OCSON_CONFIG;
  var api = global.OcsonAPI;
  var auth = global.OcsonAuth;
  var validation = global.OcsonValidation;

  var OcsonApp = {
    ready: Promise.resolve(null),
    currentProfile: null,

    toast: function (message, type) {
      var stack = document.querySelector('[data-toast-stack]');
      if (!stack) return;
      var element = document.createElement('div');
      element.className = 'toast' + (type ? ' toast-' + type : '');
      element.setAttribute('role', type === 'error' ? 'alert' : 'status');
      element.textContent = message;
      stack.appendChild(element);
      setTimeout(function () { element.remove(); }, 5500);
    },

    setBackendStatus: function (status) {
      var dot = document.querySelector('[data-backend-dot]');
      var label = document.querySelector('[data-backend-label]');
      if (!dot || !label) return;
      dot.className = 'status-dot ' + (status === 'connected' ? 'online' :
        status === 'error' ? 'offline' : '');
      label.textContent = ({
        connected: 'Backend online',
        connecting: 'Connecting...',
        unconfigured: 'Backend not configured',
        error: 'Backend unavailable',
        idle: 'Backend standby'
      })[status] || 'Backend status unknown';
    },

    showSessionUser: function (profile) {
      var session = auth.getSession();
      var user = (profile && profile.user) || (session && session.user) || {};
      var initials = String(user.displayName || user.username || '?')
        .split(/\s+/).slice(0, 2).map(function (part) { return part.charAt(0).toUpperCase(); }).join('');
      var avatar = document.querySelector('[data-user-avatar]');
      var name = document.querySelector('[data-user-name]');
      var role = document.querySelector('[data-user-role]');
      if (avatar) avatar.textContent = initials;
      if (name) name.textContent = user.displayName || user.username || 'Not signed in';
      if (role) {
        role.textContent = ({
          SYSADMIN: 'Super Administrator', MANAGER: 'Manager', ACCOUNTANT: 'Accountant',
          LOAN_OFFICER: 'Loan Officer', CASHIER: 'Cashier/Teller', AUDITOR: 'Auditor'
        })[user.roleId] || user.roleId || '';
      }
    },

    initTheme: function () {
      var saved = null;
      try { saved = global.localStorage.getItem(config.themeKey); } catch (error) { saved = null; }
      if (saved === 'dark' || saved === 'light') document.documentElement.setAttribute('data-theme', saved);
    },

    toggleTheme: function () {
      var current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { global.localStorage.setItem(config.themeKey, next); } catch (error) { /* storage blocked */ }
    },

    initShell: function () {
      var self = this;

      document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
        button.addEventListener('click', function () { self.toggleTheme(); });
      });

      var menuToggle = document.querySelector('[data-menu-toggle]');
      var overlay = document.querySelector('[data-drawer-overlay]');
      if (menuToggle) menuToggle.addEventListener('click', function () {
        var open = document.body.classList.toggle('drawer-open');
        menuToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      if (overlay) overlay.addEventListener('click', function () {
        document.body.classList.remove('drawer-open');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      });
      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          document.body.classList.remove('drawer-open');
          document.querySelectorAll('.menu-panel').forEach(function (panel) { panel.hidden = true; });
          var backdrop = document.querySelector('[data-dialog-backdrop]');
          if (backdrop) backdrop.remove();
        }
      });

      document.querySelectorAll('[data-menu-trigger]').forEach(function (trigger) {
        trigger.addEventListener('click', function (event) {
          event.stopPropagation();
          var panel = document.querySelector(trigger.getAttribute('data-menu-trigger'));
          document.querySelectorAll('.menu-panel').forEach(function (other) {
            if (other !== panel) other.hidden = true;
          });
          if (panel) panel.hidden = !panel.hidden;
        });
      });
      document.addEventListener('click', function (event) {
        if (!event.target.closest('.menu')) {
          document.querySelectorAll('.menu-panel').forEach(function (panel) { panel.hidden = true; });
        }
      });

      document.querySelectorAll('[data-logout]').forEach(function (button) {
        button.addEventListener('click', function () {
          auth.logout().then(function () {
            global.location.href = config.loginPage;
          });
        });
      });

      var notificationButton = document.querySelector('[data-notifications-toggle]');
      if (notificationButton) notificationButton.addEventListener('click', function () {
        self.toast('No notifications yet. Alerts appear here after backend setup.', 'info');
      });

      var changePasswordButton = document.querySelector('[data-change-password]');
      if (changePasswordButton) changePasswordButton.addEventListener('click', function () {
        self.openChangePasswordDialog();
      });

      var activePage = document.body.getAttribute('data-page') || '';
      document.querySelectorAll('.nav-item').forEach(function (item) {
        if (item.getAttribute('data-nav') === activePage) {
          item.classList.add('active');
          item.setAttribute('aria-current', 'page');
        }
      });

      api.onStatus(self.setBackendStatus.bind(self));
    },

    openChangePasswordDialog: function () {
      var self = this;
      var backdrop = document.createElement('div');
      backdrop.className = 'dialog-backdrop';
      backdrop.setAttribute('data-dialog-backdrop', '');
      backdrop.innerHTML =
        '<form class="dialog" novalidate>' +
        '<h2>Change password</h2>' +
        '<p class="text-small">Use at least 10 characters with upper and lower case, a number and a symbol.</p>' +
        '<div data-form-error class="alert alert-error" hidden></div>' +
        '<div class="form-field"><label for="cp-current">Current password</label>' +
        '<div class="input-wrap"><input class="input" id="cp-current" type="password" autocomplete="current-password" required>' +
        '<span class="field-error"></span></div></div>' +
        '<div class="form-field"><label for="cp-new">New password</label>' +
        '<div class="input-wrap"><input class="input" id="cp-new" type="password" autocomplete="new-password" required>' +
        '<span class="field-error"></span></div></div>' +
        '<div class="form-field"><label for="cp-confirm">Confirm new password</label>' +
        '<div class="input-wrap"><input class="input" id="cp-confirm" type="password" autocomplete="new-password" required>' +
        '<span class="field-error"></span></div></div>' +
        '<div class="dialog-actions"><button type="button" class="btn" data-cancel>Cancel</button>' +
        '<button type="submit" class="btn btn-primary" data-submit>Update password</button></div>' +
        '</form>';

      var form = backdrop.querySelector('form');
      backdrop.addEventListener('click', function (event) {
        if (event.target === backdrop || event.target.closest('[data-cancel]')) backdrop.remove();
      });
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        validation.clearErrors(form);
        var current = form.querySelector('#cp-current');
        var next = form.querySelector('#cp-new');
        var confirm = form.querySelector('#cp-confirm');
        if (!current.value) return validation.setFieldError(current, 'Enter your current password.');
        if (!validation.strongPassword(next.value)) {
          return validation.setFieldError(next, 'Password does not meet the strength requirements.');
        }
        if (next.value !== confirm.value) {
          return validation.setFieldError(confirm, 'Passwords do not match.');
        }
        var submit = form.querySelector('[data-submit]');
        submit.disabled = true;
        submit.textContent = 'Updating...';
        auth.changePassword(current.value, next.value).then(function () {
          backdrop.remove();
          self.toast('Password updated successfully.', 'success');
        }).catch(function (error) {
          validation.showFormError(form, error.message);
        }).then(function () {
          submit.disabled = false;
          submit.textContent = 'Update password';
        });
      });
      document.body.appendChild(backdrop);
      form.querySelector('#cp-current').focus();
    },

    protectPage: function () {
      var self = this;
      if (document.body.getAttribute('data-protected') !== 'true') return Promise.resolve(null);
      if (!auth.isAuthenticated()) {
        global.location.href = config.loginPage;
        return Promise.resolve(null);
      }
      return auth.restore().then(function (profile) {
        if (!profile) {
          global.location.href = config.loginPage;
          return null;
        }
        self.currentProfile = profile;
        self.showSessionUser(profile);
        return profile;
      });
    }
  };

  document.addEventListener('DOMContentLoaded', function () {
    OcsonApp.initTheme();
    OcsonApp.initShell();
    OcsonApp.showSessionUser(null);
    OcsonApp.ready = OcsonApp.protectPage();

    // Offline support is limited to non-sensitive static assets.
    if ('serviceWorker' in navigator &&
        (global.location.protocol === 'https:' || global.location.hostname === 'localhost')) {
      navigator.serviceWorker.register('service-worker.js').catch(function (error) {
        console.warn('OCSON service worker registration skipped', error);
      });
    }
  });

  global.OcsonApp = OcsonApp;
}(window));
