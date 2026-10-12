const auth = require('../../utils/auth');
const { getDeviceImages, uploadDeviceImage, chooseDevicePhotos, onThumbnailLoad, onThumbnailError } = require('../../utils/device-images');

Page({
  data: {
    code: '', deviceName: '', device: null, images: [],
    loading: false, canUpload: false, choosing: false, uploading: false,
    pendingPath: '', error: '', success: '', previewing: false, focused: false, pendingFailed: false
  },
  onLoad(options) {
    let code = '';
    try { code = options.code ? decodeURIComponent(options.code) : ''; }
    catch { this.setData({ error: '设备码不正确。' }); return; }
    this.setData({ code });
  },
  onShow() {
    if (this.data.previewing) { this.setData({ previewing: false }); return; }
    if (this.data.choosing || this.data.uploading || this.data.pendingPath) return;
    if (this.data.code) this.loadDevice();
  },
  onCodeFocus() { this.setData({ focused: true }); },
  onCodeBlur() { this.setData({ focused: false }); },
  onCodeInput(event) {
    if (this.data.loading || this.data.uploading || this.data.choosing) return;
    this.setData({
      code: event.detail.value, device: null, images: [], pendingPath: '',
      deviceName: '', error: '', success: ''
    });
  },
  loadDevice() {
    if (this.data.loading || this.data.uploading || this.data.choosing) return;
    const code = this.data.code.trim();
    if (!code || code.length > 80 || /[\u0000-\u001f\u007f]/.test(code)) {
      this.setData({ error: '请填写有效的设备码，最多 80 个字符。' });
      return;
    }
    this.setData({
      code, loading: true, canUpload: false, pendingPath: '', error: '', success: ''
    });
    Promise.all([getDeviceImages(code), auth.getCurrentUser()])
      .then(([device, user]) => {
        this.setData({
          device, deviceName: device.name, images: device.images,
          canUpload: !!user && ['admin', 'editor'].includes(user.role)
        });
      })
      .catch(error => this.setData({ device: null, images: [], error: error.message }))
      .finally(() => this.setData({ loading: false }));
  },
  scanCode() {
    if (this.data.loading || this.data.uploading || this.data.choosing) return;
    this.setData({ choosing: true, error: '' });
    let scannedCode = '';
    wx.scanCode({
      onlyFromCamera: false,
      success: result => {
        scannedCode = typeof result.result === 'string' ? result.result.trim() : '';
        if (!scannedCode || scannedCode.length > 80 || /[\u0000-\u001f\u007f]/.test(scannedCode)) {
          scannedCode = '';
          this.setData({ error: '设备码不正确，请重新扫描。' });
        }
      },
      fail: error => {
        if (!/cancel/i.test(error.errMsg || '')) this.setData({ error: '扫码失败，请重试。' });
      },
      complete: () => {
        this.setData({ choosing: false });
        if (scannedCode) {
          this.setData({ code: scannedCode });
          this.loadDevice();
        }
      }
    });
  },
  async chooseImage() {
    if (!this.data.canUpload || !this.data.device || this.data.loading ||
        this.data.choosing || this.data.uploading) return;
    if (this.data.images.length >= 10) { this.setData({ error: '每台设备最多保存 10 张照片。' }); return; }
    this.setData({ choosing: true, error: '', success: '' });
    try {
      const files = await chooseDevicePhotos(1);
      this.setData({ pendingPath: files[0].path, pendingFailed: false });
    } catch (error) {
      if (!error.cancelled) this.setData({ error: error.message });
    } finally { this.setData({ choosing: false }); }
  },
  clearPending() {
    if (this.data.uploading || this.data.choosing) return;
    this.setData({ pendingPath: '', pendingFailed: false, error: '' });
  },
  previewPending() {
    if (!this.data.pendingPath || this.data.pendingFailed || this.data.uploading) return;
    this.setData({ previewing: true });
    wx.previewImage({ current: this.data.pendingPath, urls: [this.data.pendingPath] });
  },
  onPendingError() { this.setData({ pendingFailed: true }); },
  onImageLoad(event) { onThumbnailLoad(this, event); },
  onImageError(event) { onThumbnailError(this, event); },
  uploadImage() {
    if (!this.data.canUpload || !this.data.device || !this.data.pendingPath || this.data.pendingFailed ||
        this.data.loading || this.data.choosing || this.data.uploading) return;
    this.setData({ uploading: true, error: '', success: '' });
    uploadDeviceImage(this.data.device.deviceCode, this.data.pendingPath)
      .then(image => {
        this.setData({
          images: [...this.data.images, image], pendingPath: '',
          success: '图片上传成功'
        });
      })
      .catch(error => {
        if (error.statusCode === 401 || error.statusCode === 403) {
          auth.clearSession();
          this.setData({ canUpload: false });
        }
        this.setData({ error: error.message, ...(error.uncertain ? { pendingPath: '', pendingFailed: false } : {}) });
      })
      .finally(() => this.setData({ uploading: false }));
  },
  previewImage(event) {
    const url = event.currentTarget.dataset.url;
    const urls = this.data.images.map(image => image.url);
    if (url && urls.includes(url)) {
      this.setData({ previewing: true });
      wx.previewImage({ current: url, urls });
    }
  },
  editDevice() {
    if (!this.data.canUpload || !this.data.device || this.data.loading || this.data.uploading || this.data.choosing) return;
    if (this.data.pendingPath) { this.setData({ error: '请先上传或取消待上传照片，再编辑设备。' }); return; }
    wx.navigateTo({ url: '/pages/add-device/add-device?code=' + encodeURIComponent(this.data.device.deviceCode) });
  }
});
