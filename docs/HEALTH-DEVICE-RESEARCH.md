# 小米手环接入预研 · 2026-10-26

本轮只查阅公开实现、README、数据说明与许可证，未运行外部代码、配对设备、安装服务、索取凭证或上传个人数据。以下仓库描述不等于Life OS在用户小米手环10 NFC上已经验通。

| 参考 | 核实内容 / 本项目的采用边界 |
| --- | --- |
| [Tnze/miband-heart-rate](https://github.com/Tnze/miband-heart-rate) | README明确是Band10运动心率广播演示，并报告10/NFC测试；[实际Rust入口](https://github.com/Tnze/miband-heart-rate/blob/master/src/main.rs)读取标准心率服务0x180D、特征0x2A37通知。[MIT许可](https://github.com/Tnze/miband-heart-rate/blob/master/LICENSE)。可作为Windows心率单项实验候选，不能据此推断完整睡眠/步数历史已可读取。本轮未复制实现。 |
| [kirisawa-subaru/miband-mcp](https://github.com/kirisawa-subaru/miband-mcp) | README将观测时间与拉取时间分开，主要验通Android/Gadgetbridge/USB/Linux，标明iPhone及Windows当前路线不适用；[pyproject](https://github.com/kirisawa-subaru/miband-mcp/blob/main/pyproject.toml)声明AGPL-3.0-or-later，根[LICENSE](https://github.com/kirisawa-subaru/miband-mcp/blob/main/LICENSE)为AGPLv3。本轮仅借鉴来源/缺失/时间分离思想，未安装MCP或复用代码。 |
| [cobanov/freeband](https://github.com/cobanov/freeband) | README是SwiftUI/CoreBluetooth原生iOS路线，不是Safari网页方案；涉及认证及加密历史文件，部分能力的验通设备/固件有明确限制。[MIT许可](https://github.com/cobanov/freeband/blob/main/LICENSE)；[活动协议文档](https://github.com/cobanov/freeband/blob/main/docs/ACTIVITY.md)另外引用Gadgetbridge来源，未来复用必须逐文件核实来源及许可。本轮不移植认证/密钥/协议代码、不采用其评分。 |
| [ridd1ot/xiaomi-health-sync](https://github.com/ridd1ot/xiaomi-health-sync) | README为非官方小米云接口到本地SQLite的CLI路线，涉及账号授权；[DATA_GUIDE](https://github.com/ridd1ot/xiaomi-health-sync/blob/master/DATA_GUIDE.md)区分最新快照、日聚合、睡眠段及原始时间。根LICENSE地址未找到（404），本轮不能认定可复用源码；只作为待确认的字段/单位研究材料，不把其样例当用户数据。 |

## 平台与设备边界

- NFC不作为本项目健康数据接口。当前DeviceHealthProvider仅返回未连接/同步不可用；页面只检测浏览器是否暴露bluetooth对象，不发起权限请求、连接或扫描。
- [Web Bluetooth实现状态](https://github.com/whatwg/bluetooth/blob/main/implementation-status.md)与[Chrome官方说明](https://developer.chrome.com/docs/capabilities/bluetooth)是后续平台核验入口。Safari/iPhone/PWA不能直接按Windows Chrome能力承诺；原生CoreBluetooth另见[Apple文档](https://developer.apple.com/documentation/corebluetooth)。安装为PWA本身不会给网页增加手环协议支持。
- V1文件输入只支持Life OS健康JSON；未实现小米CSV、SQLite或活动二进制解析，不能把任意原始导出拖入后宣称已同步。

## 下一阶段（尚未实施）

1. 优先单独验证Windows电脑蓝牙与手环心率广播：由用户确认手环相关设置、电脑权限及具体固件；只读采集，记录断连/数据格式/测量时间，不能修改或清除手环历史。
2. 单独的本地适配器把已验证读数转换为V1规范，保留来源ID、指标、单位、原时区与外部记录ID；先导出健康JSON，通过当前预览/冲突检查导入。实时桥接的鉴权、允许来源、最小本地端口访问边界需另行提案，不能在UI内直接塞协议或凭证。
3. 历史数据路线先取得用户主动提供的脱敏样本，核实睡眠完整性、分期枚举、距离/能量单位、累计与小时粒度；为每个来源写转换与重复导入测试。不得把不同设备/时段的累计快照相加。
4. iPhone原生桥接需独立设备与许可评估，未经验证不显示连接成功。PWA清单/缓存仍是另一阶段，不在本轮新增。
