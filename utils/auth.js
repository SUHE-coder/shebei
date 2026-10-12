const { request } = require('./api');

function updateUser(user) {
  const app = getApp();
  app.globalData = app.globalData || {};
  app.globalData.user = user;
}

function clearSession() {
  wx.removeStorageSync('token');
  wx.removeStorageSync('device_user');
  updateUser(null);
}

function validUser(user) {
  return user && Number.isInteger(user.id) && user.id > 0
    && typeof user.name === 'string'
    && ['admin', 'editor', 'viewer'].includes(user.role);
}

function saveUser(user) {
  if (!validUser(user)) throw new Error('登录接口返回的账号信息不完整。');
  wx.setStorageSync('device_user', user);
  updateUser(user);
  return user;
}

function wechatCode() {
  return new Promise((resolve, reject) => {
    wx.login({
      timeout: 10000,
      success(result) {
        if (result.code) resolve(result.code);
        else reject(new Error('微信未返回登录凭证，请重试。'));
      },
      fail() {
        reject(new Error('无法获取微信登录凭证，请在微信中重试。'));
      }
    });
  });
}

let pendingLogin = null;

function login() {
  if (pendingLogin) return pendingLogin;
  let appId;
  try {
    appId = wx.getAccountInfoSync().miniProgram.appId;
  } catch {
    return Promise.reject(new Error('无法获取小程序 AppID，请重新编译并进入真机调试。'));
  }
  if (typeof appId !== 'string' || !appId) {
    return Promise.reject(new Error('当前项目没有可用 AppID，请检查开发者工具项目配置。'));
  }
  pendingLogin = wechatCode()
    .then(code => request('/api/auth/login', { method: 'POST', data: { code, appId }, skipAuth: true }))
    .then(result => {
      if (typeof result.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(result.token) || !validUser(result.user)) {
        throw new Error('登录接口返回格式不正确。');
      }
      wx.setStorageSync('token', result.token);
      return saveUser(result.user);
    })
    .finally(() => { pendingLogin = null; });
  return pendingLogin;
}

function getCurrentUser() {
  if (!wx.getStorageSync('token')) {
    clearSession();
    return Promise.resolve(null);
  }
  return request('/api/auth/me')
    .then(result => saveUser(result.user))
    .catch(error => {
      if (error.statusCode === 401 || error.statusCode === 403) clearSession();
      throw error;
    });
}

function logout() {
  if (!wx.getStorageSync('token')) {
    clearSession();
    return Promise.resolve();
  }
  return request('/api/auth/logout', { method: 'POST' })
    .catch(error => {
      if (error.statusCode !== 401 && error.statusCode !== 403) throw error;
    })
    .then(() => clearSession());
}

module.exports = { login, getCurrentUser, logout, clearSession };
