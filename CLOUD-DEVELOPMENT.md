# 用手机开发和预览网站

本次练习使用分支 `learn/codespaces-mobile`。

## 打开云端环境

在手机 Safari 或 Chrome 中登录 GitHub 账户 `dabinglei2-hash`，打开 https://github.com/codespaces ，选择这个仓库的现有环境，点“Open in browser”。优先打开已有环境，避免重复创建。

屏幕太小时，横屏并在浏览器菜单中开启“请求桌面网站”。在编辑器左侧文件列表打开 `index.html`。

## 做一次小修改

在 `index.html` 搜索这句：

```text
把每一天过得更清晰
```

把它改成：

```text
把每一天过得更清晰 · 手机测试
```

通过编辑器菜单 File → Save 保存。若已由助手完成了这次测试，可把“手机测试”换成自己的短句，再保存一次。

## 预览网站

云端配置会在环境启动时运行 8000 端口网页服务。打开底部“Ports / 端口”，找到标为“网站预览”的 8000 端口，点击“Open in Browser / 在浏览器中打开”。默认使用 Private 可见性，用同一个 GitHub 账户登录后访问。

在手机窄屏下，左侧品牌副标题会被隐藏；要核对这句文字，可打开网页源代码，或在预览浏览器中请求桌面网站。测试修改还会把网页标签标题改为“我的生活管理台 · 手机测试”，方便手机查看。

如果服务未启动，在编辑器的终端执行：

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

之后刷新预览网页。若终端提示端口已被占用，通常表示服务已经运行，不要重复启动。

## 保存并上传版本

可以在左侧“Source Control / 源代码管理”里检查改动、输入提交说明、提交并推送，也可以在终端执行：

```bash
git status
git add index.html
git commit -m "测试：从手机修改网站文字"
git push
```

## 使用结束

先提交并推送需要保留的改动，再回到 https://github.com/codespaces ，点击环境右侧菜单中的 Stop codespace。以后打开同一个环境即可继续。

预览地址属于开发环境，环境停止时不能访问。Codespaces 的运行和存储会使用账户额度，可在 GitHub 账户的 Billing and licensing 页面查看。

原网站的生活记录保存在原浏览器的 localStorage 中，云端预览不会自动带入那些记录；这次练习只操作代码。
