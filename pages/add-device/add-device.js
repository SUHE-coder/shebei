const auth = require('../../utils/auth');
const { createDevice, updateDevice } = require('../../utils/device-admin');
const { chooseDevicePhotos, uploadDeviceImage, deleteDeviceImage, getDeviceImages,
  onThumbnailLoad, onThumbnailError, MAX_DEVICE_IMAGES } = require('../../utils/device-images');
const { getCurrentLocation, chooseDeviceLocation, coordinateText } = require('../../utils/device-location');

function emptyFields() {
  return { deviceCode: '', name: '', model: '', location: '', note: '' };
}
const statusValues = ['active', 'maintenance', 'retired'];

Page({
  data: {
    loading: true, allowed: false, submitting: false, scanning: false, choosing: false,
    locating: false, fields: emptyFields(), statusOptions: ['正常运行', '维护中', '已停用'],
    statusIndex: 0, error: '', savedCode: '', photos: [], photoCount: 0,
    coordinates: null, coordinateLabel: '', locationError: '', needsLocationSettings: false,
    markers: [], completed: false, uploadedCount: 0, uploadLabel: '', uncertainUpload: false,
    focusedField: '', previewing: false, editing: false, editCode: '', editInitialized: false,
    routeError: '', deletedImageIds: []
  },
  onLoad(options) {
    if (!options.code) return;
    try {
      const code = decodeURIComponent(options.code).trim();
      if (!code || code.length > 80 || /[\u0000-\u001f\u007f]/.test(code)) throw new Error('INVALID_CODE');
      this.setData({ editing: true, editCode: code });
      wx.setNavigationBarTitle({ title: '编辑设备' });
    } catch { this.setData({ routeError: '设备码不正确，请返回列表重新选择。' }); }
  },
  onShow() {
    if (this.data.previewing) { this.setData({ previewing: false }); return; }
    if (this.data.submitting || this.data.scanning || this.data.choosing || this.data.locating
        || this.data.savedCode) return;
    if (this.data.routeError) {
      this.setData({ loading: false, allowed: false, error: this.data.routeError }); return;
    }
    this.setData({ loading: true, allowed: false, error: '' });
    return auth.getCurrentUser()
      .then(async user => {
        const allowed = !!user && ['admin', 'editor'].includes(user.role);
        if (allowed && this.data.editing && !this.data.editInitialized) {
          const device = await getDeviceImages(this.data.editCode);
          const coordinates = device.coordinates || null;
          const photos = device.images.map(image => ({
            ...image, path: image.url, state: 'existing'
          }));
          this.setData({
            fields: { deviceCode: device.deviceCode, name: device.name, model: device.model || '',
              location: device.location || '', note: device.note || '' },
            statusIndex: Math.max(0, statusValues.indexOf(device.status)),
            coordinates, coordinateLabel: coordinates ? coordinateText(coordinates) : '',
            markers: coordinates ? [{ id: 1, ...coordinates, title: '设备位置', iconPath: '/assets/location-pin.png', width: 30, height: 38 }] : [],
            photos, photoCount: photos.length, editInitialized: true
          });
        }
        this.setData({
          allowed,
          error: allowed ? '' : user
            ? '当前账号只有查看权限，请联系管理员开通设备维护权限。'
            : '请先登录，再维护设备。'
        });
      })
      .catch(error => this.setData({ error: error.message }))
      .finally(() => this.setData({ loading: false }));
  },
  isBusy() {
    return this.data.loading || this.data.submitting || this.data.scanning
      || this.data.choosing || this.data.locating;
  },
  onFieldFocus(event) { this.setData({ focusedField: event.currentTarget.dataset.field }); },
  onFieldBlur() { this.setData({ focusedField: '' }); },
  onFieldInput(event) {
    if (this.isBusy() || this.data.savedCode) return;
    const field = event.currentTarget.dataset.field;
    if (this.data.editing && field === 'deviceCode') return;
    if (!Object.prototype.hasOwnProperty.call(emptyFields(), field)) return;
    this.setData({ ['fields.' + field]: event.detail.value, error: '' });
  },
  onStatusChange(event) {
    if (this.isBusy() || this.data.savedCode) return;
    const value = Number(event.currentTarget.dataset.index);
    if (Number.isInteger(value) && value >= 0 && value < statusValues.length) {
      this.setData({ statusIndex: value, error: '' });
    }
  },
  scanDeviceCode() {
    if (!this.data.allowed || this.isBusy() || this.data.savedCode || this.data.editing) return;
    this.setData({ scanning: true, error: '' });
    wx.scanCode({
      onlyFromCamera: false,
      success: result => {
        const code = typeof result.result === 'string' ? result.result.trim() : '';
        if (!code || code.length > 80 || /[\u0000-\u001f\u007f]/.test(code)) {
          this.setData({ error: '设备码应为 1～80 个字符，请扫描设备标签上的编号。' });
          return;
        }
        this.setData({ 'fields.deviceCode': code });
      },
      fail: error => {
        if (!/cancel/i.test(error.errMsg || '')) {
          this.setData({ error: '未能读取设备码，请重新扫描或手动填写。' });
        }
      },
      complete: () => this.setData({ scanning: false })
    });
  },
  async locateDevice(event) {
    if (!this.data.allowed || this.isBusy() || this.data.savedCode) return;
    const fromMap = event && event.currentTarget.dataset.mode === 'map';
    this.setData({ locating: true, locationError: '', needsLocationSettings: false });
    try {
      const result = fromMap ? await chooseDeviceLocation(this.data.coordinates) : await getCurrentLocation();
      const coordinates = { latitude: result.latitude, longitude: result.longitude };
      const values = {
        coordinates, coordinateLabel: coordinateText(coordinates),
        markers: [{ id: 1, ...coordinates, title: '设备位置', iconPath: '/assets/location-pin.png', width: 30, height: 38 }]
      };
      if (result.address) values['fields.location'] = result.address.slice(0, 200);
      this.setData(values);
    } catch (error) {
      if (!error.cancelled) this.setData({
        locationError: error.message, needsLocationSettings: !!error.needsSettings
      });
    } finally { this.setData({ locating: false }); }
  },
  openLocationSettings() {
    if (this.isBusy()) return;
    this.setData({ locating: true });
    wx.openSetting({
      success: result => {
        if (result.authSetting && result.authSetting['scope.userLocation']) {
          this.setData({ locationError: '', needsLocationSettings: false });
        }
      },
      complete: () => this.setData({ locating: false })
    });
  },
  clearLocation() {
    if (this.isBusy() || this.data.savedCode) return;
    this.setData({ coordinates: null, coordinateLabel: '', markers: [], locationError: '', needsLocationSettings: false });
  },
  async choosePhotos() {
    if (!this.data.allowed || this.isBusy() || this.data.savedCode) return;
    const available = MAX_DEVICE_IMAGES - this.data.photos.length;
    if (available < 1) { this.setData({ error: '每台设备最多添加 10 张照片。' }); return; }
    this.setData({ choosing: true, error: '' });
    try {
      const files = await chooseDevicePhotos(available);
      const photos = [...this.data.photos, ...files.slice(0, available).map((file, index) => ({
        id: 'photo-' + Date.now() + '-' + index, path: file.path, state: 'pending', failed: false
      }))];
      this.setData({ photos, photoCount: photos.length });
    } catch (error) {
      if (!error.cancelled) this.setData({ error: error.message });
    } finally { this.setData({ choosing: false }); }
  },
  removePhoto(event) {
    if (this.isBusy() || this.data.savedCode) return;
    const photo = this.data.photos.find(photo => String(photo.id) === String(event.currentTarget.dataset.id));
    if (!photo) return;
    const remove = () => {
      if (this.isBusy() || this.data.savedCode) return;
      const photos = this.data.photos.filter(item => item.id !== photo.id);
      this.setData({ photos, photoCount: photos.length, error: '',
        deletedImageIds: photo.state === 'existing' ? [...this.data.deletedImageIds, photo.id] : this.data.deletedImageIds });
    };
    if (photo.state !== 'existing') { remove(); return; }
    if (!Number.isSafeInteger(photo.id)) {
      this.setData({ error: '照片编号无法读取，请先更新后端，再重新进入编辑页面。' }); return;
    }
    this.setData({ choosing: true });
    wx.showModal({ title: '移除设备照片', content: '点击保存后会删除这张照片；返回不保存则保留。',
      confirmText: '移除', confirmColor: '#a24c36',
      success: result => { this.setData({ choosing: false }); if (result.confirm) remove(); },
      complete: () => this.setData({ choosing: false })
    });
  },
  previewPhoto(event) {
    if (this.data.submitting || this.data.choosing) return;
    const path = event.currentTarget.dataset.path;
    const urls = this.data.photos.map(photo => photo.path);
    if (path && urls.includes(path)) {
      this.setData({ previewing: true });
      wx.previewImage({ current: path, urls });
    }
  },
  onPhotoError(event) {
    const index = Number(event.currentTarget.dataset.index);
    if (this.data.photos[index] && this.data.photos[index].state === 'existing') {
      onThumbnailError(this, event, 'photos'); return;
    }
    if (this.data.photos[index]) this.setData({ ['photos[' + index + '].failed']: true });
  },
  onPhotoLoad(event) { onThumbnailLoad(this, event, 'photos'); },
  async submitDevice() {
    if (!this.data.allowed || this.isBusy() || this.data.completed || this.data.uncertainUpload) return;
    const fields = {};
    for (const key of Object.keys(emptyFields())) fields[key] = (this.data.fields[key] || '').trim();
    if (!fields.deviceCode || !fields.name) {
      this.setData({ error: '请填写设备码和设备名称。' }); return;
    }
    if (this.data.photos.some(photo => photo.failed && photo.state !== 'existing')) {
      this.setData({ error: '有照片无法读取，请移除后重新选择。' }); return;
    }
    this.setData({ submitting: true, error: '', uploadLabel: this.data.savedCode ? '继续上传照片…' : '正在保存设备资料…' });
    try {
      if (!this.data.savedCode) {
        const values = { ...fields, status: statusValues[this.data.statusIndex], coordinates: this.data.coordinates };
        const device = this.data.editing ? await updateDevice(this.data.editCode, values) : await createDevice(values);
        this.setData({ savedCode: device.deviceCode });
      }
      while (this.data.deletedImageIds.length) {
        this.setData({ uploadLabel: '正在删除已移除的照片…' });
        await deleteDeviceImage(this.data.savedCode, this.data.deletedImageIds[0]);
        this.setData({ deletedImageIds: this.data.deletedImageIds.slice(1) });
      }
      for (let index = 0; index < this.data.photos.length; index++) {
        const photo = this.data.photos[index];
        if (photo.state === 'uploaded' || photo.state === 'existing') continue;
        this.setData({
          uploadLabel: '正在上传照片 ' + (index + 1) + ' / ' + this.data.photos.length,
          ['photos[' + index + '].state']: 'uploading'
        });
        try {
          const image = await uploadDeviceImage(this.data.savedCode, photo.path);
          this.setData({
            ['photos[' + index + '].state']: 'uploaded',
            ['photos[' + index + '].image']: image,
            uploadedCount: this.data.uploadedCount + 1
          });
        } catch (error) {
          this.setData({ ['photos[' + index + '].state']: error.uncertain ? 'uncertain' : 'failed' });
          throw error;
        }
      }
      this.setData({ completed: true, uploadLabel: '' });
    } catch (error) {
      if (error.statusCode === 401 || error.statusCode === 403) {
        auth.clearSession(); this.setData({ allowed: false });
      }
      this.setData({
        uncertainUpload: !!error.uncertain,
        error: this.data.savedCode ? '设备资料已保存。' + error.message : error.message
      });
    } finally { this.setData({ submitting: false }); }
  },
  goBack() {
    if (this.isBusy()) return;
    wx.navigateBack({ delta: 1, fail() { wx.reLaunch({ url: '/pages/index/index' }); } });
  },
  goManage() {
    if (this.isBusy()) return;
    wx.redirectTo({ url: '/pages/manage/manage' });
  },
  goDeviceImages() {
    if (!this.data.savedCode || this.isBusy()) return;
    wx.redirectTo({ url: '/pages/device-images/device-images?code=' + encodeURIComponent(this.data.savedCode) });
  },
  goDevice() {
    if (!this.data.savedCode || this.isBusy()) return;
    wx.redirectTo({ url: '/pages/device/device?code=' + encodeURIComponent(this.data.savedCode) });
  }
});
