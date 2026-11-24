/* Ocson Finance Management System - sign in page */
(function (global) {
  'use strict';

  var config = global.OCSON_CONFIG;
  var api = global.OcsonAPI;
  var auth = global.OcsonAuth;
  var validation = global.OcsonValidation;

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.querySelector('[data-login-form]');
    if (!form) return;

    if (auth.isAuthenticated()) {
      global.location.href = config.dashboardPage;
      return;
    }

    var username = form.querySelector('#username');
    var password = form.querySelector('#password');
    var reveal = form.querySelector('[data-reveal-password]');
    var submit = form.querySelector('[data-login-submit]');

    if (reveal) reveal.addEventListener('click', function () {
      var show = password.type === 'password';
      password.type = show ? 'text' : 'password';
      reveal.textContent = show ? 'Hide' : 'Show';
      reveal.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      password.focus();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      validation.clearErrors(form);
      var valid = true;
      if (!validation.required(username.value)) {
        validation.setFieldError(username, 'Enter your username or email.');
        valid = false;
      }
      if (!validation.required(password.value)) {
        validation.setFieldError(password, 'Enter your password.');
        valid = false;
      }
      if (!valid) return;

      submit.disabled = true;
      submit.innerHTML = '<span class="spinner" aria-hidden="true"></span> Signing in...';
      auth.login(username.value, password.value).then(function () {
        global.location.href = config.dashboardPage;
      }).catch(function (error) {
        var message = error.code === 'AUTH_INVALID'
          ? 'Invalid username or password.'
          : error.code === 'AUTH_LOCKED'
            ? 'Too many failed attempts. Try again in 15 minutes.'
            : error.message;
        validation.showFormError(form, message);
        password.value = '';
        password.focus();
      }).then(function () {
        submit.disabled = false;
        submit.textContent = 'Sign in securely';
      });
    });

    api.onStatus(function (status) {
      var dot = document.querySelector('[data-backend-dot]');
      var label = document.querySelector('[data-backend-label]');
      if (!dot || !label) return;
      dot.className = 'status-dot ' + (status === 'connected' ? 'online' :
        status === 'error' || status === 'unconfigured' ? 'offline' : '');
      label.textContent = status === 'connected' ? 'Secure backend connected'
        : status === 'unconfigured' ? 'Backend URL not configured'
          : status === 'error' ? 'Backend unavailable'
            : 'Connecting to secure backend...';
    });

    // Start the handshake on page load. Without this, the label only reflects
    // the initial "idle" state and never attempts a real connection until the
    // user submits the form (auth.login -> api.call -> connect).
    if (api.isConfigured()) {
      api.connect().catch(function (error) {
        console.warn('OCSON bridge connection failed', error);
      });
    }
  });
}(window));
