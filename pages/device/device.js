const { getDeviceImages, onThumbnailLoad, onThumbnailError } = require('../../utils/device-images');
const { validCoordinates, coordinateText } = require('../../utils/device-location');
const auth = require('../../utils/auth');

Page({
  data: { loading: true, error: '', device: null, code: '', coordinates: null, coordinateLabel: '', markers: [], canEdit: false, previewing: false },
  onLoad(options) {
    let code;
    try { code = decodeURIComponent(options.code || ''); }
    catch { this.setData({ loading: false, error: '设备码格式不正确，请重新扫描。' }); return; }
    if (!code.trim()) { this.setData({ loading: false, error: '请先选择或扫描设备码。' }); return; }
    this.setData({ code });
  },
  onShow() {
    if (this.data.previewing) { this.setData({ previewing: false }); return; }
    if (!this.data.code) return;
    this.loadDevice(this.data.code);
    this.setData({ canEdit: false });
    auth.getCurrentUser().then(user => this.setData({ canEdit: !!user && ['admin', 'editor'].includes(user.role) }))
      .catch(() => this.setData({ canEdit: false }));
  },
  loadDevice(code) {
    this.setData({ loading: true, error: '', device: null });
    return getDeviceImages(code).then(device => {
      const coordinates = validCoordinates(device.coordinates) ? device.coordinates : null;
      this.setData({
        device, loading: false, coordinates, coordinateLabel: coordinateText(coordinates),
        markers: coordinates ? [{ id: 1, ...coordinates, title: device.name, iconPath: '/assets/location-pin.png', width: 30, height: 38 }] : []
      });
    }).catch(error => this.setData({ loading: false, error: error.message || '查询失败，请稍后重试。' }));
  },
  retry() { if (!this.data.loading) this.loadDevice(this.data.code); },
  onImageLoad(event) { onThumbnailLoad(this, event, 'device.images'); },
  onImageError(event) { onThumbnailError(this, event, 'device.images'); },
  previewImage(event) {
    if (!this.data.device) return;
    const url = event.currentTarget.dataset.url;
    const urls = this.data.device.images.map(image => image.url);
    if (url && urls.includes(url)) {
      this.setData({ previewing: true }); wx.previewImage({ current: url, urls });
    }
  },
  openLocation() {
    if (!this.data.coordinates || !this.data.device) return;
    wx.openLocation({
      ...this.data.coordinates, name: this.data.device.name,
      address: this.data.device.location || '', scale: 16,
      fail: () => wx.showToast({ title: '无法打开地图，请稍后重试', icon: 'none' })
    });
  },
  openImages() {
    if (!this.data.code) return;
    wx.navigateTo({ url: '/pages/device-images/device-images?code=' + encodeURIComponent(this.data.code) });
  },
  editDevice() {
    if (!this.data.canEdit || !this.data.device) return;
    wx.navigateTo({ url: '/pages/add-device/add-device?code=' + encodeURIComponent(this.data.device.deviceCode) });
  },
  goHome() { wx.reLaunch({ url: '/pages/index/index' }); }
});
