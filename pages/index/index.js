Page({
  data: { scanning: false, deviceCode: '', error: '', focused: false },
  onCodeInput(event) { this.setData({ deviceCode: event.detail.value, error: '' }); },
  onCodeFocus() { this.setData({ focused: true }); },
  onCodeBlur() { this.setData({ focused: false }); },
  scanDevice() {
    if (this.data.scanning) return;
    this.setData({ scanning: true, error: '' });
    wx.scanCode({
      onlyFromCamera: false,
      success: ({ result }) => this.openDevice(String(result || '').trim()),
      fail: error => {
        if (!/cancel/i.test(error.errMsg || '')) {
          this.setData({ error: '未识别到设备码，请重新扫描或输入设备编号。' });
        }
      },
      complete: () => this.setData({ scanning: false })
    });
  },
  queryDevice() { this.openDevice(this.data.deviceCode); },
  openDevice(deviceCode) {
    if (!deviceCode || deviceCode.length > 80 || /[\u0000-\u001f\u007f]/.test(deviceCode)) {
      this.setData({ error: '请输入有效的设备编号，最多 80 个字符。' }); return;
    }
    wx.navigateTo({ url: '/pages/device/device?code=' + encodeURIComponent(deviceCode.trim()) });
  },
  openManage() { wx.navigateTo({ url: '/pages/manage/manage' }); },
  openAdd() {
    const user = wx.getStorageSync('device_user');
    const canAdd = user && ['admin', 'editor'].includes(user.role) && wx.getStorageSync('token');
    wx.navigateTo({ url: canAdd ? '/pages/add-device/add-device' : '/pages/manage/manage' });
  },
  openImages() { wx.navigateTo({ url: '/pages/device-images/device-images' }); },
  openDevices() { wx.navigateTo({ url: '/pages/device-list/device-list' }); }
});
