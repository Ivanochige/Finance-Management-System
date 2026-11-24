/**
 * Ocson Finance Management System - secure Apps Script bridge client
 *
 * Ordinary fetch() cannot talk to Apps Script ContentService from GitHub Pages
 * (redirect + no CORS headers, no OPTIONS handler). This client instead frames
 * the Apps Script web app, which serves an HtmlService bridge. Messages are
 * exchanged with window.postMessage, validated by origin and per-load nonce,
 * and executed server-side through google.script.run.
 *//**
 * Ocson Finance Management System - secure Apps Script bridge client
 *
 * Ordinary fetch() cannot talk to Apps Script ContentService from GitHub Pages
 * (redirect + no CORS headers, no OPTIONS handler). This client instead frames
 * the Apps Script web app, which serves an HtmlService bridge. Messages are
 * exchanged with window.postMessage, validated by origin and per-load nonce,
 * and executed server-side through google.script.run.
 */
(function (global) {
  'use strict';

  var BUILD = 'ocson-api-v4';
  var config = global.OCSON_CONFIG;
  var PLACEHOLDER = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
  var MESSAGE_SOURCE = 'ocson-app';
  var BRIDGE_SOURCE = 'ocson-bridge';

  function isConfigured() {
    var url = String(config.bridgeUrl || '');
    return url !== PLACEHOLDER && /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/(exec|dev)\/?$/.test(url);
  }

  function isGoogleBridgeOrigin(origin) {
    return origin === 'https://script.google.com' ||
      /^https:\/\/[\w-]+\.script\.googleusercontent\.com$/.test(origin) ||
      /^https:\/\/[\w-]+\.googleusercontent\.com$/.test(origin);
  }

  function BridgeClient() {
    this.status = isConfigured() ? 'idle' : 'unconfigured';
    this.listeners = [];
    this.pending = Object.create(null);
    this.nextId = 1;
    this.iframe = null;
    this.target = null;
    this.origin = null;
    this.nonce = null;
    this.connectPromise = null;
    this.publicInfo = null;
    this.onMessage = this.onMessage.bind(this);
  }

  BridgeClient.prototype.onStatus = function (listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
      listener(this.status);
    }
    return this;
  };

  BridgeClient.prototype.setStatus = function (status) {
    this.status = status;
    this.listeners.forEach(function (listener) {
      try { listener(status); } catch (error) { console.error('OCSON status listener failed', error); }
    });
  };

  BridgeClient.prototype.finishConnect = function () {
    var entry = this.pending.__connect;
    if (!entry) return;
    delete this.pending.__connect;
    clearTimeout(entry.timer);
    this.connectPromise = null;
    entry.resolve(this);
  };

  BridgeClient.prototype.onMessage = function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== BRIDGE_SOURCE) return;
    if (!isGoogleBridgeOrigin(event.origin)) return;

    if (data.type === 'READY') {
      // The bridge generates the nonce. Adopt it on first READY and require it
      // on every later message. This avoids a handshake deadlock where both
      // sides generated independent nonces and rejected each other.
      if (!data.nonce) return;
      if (this.nonce && data.nonce !== this.nonce) return;
      this.nonce = data.nonce;
      // Google nests HtmlService content in its own iframe, so event.source is
      // the bridge window rather than iframe.contentWindow. Address that exact
      // window with the origin we just validated.
      this.target = event.source;
      this.origin = event.origin;
      this.publicInfo = data.publicInfo || null;
      this.setStatus('connected');
      this.finishConnect();
      return;
    }

    if (!this.target || event.source !== this.target) return;
    if (data.type !== 'RESULT') return;
    if (!data.nonce || data.nonce !== this.nonce) return;
    var entry = this.pending[data.id];
    if (!entry) return;
    delete this.pending[data.id];
    clearTimeout(entry.timer);
    var response = data.response;
    if (!response || response.ok !== true) {
      var error = new Error(response && response.error && response.error.message
        ? response.error.message : 'The backend could not complete the request.');
      error.code = response && response.error && response.error.code ? response.error.code : 'SERVER_ERROR';
      entry.reject(error);
      return;
    }
    entry.resolve(response.result);
  };

  BridgeClient.prototype.teardown = function () {
    this.target = null;
    this.origin = null;
    this.nonce = null;
    this.connectPromise = null;
    if (this.iframe && this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    window.removeEventListener('message', this.onMessage);
    Object.keys(this.pending).forEach(function (id) {
      var entry = this.pending[id];
      clearTimeout(entry.timer);
      entry.reject(new Error(id === '__connect'
        ? 'Timed out waiting for the secure bridge. Check the web app deployment and OCSON_FRONTEND_ORIGINS.'
        : 'The secure bridge disconnected before the request completed.'));
      delete this.pending[id];
    }, this);
  };

  BridgeClient.prototype.connect = function () {
    if (!isConfigured()) {
      this.setStatus('unconfigured');
      return Promise.reject(new Error('Backend is not configured. Set bridgeUrl in js/config.js after deployment.'));
    }
    if (this.status === 'connected' && this.target) return Promise.resolve(this);
    if (this.connectPromise) return this.connectPromise;

    var self = this;
    this.setStatus('connecting');
    window.addEventListener('message', this.onMessage);

    this.connectPromise = new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        self.teardown();
        self.setStatus('error');
        reject(new Error('Could not connect to the backend bridge. Check deployment and OCSON_FRONTEND_ORIGINS.'));
      }, config.connectTimeoutMs);

      self.pending.__connect = { resolve: resolve, reject: reject, timer: timer };

      // The nonce is adopted from the bridge's READY message (see onMessage).
      self.nonce = null;

      var iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'OCSON secure backend bridge');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('tabindex', '-1');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
      iframe.src = config.bridgeUrl;
      self.iframe = iframe;
      document.body.appendChild(iframe);
    });

    return this.connectPromise;
  };

  BridgeClient.prototype.call = function (method, params, options) {
    var self = this;
    var settings = options || {};
    if (!method || typeof method !== 'string') {
      return Promise.reject(new Error('A valid RPC method is required.'));
    }
    return this.connect().then(function () {
      return new Promise(function (resolve, reject) {
        var id = 'req-' + self.nextId++;
        var payload = {
          id: id,
          method: method,
          params: params && typeof params === 'object' ? params : {}
        };
        var timer = setTimeout(function () {
          delete self.pending[id];
          reject(new Error('The backend did not respond in time. Check before retrying to avoid duplicate postings.'));
        }, settings.timeoutMs || config.rpcTimeoutMs);

        self.pending[id] = { resolve: resolve, reject: reject, timer: timer };
        try {
          self.target.postMessage({
            source: MESSAGE_SOURCE,
            type: 'RPC',
            nonce: self.nonce,
            id: id,
            payload: payload
          }, self.origin);
        } catch (error) {
          delete self.pending[id];
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  };

  var bridge = new BridgeClient();

  global.OcsonAPI = {
    build: BUILD,
    connect: function () { return bridge.connect(); },
    call: function (method, params, options) { return bridge.call(method, params, options); },
    onStatus: function (listener) { return bridge.onStatus(listener); },
    getStatus: function () { return bridge.status; },
    isConfigured: isConfigured,
    reconnect: function () { bridge.teardown(); return bridge.connect(); },
    getPublicInfo: function () { return bridge.publicInfo; }
  };

  // Start the bridge as soon as the document is ready, regardless of which
  // page script loaded us. Individual pages may also call connect(); the
  // client de-duplicates concurrent attempts via connectPromise.
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      if (!isConfigured()) return;
      bridge.connect().catch(function () { /* status is already 'error' */ });
    });
  }
}(window));

(function (global) {
  'use strict';

  var config = global.OCSON_CONFIG;
  var PLACEHOLDER = 'PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE';
  var MESSAGE_SOURCE = 'ocson-app';
  var BRIDGE_SOURCE = 'ocson-bridge';

  function isConfigured() {
    var url = String(config.bridgeUrl || '');
    return url !== PLACEHOLDER && /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/(exec|dev)\/?$/.test(url);
  }

  function isGoogleBridgeOrigin(origin) {
    return origin === 'https://script.google.com' ||
      /^https:\/\/[\w-]+\.script\.googleusercontent\.com$/.test(origin) ||
      /^https:\/\/[\w-]+\.googleusercontent\.com$/.test(origin);
  }

  function BridgeClient() {
    this.status = isConfigured() ? 'idle' : 'unconfigured';
    this.listeners = [];
    this.pending = Object.create(null);
    this.nextId = 1;
    this.iframe = null;
    this.target = null;
    this.origin = null;
    this.nonce = null;
    this.connectPromise = null;
    this.publicInfo = null;
    this.onMessage = this.onMessage.bind(this);
  }

  BridgeClient.prototype.onStatus = function (listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener);
      listener(this.status);
    }
    return this;
  };

  BridgeClient.prototype.setStatus = function (status) {
    this.status = status;
    this.listeners.forEach(function (listener) {
      try { listener(status); } catch (error) { console.error('OCSON status listener failed', error); }
    });
  };

  BridgeClient.prototype.finishConnect = function () {
    var entry = this.pending.__connect;
    if (!entry) return;
    delete this.pending.__connect;
    clearTimeout(entry.timer);
    this.connectPromise = null;
    entry.resolve(this);
  };

  BridgeClient.prototype.onMessage = function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.source !== BRIDGE_SOURCE) return;
    if (!isGoogleBridgeOrigin(event.origin)) return;

    if (data.type === 'READY') {
      // The bridge generates the nonce. Adopt it on first READY and require it
      // on every later message. This avoids a handshake deadlock where both
      // sides generated independent nonces and rejected each other.
      if (!data.nonce) return;
      if (this.nonce && data.nonce !== this.nonce) return;
      this.nonce = data.nonce;
      // Google nests HtmlService content in its own iframe, so event.source is
      // the bridge window rather than iframe.contentWindow. Address that exact
      // window with the origin we just validated.
      this.target = event.source;
      this.origin = event.origin;
      this.publicInfo = data.publicInfo || null;
      this.setStatus('connected');
      this.finishConnect();
      return;
    }

    if (!this.target || event.source !== this.target) return;
    if (data.type !== 'RESULT') return;
    if (!data.nonce || data.nonce !== this.nonce) return;
    var entry = this.pending[data.id];
    if (!entry) return;
    delete this.pending[data.id];
    clearTimeout(entry.timer);
    var response = data.response;
    if (!response || response.ok !== true) {
      var error = new Error(response && response.error && response.error.message
        ? response.error.message : 'The backend could not complete the request.');
      error.code = response && response.error && response.error.code ? response.error.code : 'SERVER_ERROR';
      entry.reject(error);
      return;
    }
    entry.resolve(response.result);
  };

  BridgeClient.prototype.teardown = function () {
    this.target = null;
    this.origin = null;
    this.nonce = null;
    this.connectPromise = null;
    if (this.iframe && this.iframe.parentNode) this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    window.removeEventListener('message', this.onMessage);
    Object.keys(this.pending).forEach(function (id) {
      var entry = this.pending[id];
      clearTimeout(entry.timer);
      entry.reject(new Error('The secure bridge disconnected before the request completed.'));
      delete this.pending[id];
    }, this);
  };

  BridgeClient.prototype.connect = function () {
    if (!isConfigured()) {
      this.setStatus('unconfigured');
      return Promise.reject(new Error('Backend is not configured. Set bridgeUrl in js/config.js after deployment.'));
    }
    if (this.status === 'connected' && this.target) return Promise.resolve(this);
    if (this.connectPromise) return this.connectPromise;

    var self = this;
    this.setStatus('connecting');
    window.addEventListener('message', this.onMessage);

    this.connectPromise = new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        self.teardown();
        self.setStatus('error');
        reject(new Error('Could not connect to the backend bridge. Check deployment and OCSON_FRONTEND_ORIGINS.'));
      }, config.connectTimeoutMs);

      self.pending.__connect = { resolve: resolve, reject: reject, timer: timer };

      // The nonce is adopted from the bridge's READY message (see onMessage).
      self.nonce = null;

      var iframe = document.createElement('iframe');
      iframe.setAttribute('title', 'OCSON secure backend bridge');
      iframe.setAttribute('aria-hidden', 'true');
      iframe.setAttribute('tabindex', '-1');
      iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;opacity:0;pointer-events:none;left:-9999px;top:-9999px;';
      iframe.src = config.bridgeUrl;
      self.iframe = iframe;
      document.body.appendChild(iframe);
    });

    return this.connectPromise;
  };

  BridgeClient.prototype.call = function (method, params, options) {
    var self = this;
    var settings = options || {};
    if (!method || typeof method !== 'string') {
      return Promise.reject(new Error('A valid RPC method is required.'));
    }
    return this.connect().then(function () {
      return new Promise(function (resolve, reject) {
        var id = 'req-' + self.nextId++;
        var payload = {
          id: id,
          method: method,
          params: params && typeof params === 'object' ? params : {}
        };
        var timer = setTimeout(function () {
          delete self.pending[id];
          reject(new Error('The backend did not respond in time. Check before retrying to avoid duplicate postings.'));
        }, settings.timeoutMs || config.rpcTimeoutMs);

        self.pending[id] = { resolve: resolve, reject: reject, timer: timer };
        try {
          self.target.postMessage({
            source: MESSAGE_SOURCE,
            type: 'RPC',
            nonce: self.nonce,
            id: id,
            payload: payload
          }, self.origin);
        } catch (error) {
          delete self.pending[id];
          clearTimeout(timer);
          reject(error);
        }
      });
    });
  };

  var bridge = new BridgeClient();

  global.OcsonAPI = {
    connect: function () { return bridge.connect(); },
    call: function (method, params, options) { return bridge.call(method, params, options); },
    onStatus: function (listener) { return bridge.onStatus(listener); },
    getStatus: function () { return bridge.status; },
    isConfigured: isConfigured,
    reconnect: function () { bridge.teardown(); return bridge.connect(); },
    getPublicInfo: function () { return bridge.publicInfo; }
  };
}(window));
