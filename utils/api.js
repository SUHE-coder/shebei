// 手机与电脑在同一网络时使用电脑的局域网地址；电脑 IP 改变后需同步修改。
// 正式部署时替换为 HTTPS 接口域名。
const API_BASE_URL = 'http://10.130.209.155:3000';

function apiError(message, statusCode, code) {
  const error = new Error(message);
  error.statusCode = statusCode || 0;
  error.code = code || 'API_ERROR';
  return error;
}

function request(path, options = {}) {
  const token = wx.getStorageSync('token');
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE_URL + path,
      method: options.method || 'GET',
      data: options.data,
      timeout: 60000,
      header: {
        'content-type': 'application/json',
        ...(token && !options.skipAuth ? { Authorization: 'Bearer ' + token } : {})
      },
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          if (!res.data || typeof res.data !== 'object' || Array.isArray(res.data)) {
            reject(apiError('接口返回格式不正确，请检查后端地址。', res.statusCode, 'INVALID_RESPONSE'));
            return;
          }
          resolve(res.data);
          return;
        }
        const messages = {
          400: '设备码或请求参数不正确。',
          401: '请先登录后再查询。',
          403: '当前账号没有访问权限。',
          404: '未找到该设备，请确认设备码已录入。',
          500: '后端查询失败，请查看运行接口的 PowerShell 窗口。',
          503: '数据库暂时不可用，请稍后重试。'
        };
        const knownResponse = path.indexOf('/api/auth/') === 0 || path === '/api/devices'
          || path.indexOf('/api/devices/') === 0;
        const serverMessage = knownResponse && res.data && typeof res.data.message === 'string'
          && res.data.message.length <= 200 ? res.data.message : '';
        const serverCode = knownResponse && res.data && typeof res.data.code === 'string'
          ? res.data.code : 'HTTP_ERROR';
        reject(apiError(
          serverMessage || messages[res.statusCode] || '请求失败，请稍后重试。',
          res.statusCode,
          serverCode
        ));
      },
      fail(error) {
        const timedOut = /timeout/i.test(error.errMsg || '');
        reject(apiError(
          timedOut ? '查询超时，请检查网络或等待数据库唤醒后重试。'
            : '无法连接接口。请确认后端正在运行，并检查开发者工具的本地设置。',
          0,
          timedOut ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'
        ));
      }
    });
  });
}

function getDevice(deviceCode) {
  const code = String(deviceCode || '').trim();
  if (!code || code.length > 80) {
    return Promise.reject(apiError('设备码不能为空，且不能超过 80 个字符。', 400, 'INVALID_CODE'));
  }
  return request('/api/devices/' + encodeURIComponent(code)).then((device) => {
    if (typeof device.deviceCode !== 'string' || typeof device.name !== 'string') {
      throw apiError('接口返回的设备信息不完整，请检查后端。', 200, 'INVALID_RESPONSE');
    }
    return {
      ...device,
      images: Array.isArray(device.images) ? device.images : []
    };
  });
}

function resolveDeviceImage(image) {
  const value = typeof image === 'string' ? image : image && (image.url || image.objectKey);
  const url = typeof value === 'string' && value.startsWith('/media/device-images/')
    ? API_BASE_URL.replace(/\/$/, '') + value
    : typeof value === 'string' && /^https?:\/\//i.test(value) ? value : '';
  return typeof image === 'string' ? url : { ...image, url, objectKey: url || (image && image.objectKey) };
}

module.exports = {
  request,
  getDevice: code => getDevice(code).then(device => ({
    ...device, images: (device.images || []).map(resolveDeviceImage)
  })),
  getApiBaseUrl: () => API_BASE_URL
};
