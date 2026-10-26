# 本地编辑器与OCR资源

更新：2026-10-26。用户已批准本地依赖，不新增npm构建链。只借助这些库实现编辑/识别，不复制参考产品品牌或界面源码。

| 资源 | 固定版本与许可 | 本地位置 |
| --- | --- | --- |
| [Quill](https://github.com/slab/quill) | 2.0.3 · BSD-3-Clause | `vendor/quill/`，保留LICENSE及发行包说明 |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | 7.0.0 · Apache-2.0 | `vendor/tesseract/`，保留LICENSE.md及两份minified许可证说明 |
| [Tesseract.js-core](https://github.com/naptha/tesseract.js-core) | 7.0.0 · Apache-2.0 | `vendor/tesseract/core7/`，保留LICENSE；只使用非SIMD LSTM单文件WASM版本，兼容性优先 |
| [官方tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast/tree/4.1.0) | 4.1.0 · Apache-2.0 | `vendor/tesseract/lang/chi_sim.traineddata`，保留官方LICENSE，简体中文优先 |

- 部署资源共17份、6,914,770字节（约6.59MiB，不含manifest自身）；普通页面只读Quill脚本/CSS，OCR主脚本、Worker、WASM和模型在主动识别时加载。无运行时CDN、收费API或内容上传。
- Windows本机Python静态服务对`.js`返回`text/plain`，Worker严格检查会拒绝。为Worker和core提供字节完全相同的`.mjs`副本，返回`text/javascript`；扩展名变化不改厂商内容。Worker的原`.js`及对应LICENSE.txt一并保留。
- `vendor/MANIFEST.json`记录每份资源的来源URL、大小与SHA256；来源为固定版本npm发行档或官方模型标签。旧core6审阅资源和未用core7变体只移到本轮`work/ideas-editor-20261025/unused-audit-resources/`，不在运行入口加载。
- 原生相机依设备；OCR错误率、内存和真实iPhone耗时未保证。首次本地资源加载失败应报错/重试，不能替换为外部服务。
- BSD/Apache许可及本地声明须随这些资源保留。以上是本轮资源来源核实，不是对整个项目未来商业分发的法律保证。
