const { getDevice, getApiBaseUrl, request } = require('./api');
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_DEVICE_IMAGES = 10;

function imageUrl(value) {
  if (typeof value !== 'string') return '';
  const url = value.trim();
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/media/device-images/')) return getApiBaseUrl().replace(/\/$/, '') + url;
  return '';
}

function normalizeDeviceImages(images) {
  return (Array.isArray(images) ? images : []).map((image, index) => {
    const url = imageUrl(typeof image === 'string' ? image : image && (image.url || image.objectKey));
    return {
      ...(image && typeof image === 'object' ? image : {}),
      id: image && image.id || 'existing-' + index,
      url, src: url, loading: true, failed: false, recovered: false
    };
  }).filter(image => image.url);
}

function getDeviceImages(code) {
  return getDevice(code).then(device => ({ ...device,
    images: normalizeDeviceImages(Array.isArray(device.imageRecords) ? device.imageRecords : device.images) }));
}

function chooseDevicePhotos(count = 1) {
  return new Promise((resolve, reject) => {
    const selected = files => {
      if (!files || !files.length || files.some(file => !file.path || !Number.isFinite(file.size)
          || file.size < 1 || file.size > MAX_IMAGE_BYTES)) {
        reject(new Error('请选择不超过 5 MB 的照片，支持 JPG、PNG、WEBP。'));
        return;
      }
      resolve(files);
    };
    const failed = error => reject(Object.assign(
      new Error('无法选择照片，请检查相机或相册权限。'),
      { cancelled: /cancel/i.test(error.errMsg || '') }
    ));
    const options = {
      count: Math.max(1, Math.min(9, count)), sourceType: ['album', 'camera'],
      sizeType: ['compressed'], fail: failed
    };
    if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        ...options, mediaType: ['image'],
        success: result => selected((result.tempFiles || []).map(file => ({
          path: file.tempFilePath, size: file.size
        })))
      });
    } else {
      wx.chooseImage({ ...options, success: result => selected(result.tempFiles) });
    }
  });
}

function onThumbnailLoad(page, event, field = 'images') {
  const index = Number(event.currentTarget.dataset.index);
  const list = field.split('.').reduce((value, key) => value && value[key], page.data);
  if (!list || !list[index]) return;
  page.setData({ [field + '[' + index + '].loading']: false, [field + '[' + index + '].failed']: false });
}

function onThumbnailError(page, event, field = 'images') {
  const index = Number(event.currentTarget.dataset.index);
  const list = field.split('.').reduce((value, key) => value && value[key], page.data);
  const image = list && list[index];
  if (!image) return;
  const key = field + '[' + index + ']';
  if (image.recovered || typeof wx.getImageInfo !== 'function') {
    page.setData({ [key + '.loading']: false, [key + '.failed']: true });
    return;
  }
  page.setData({ [key + '.recovered']: true });
  const stillCurrent = () => {
    const current = field.split('.').reduce((value, part) => value && value[part], page.data);
    return current && current[index] && current[index].url === image.url;
  };
  // 部分真机直接显示网络缩略图失败时，改用微信下载后的本地图片路径。
  wx.getImageInfo({
    src: image.url,
    success(result) {
      if (!stillCurrent()) return;
      if (!result.path) { page.setData({ [key + '.loading']: false, [key + '.failed']: true }); return; }
      page.setData({ [key + '.src']: result.path, [key + '.loading']: true, [key + '.failed']: false });
    },
    fail() {
      if (stillCurrent()) page.setData({ [key + '.loading']: false, [key + '.failed']: true });
    }
  });
}

function uploadDeviceImage(code, filePath) {
  const token = wx.getStorageSync('token');
  if (!token) {
    return Promise.reject(Object.assign(new Error('请先登录，再上传设备图片。'), { statusCode: 401 }));
  }
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: getApiBaseUrl().replace(/\/$/, '') + '/api/devices/' + encodeURIComponent(code) + '/images',
      filePath, name: 'image',
      header: { Authorization: 'Bearer ' + token }, timeout: 60000,
      success(response) {
        let body;
        try { body = JSON.parse(response.data); }
        catch {
          reject(Object.assign(new Error('上传结果无法确认，请查看设备照片后再操作。'), { uncertain: true }));
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          const image = body && body.image;
          const url = image && imageUrl(image.url || image.objectKey);
          if (!url || !Number.isInteger(image.id) || image.id < 1) {
            reject(Object.assign(new Error('上传结果无法确认，请查看设备照片后再操作。'), { uncertain: true }));
            return;
          }
          resolve({ ...image, url, src: filePath, loading: false, failed: false, recovered: false });
          return;
        }
        const message = body && typeof body.message === 'string' && body.message.length <= 200
          ? body.message
          : response.statusCode === 401 ? '登录已过期，请重新登录。'
          : response.statusCode === 403 ? '当前账号没有设备维护权限。'
          : '图片上传失败，请稍后重试。';
        reject(Object.assign(new Error(message), {
          statusCode: response.statusCode, code: body && body.code, uncertain: response.statusCode >= 500
        }));
      },
      fail(error) {
        const timedOut = /timeout/i.test(error.errMsg || '');
        reject(Object.assign(new Error(timedOut
          ? '上传超时，请先查看设备照片，确认结果后再上传。'
          : '网络连接中断，请先查看设备照片，确认结果后再上传。'), { uncertain: true }));
      }
    });
  });
}

function deleteDeviceImage(code, imageId) {
  return request('/api/devices/' + encodeURIComponent(code) + '/images/' + imageId, { method: 'DELETE' })
    .then(result => {
      if (!result.ok || Number(result.imageId) !== Number(imageId)) throw new Error('删除结果无法确认，请刷新设备照片。');
      return result;
    });
}

module.exports = {
  MAX_IMAGE_BYTES, MAX_DEVICE_IMAGES, imageUrl, normalizeDeviceImages,
  getDeviceImages, chooseDevicePhotos, uploadDeviceImage, deleteDeviceImage, onThumbnailLoad, onThumbnailError
};
