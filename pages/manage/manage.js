const auth = require('../../utils/auth');

Page({
  data: {
    loading: true,
    loggingIn: false,
    loggingOut: false,
    user: null,
    roleText: '',
    roleDescription: '',
    error: ''
  },

  onShow() {
    this.refreshUser();
  },

  refreshUser() {
    if (this.data.loggingIn || this.data.loggingOut) return;
    this.setData({ loading: true, error: '', user: null, roleText: '', roleDescription: '' });
    auth.getCurrentUser()
      .then(user => {
        const roleText = user && user.roleText ? user.roleText :
          ({ admin: '管理员', editor: '编辑者', viewer: '查看者' }[user && user.role] || '');
        const roleDescription = user && user.role === 'admin'
          ? '可以添加和维护设备，并管理设备资料。'
          : user && user.role === 'editor'
            ? '可以添加和维护设备资料。'
            : '可以查询设备信息，暂不能添加或修改设备。';
        this.setData({ user, roleText, roleDescription });
      })
      .catch(error => this.setData({ error: error.message }))
      .finally(() => this.setData({ loading: false }));
  },

  login() {
    if (this.data.loggingIn || this.data.loggingOut) return;
    this.setData({ loggingIn: true, error: '' });
    auth.login()
      .then(user => {
        const roleText = user.roleText || ({ admin: '管理员', editor: '编辑者', viewer: '查看者' }[user.role] || '');
        const roleDescription = user.role === 'admin'
          ? '可以添加和维护设备，并管理设备资料。'
          : user.role === 'editor'
            ? '可以添加和维护设备资料。'
            : '可以查询设备信息，暂不能添加或修改设备。';
        this.setData({ user, roleText, roleDescription });
      })
      .catch(error => this.setData({ error: error.message }))
      .finally(() => this.setData({ loggingIn: false }));
  },

  logout() {
    if (this.data.loggingIn || this.data.loggingOut) return;
    this.setData({ loggingOut: true, error: '' });
    auth.logout()
      .then(() => this.setData({ user: null, roleText: '', roleDescription: '' }))
      .catch(error => this.setData({ error: error.message }))
      .finally(() => this.setData({ loggingOut: false }));
  },

  copyUserId() {
    if (!this.data.user) return;
    wx.setClipboardData({
      data: String(this.data.user.id),
      success: () => wx.showToast({ title: '已复制', icon: 'success' })
    });
  },

  goAddDevice() {
    if (this.data.loading || this.data.loggingIn || this.data.loggingOut || !this.data.user) return;
    if (!['admin', 'editor'].includes(this.data.user.role)) {
      this.setData({ error: '当前账号没有添加设备权限，请联系管理员。' });
      return;
    }
    wx.navigateTo({ url: '/pages/add-device/add-device' });
  },

  goDeviceImages() {
    if (this.data.loading || this.data.loggingIn || this.data.loggingOut) return;
    wx.navigateTo({ url: '/pages/device-images/device-images' });
  },
  goDeviceList() {
    if (this.data.loading || this.data.loggingIn || this.data.loggingOut) return;
    wx.navigateTo({ url: '/pages/device-list/device-list' });
  }
});
