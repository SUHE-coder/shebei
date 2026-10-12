# 手机访问电脑后端的第一步

手机浏览器访问成功后，继续按照 [真机查询与设备扫码](REAL_DEVICE_SETUP.md) 操作。当前小程序接口已配置为 `http://172.20.10.5:3000`；电脑 IP 改变后需同步修改 `utils/api.js` 并重新编译。

本机模拟器已成功查询 RDS 测试设备。下一步先在手机浏览器中确认局域网访问，再配置真机小程序。

## 手机浏览器连通性检查

1. 手机和电脑连接同一个 Wi-Fi；电脑也可以通过同一个路由器的有线网络连接。测试期间不使用手机移动数据或网络代理。
2. 在运行 API 的 PowerShell 窗口按 Ctrl+C，停止之前仅监听 127.0.0.1 的服务。
3. 在 PowerShell 执行：

```powershell
Set-Location -LiteralPath 'D:\show\server'
npm.cmd install
```

安装完成后执行：

```powershell
npm.cmd run dev:lan
```

这个命令会：

- 只对本次进程将 HOST 设为 0.0.0.0，监听电脑局域网网卡。
- 列出可用的局域网 IPv4 地址和手机检查网址。
- 使用 qrcode 生成 server/dev-assets/DEMO-001.png 和 DEMO-001.svg，内容均为设备编码 DEMO-001。
- 保留 .env 中的密码，并保持当前小程序接口配置不变。

QRCode 库用法参考：[node-qrcode 官方 README](https://github.com/soldair/node-qrcode#tofilepath-text-options-cberror)。

如 Windows 弹出 Node.js 网络访问提示，允许当前可信 Wi-Fi 对应的专用网络。不要关闭整个防火墙。如果没有提示且手机访问超时，需要进一步检查网络配置或添加仅对局域网开放的 TCP 端口规则。

4. 保持 PowerShell 窗口运行，用手机浏览器打开脚本打印的“手机健康检查”网址，应显示 {"ok":true}。
5. 再打开“手机设备查询”网址，应看到 DEMO-001 的设备信息。若有多个网卡地址，选 Wi-Fi 或连接路由器的有线网卡地址；虚拟机或 VPN 网卡地址不一定可供手机访问。
6. 将能访问的网址告知开发人员，下一步据此设置小程序 API_BASE_URL。

## 手机能打开接口，但数据库检查失败

如果 /health 返回 {"ok":false}，同时设备查询返回服务暂时无法完成请求，说明手机已到达电脑后端，但后端数据库查询没有成功。先保留当前网络，在电脑上更新 RDS 的 dev_pc 白名单，添加当前出口公网 IP。切换到手机热点或其他 Wi-Fi 后，出口公网 IP 可能改变。

172.20.10.5 等局域网地址是手机连接电脑后端使用的地址；电脑通过外网连接 RDS 时，应放行电脑当前的出口公网 IP，不是这个局域网地址。

在另一个 PowerShell 窗口运行：

```powershell
Set-Location -LiteralPath 'D:\show\server'
npm.cmd run db:check
```

若检查失败，记录错误代码，例如 ETIMEDOUT、PROTOCOL_CONNECTION_LOST 或 ER_ACCESS_DENIED_ERROR。不要发送 .env 内容或数据库密码。检查通过后重启 dev:lan，再刷新手机浏览器。重新启动后健康检查失败时，后端终端也会打印错误代码。

### 同时出现 28.x.x.x 的真机调试超时

如果电脑正在使用 FlClash/Clash 的 TUN 模式，DNS 可能返回代理的 Fake-IP，而不是服务器真实地址。例如本机曾将 RDS 域名解析为 `28.0.0.58`，代理配置为 `fake-ip-range: 28.0.0.1/8`；真机调试也曾连接 `28.0.0.49:443` 超时。这说明两个连接都受到电脑代理网络的影响，但数据库断线还需要结合白名单和直连结果确认。

先在 FlClash 中关闭 **TUN/虚拟网卡模式**，并暂时关闭系统代理。然后在 PowerShell 执行：

```powershell
ipconfig /flushdns
Set-Location -LiteralPath 'D:\show\server'
npm.cmd run db:check
```

如果检查仍失败，去阿里云 RDS 控制台确认外网地址、实例状态和 `dev_pc` 白名单。白名单需填写关闭代理后、当前网络下的电脑出口公网 IP；`172.20.10.5` 是局域网地址，不用于 RDS 外网白名单。

数据库检查成功后，重新启动 `dev:lan`，确认手机 `/health` 返回 `{"ok":true}`。关闭微信开发者工具再重新打开，编译并生成新的真机调试二维码，避免继续使用旧的代理 DNS 连接。

Fake-IP 的行为和过滤设置参考 [Mihomo DNS 官方说明](https://wiki.metacubex.one/config/dns/#fake-ip-filter)。如果后续继续开启代理，可在代理客户端中为 RDS 和微信调试相关域名配置直连及 Fake-IP 排除，再分别验证数据库和真机调试连接。

阿里云官方白名单说明：https://help.aliyun.com/zh/rds/apsaradb-rds-for-mysql/configure-an-ip-address-whitelist-for-an-apsaradb-rds-for-mysql-instance/。

## 下一步的扫码规则

设备二维码的内容是设备编码原文 DEMO-001，在小程序的“开始扫描”功能中扫描。它不是打开小程序的入口码，微信主界面的“扫一扫”不一定会打开本应用。

手机上的 127.0.0.1 指向手机自身，因此真机测试需要电脑局域网 IP；后续正式部署再改成 HTTPS 接口域名并完成微信合法域名配置。真机网络策略需以实际微信开发者工具和手机版本验证为准。

本轮脚本不修改 RDS 白名单：数据库连接仍由电脑后端发起，手机通过 HTTP 接口读取设备信息。

结束调试按 Ctrl+C。重新执行普通 npm.cmd start 时恢复 .env 中的 HOST（默认 127.0.0.1）。
