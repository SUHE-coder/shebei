const { request } = require('./api');

function createDevice(fields) {
  return request('/api/devices', { method: 'POST', data: fields })
    .then(result => {
      const device = result && result.device;
      if (!device || !Number.isInteger(device.id) || device.id < 1 ||
          typeof device.deviceCode !== 'string' || !device.deviceCode) {
        throw new Error('保存结果无法确认，请按设备码查询后再操作。');
      }
      return device;
    })
    .catch(error => {
      if (error.code === 'DEVICE_LOCATION_NOT_READY') {
        error.message = '设备定位存储尚未启用，请联系管理员升级定位字段后重试。';
      } else if (error.statusCode === 409) {
        error.message = '已有相同设备码，请先扫码查询该设备。';
      } else if (error.statusCode === 400) {
        error.message = '设备信息不符合要求，请检查必填项、文字长度及特殊字符。';
      }
      throw error;
    });
}

function updateDevice(code, fields) {
  return request('/api/devices/' + encodeURIComponent(code), { method: 'PUT', data: fields })
    .then(result => {
      const device = result && result.device;
      if (!device || device.deviceCode !== code || !Number.isInteger(device.id) || device.id < 1) {
        throw new Error('保存结果无法确认，请返回设备详情刷新后检查。');
      }
      return device;
    });
}

function listDevices(filters) {
  return request('/api/devices', { data: filters }).then(result => {
    if (!Array.isArray(result.devices) || !Number.isInteger(result.total) || result.total < 0) {
      throw new Error('设备列表格式不正确，请检查后端是否已更新。');
    }
    return result;
  });
}

module.exports = { createDevice, updateDevice, listDevices };
