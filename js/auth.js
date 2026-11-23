/* Ocson Finance Management System - client-side session handling */
(function (global) {
  'use strict';

  var config = global.OCSON_CONFIG;
  var api = global.OcsonAPI;

  function readSession() {
    try {
      var raw = global.sessionStorage.getItem(config.sessionKey);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function saveSession(session) {
    global.sessionStorage.setItem(config.sessionKey, JSON.stringify(session));
  }

  function clearSession() {
    global.sessionStorage.removeItem(config.sessionKey);
  }

  function expired(session) {
    if (!session || !session.expiresAt) return true;
    return new Date(session.expiresAt).getTime() <= Date.now();
  }

  function login(username, password) {
    return api.call('auth.login', { username: username, password: password }).then(function (result) {
      saveSession({
        token: result.token,
        expiresAt: result.expiresAt,
        user: result.user
      });
      return result;
    });
  }

  function restore() {
    var session = readSession();
    if (!session || !session.token) return Promise.resolve(null);
    if (expired(session)) { clearSession(); return Promise.resolve(null); }
    return api.call('auth.me', { sessionToken: session.token }).then(function (result) {
      saveSession({
        token: session.token,
        expiresAt: result.expiresAt || session.expiresAt,
        user: result.user,
        permissions: result.permissions || []
      });
      return result;
    }).catch(function () {
      clearSession();
      return null;
    });
  }

  function logout() {
    var session = readSession();
    var request = session && session.token
      ? api.call('auth.logout', { sessionToken: session.token }).catch(function () { return null; })
      : Promise.resolve(null);
    return request.then(function () {
      clearSession();
      return true;
    });
  }

  function changePassword(currentPassword, newPassword) {
    var session = readSession();
    if (!session) return Promise.reject(new Error('Please sign in again.'));
    return api.call('auth.changePassword', {
      sessionToken: session.token,
      currentPassword: currentPassword,
      newPassword: newPassword
    });
  }

  global.OcsonAuth = {
    login: login,
    restore: restore,
    logout: logout,
    changePassword: changePassword,
    getSession: readSession,
    clearSession: clearSession,
    isAuthenticated: function () { return !expired(readSession()); }
  };
}(window));
