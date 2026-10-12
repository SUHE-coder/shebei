function validCoordinates(value) {
  return !!value && typeof value.latitude === 'number' && Number.isFinite(value.latitude)
    && value.latitude >= -90 && value.latitude <= 90
    && typeof value.longitude === 'number' && Number.isFinite(value.longitude)
    && value.longitude >= -180 && value.longitude <= 180;
}

function coordinateText(value) {
  return validCoordinates(value)
    ? value.latitude.toFixed(6) + ', ' + value.longitude.toFixed(6) : '';
}

function locationError(error) {
  const message = error && error.errMsg || '';
  if (/cancel/i.test(message)) return Object.assign(new Error('已取消选择位置。'), { cancelled: true });
  if (/auth deny|auth denied|authorize.*deny|permission denied/i.test(message)) {
    return Object.assign(new Error('定位权限未开启，请在设置中允许访问位置后重试。'), { needsSettings: true });
  }
  if (/privacy|not.*declar|not.*config|no permission|not.*permission|api scope|not.*support/i.test(message)) {
    return new Error('小程序定位功能尚未开通，请联系管理员配置位置接口权限，或手动填写位置。');
  }
  return new Error('暂时无法获取位置，请开启手机定位服务后重试，也可以手动填写。');
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: 'gcj02',
      success(result) {
        if (!validCoordinates(result)) { reject(new Error('未获取到有效坐标，请重新定位。')); return; }
        resolve({ latitude: result.latitude, longitude: result.longitude });
      },
      fail: error => reject(locationError(error))
    });
  });
}

function chooseDeviceLocation(current) {
  return new Promise((resolve, reject) => {
    wx.chooseLocation({
      ...(validCoordinates(current) ? { latitude: current.latitude, longitude: current.longitude } : {}),
      success(result) {
        if (!validCoordinates(result)) { reject(new Error('所选位置没有有效坐标，请重新选择。')); return; }
        resolve({
          latitude: result.latitude, longitude: result.longitude,
          address: [result.address, result.name].filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).join(' · ')
        });
      },
      fail: error => reject(locationError(error))
    });
  });
}

module.exports = { validCoordinates, coordinateText, getCurrentLocation, chooseDeviceLocation };
