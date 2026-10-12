App({
  globalData: {
    user: null
  },
  onLaunch() {
    const storedUser = wx.getStorageSync('device_user');
    if (storedUser) this.globalData.user = storedUser;
  }
});
