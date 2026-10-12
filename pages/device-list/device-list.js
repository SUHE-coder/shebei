const auth = require('../../utils/auth');
const { listDevices } = require('../../utils/device-admin');
const { imageUrl, onThumbnailLoad, onThumbnailError } = require('../../utils/device-images');
const statuses = ['', 'active', 'maintenance', 'retired'];

Page({
  data: {
    keyword: '', activeKeyword: '', statusIndex: 0,
    statusOptions: ['全部状态', '正常运行', '维护中', '已停用'],
    devices: [], total: 0, page: 0, hasMore: false, loading: false, loadingMore: false,
    loaded: false, error: '', canEdit: false, focused: false
  },
  onShow() {
    auth.getCurrentUser().then(user => this.setData({ canEdit: !!user && ['admin', 'editor'].includes(user.role) }))
      .catch(() => this.setData({ canEdit: false }));
    return this.loadDevices();
  },
  onPullDownRefresh() { this.loadDevices().finally(() => wx.stopPullDownRefresh()); },
  onReachBottom() { this.loadMore(); },
  onKeywordInput(event) { this.setData({ keyword: event.detail.value }); },
  onFocus() { this.setData({ focused: true }); },
  onBlur() { this.setData({ focused: false }); },
  search() { this.setData({ activeKeyword: this.data.keyword.trim() }); return this.loadDevices(); },
  clearSearch() { this.setData({ keyword: '', activeKeyword: '', statusIndex: 0 }); return this.loadDevices(); },
  onStatusChange(event) {
    const index = Number(event.detail.value);
    if (!Number.isInteger(index) || index < 0 || index >= statuses.length) return;
    this.setData({ statusIndex: index }); this.search();
  },
  async loadDevices(append = false) {
    if (append && (this.data.loading || this.data.loadingMore || !this.data.hasMore)) return;
    const sequence = (this.requestSequence || 0) + 1;
    this.requestSequence = sequence;
    const page = append ? this.data.page + 1 : 1;
    const filters = { q: this.data.activeKeyword, status: statuses[this.data.statusIndex], page, pageSize: 20 };
    this.setData({ error: '', loading: !append, loadingMore: append,
      ...(!append ? { devices: [], loaded: false, total: 0, hasMore: false } : {}) });
    try {
      const result = await listDevices(filters);
      if (this.requestSequence !== sequence) return;
      const devices = result.devices.map(device => {
        const url = imageUrl(device.cover);
        return { ...device, url, src: url, loading: !!url, failed: false, recovered: false };
      });
      this.setData({ devices: append ? [...this.data.devices, ...devices] : devices,
        total: result.total, page: result.page, hasMore: result.hasMore, loaded: true });
    } catch (error) {
      if (this.requestSequence === sequence) this.setData({ error: error.message });
    } finally {
      if (this.requestSequence === sequence) this.setData({ loading: false, loadingMore: false });
    }
  },
  loadMore() { return this.loadDevices(true); },
  retry() { return this.data.devices.length ? this.loadMore() : this.loadDevices(); },
  onImageLoad(event) { onThumbnailLoad(this, event, 'devices'); },
  onImageError(event) { onThumbnailError(this, event, 'devices'); },
  openDevice(event) {
    const code = event.currentTarget.dataset.code;
    if (code) wx.navigateTo({ url: '/pages/device/device?code=' + encodeURIComponent(code) });
  },
  editDevice(event) {
    const code = event.currentTarget.dataset.code;
    if (this.data.canEdit && code) wx.navigateTo({ url: '/pages/add-device/add-device?code=' + encodeURIComponent(code) });
  },
  addDevice() { if (this.data.canEdit) wx.navigateTo({ url: '/pages/add-device/add-device' }); }
});
