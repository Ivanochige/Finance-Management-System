/* Ocson Finance Management System - shared form validation helpers */
(function (global) {
  'use strict';

  function setFieldError(input, message) {
    if (!input) return;
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    var error = input.parentElement ? input.parentElement.querySelector('.field-error') : null;
    if (error) error.textContent = message || '';
  }

  function clearErrors(form) {
    if (!form) return;
    form.querySelectorAll('.input').forEach(function (input) { setFieldError(input, ''); });
    var banner = form.querySelector('[data-form-error]');
    if (banner) { banner.hidden = true; banner.textContent = ''; }
  }

  function showFormError(form, message) {
    var banner = form && form.querySelector('[data-form-error]');
    if (!banner) return;
    banner.textContent = message || 'Please correct the highlighted fields.';
    banner.hidden = false;
  }

  function required(value) { return String(value || '').trim().length > 0; }
  function email(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim()); }
  function strongPassword(value) {
    var text = String(value || '');
    return text.length >= 10 && /[a-z]/.test(text) && /[A-Z]/.test(text) &&
      /[0-9]/.test(text) && /[^A-Za-z0-9]/.test(text);
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/[&<>"']/g, function (character) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
      });
  }

  global.OcsonValidation = {
    setFieldError: setFieldError,
    clearErrors: clearErrors,
    showFormError: showFormError,
    required: required,
    email: email,
    strongPassword: strongPassword,
    escapeHtml: escapeHtml
  };
}(window));
