# 网站代码的 Git 使用说明

本地项目：`D:\CODEX\gerenshenghuoguanliwangzhan`

GitHub 私有仓库：https://github.com/dabinglei2-hash/-

仓库名是一个英文短横线 `-`，这是账户中已有的私有仓库。

## 1. 打开终端，进入项目

```powershell
cd "D:\CODEX\gerenshenghuoguanliwangzhan"
git status
```

`working tree clean` 表示当前代码和最近一次本地提交一致。它本身不代表代码已上传；上传需要 `git push` 成功。

## 2. 每次修改后，保存版本并上传

```powershell
git status
git diff
git add .
git diff --cached --stat
git diff --cached
git commit -m "写清楚本次修改，例如：新增每周收支统计"
git push
```

- `status`：查看改了哪些文件。
- `diff`：查看尚未暂存的具体修改。
- `add`：选中本次要保存的修改。
- `diff --cached`：检查即将提交的修改，确认没有误加个人数据或密钥。
- `commit`：在电脑上保存一个版本。
- `push`：将已保存的版本上传到 GitHub；首次使用可能需要登录授权。

没有修改时，`commit` 提示 `nothing to commit`，是正常情况。

## 3. 查看历史版本

```powershell
git log --oneline --graph --all -20
git show --stat HEAD
git remote -v
```

`git log` 左侧的短编号是版本编号。查看指定版本的修改，例如：

```powershell
git show 8189aa9 --stat
```

如果进入分页界面，按 `q` 退出。

网页查看：打开上面的 GitHub 仓库，点击提交次数或 Commits，选择一条提交即可比较改动。

## 4. 尝试较大的新功能

先提交现有修改，再创建功能分支：

```powershell
git switch -c feature/weekly-report
```

修改后，照常 `git add`、`git commit`，第一次上传该分支使用：

```powershell
git push -u origin feature/weekly-report
```

确认功能可用、修改已提交后，合并回主分支：

```powershell
git switch main
git merge feature/weekly-report
git push
```

## 5. 换电脑恢复代码

安装 Git 并登录有仓库访问权限的 GitHub 账户后：

```powershell
git clone https://github.com/dabinglei2-hash/-.git personal-life
cd personal-life
```

这会下载已经上传的代码和版本记录。如果在两台电脑上轮流修改，在开始修改前先运行 `git pull --ff-only`；有报错时先处理，不要强制覆盖。

## 6. 生活数据另外备份

当前网站的实际记录保存在浏览器 localStorage 中。Git 保存代码文件，不会自动保存浏览器里的账单、妙想和个人资料。

请在原来的浏览器、原来的打开地址进入网站的“数据备份”，导出完整 v6 JSON，保存在另外的备份位置。换电脑后，在网站中检查摘要并导入该数据文件。

`.gitignore` 已排除 `backups/`、`work/`、`qa/`、网站默认名称的个人数据导出文件、环境变量及常见私钥文件。改名后的数据文件仍需自行检查。旧手动备份和验收截图保留在本机，不属于当前代码仓库；原有报告中的部分本地路径在 GitHub 上无法打开。

## 本次演示

1. 第一个提交 `8189aa9`：保存现有网站代码及 Git 忽略规则。
2. 第二个提交：加入这份操作说明，演示如何通过新提交保存下一次改动。

当前版本历史从这次初始化开始；原来 `backups/` 里的手动副本没有自动转换为历史提交。
