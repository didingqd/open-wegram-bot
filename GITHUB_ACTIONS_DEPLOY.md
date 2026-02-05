# GitHub Actions 自动部署指南

本文档说明如何使用 GitHub Actions 自动部署 Open Wegram Bot 到 Cloudflare Workers。

## 功能特点

- ✅ 自动部署到 Cloudflare Workers
- ✅ 支持手动触发和自动触发（推送到 master 分支）
- ✅ 通过 GitHub Secrets 安全管理配置
- ✅ 可选配置：未设置的 secrets 不会传递，保持默认行为
- ✅ 自动启用 KV namespace（如果配置了 KV_NAMESPACE_ID）
- ✅ 部署完成后显示配置摘要

## 配置步骤

### 1. 必需的 Secrets（必须配置）

在 GitHub 仓库的 `Settings` → `Secrets and variables` → `Actions` 中添加以下 secrets：

| Secret 名称 | 说明 | 获取方式 |
|------------|------|---------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API Token | 在 Cloudflare Dashboard → My Profile → API Tokens → Create Token |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID | 在 Cloudflare Dashboard → Workers & Pages → 右侧栏可以看到 Account ID |

**创建 API Token 的权限要求**：
- Account - Cloudflare Workers Scripts - Edit
- Account - Cloudflare Workers KV Storage - Edit（如果使用 KV）

### 2. 可选的 Secrets（按需配置）

以下 secrets 都是可选的，如果不设置，将使用默认值或禁用相应功能：

| Secret 名称 | 说明 | 默认值 | 示例 |
|------------|------|--------|------|
| `KV_NAMESPACE_ID` | KV namespace ID（启用验证功能） | 未配置（验证功能禁用） | `abc123def456` |
| `PREFIX` | URL 路径前缀 | `public` | `my-bot` |
| `SECRET_TOKEN` | Webhook 安全令牌 | 空 | `MySecureToken123` |
| `VERIFICATION_ENABLED` | 是否启用人机验证 | `false` | `true` |
| `VERIFICATION_TIMEOUT_DAYS` | 验证有效期（天数） | `7` | `14` |

### 3. 创建 KV Namespace（可选，仅当需要验证功能时）

如果需要启用人机验证功能，需要先创建 KV namespace：

```bash
# 本地创建 KV namespace
npx wrangler kv:namespace create "VERIFICATION_KV"

# 输出示例：
# 🌀 Creating namespace with title "open-wegram-bot-VERIFICATION_KV"
# ✨ Success!
# Add the following to your configuration file in your kv_namespaces array:
# { binding = "VERIFICATION_KV", id = "abc123def456" }
```

将返回的 `id` 值（如 `abc123def456`）添加到 GitHub Secrets 中的 `KV_NAMESPACE_ID`。

## 使用方法

### 方式 1：自动部署（推荐）

当你推送代码到 `master` 分支，且修改了以下文件时，会自动触发部署：
- `src/**` - 源代码
- `wrangler.toml` - 配置文件
- `package.json` - 依赖配置
- `.github/workflows/deploy.yml` - 部署脚本

```bash
git add .
git commit -m "Update bot code"
git push origin master
```

### 方式 2：手动部署

1. 进入 GitHub 仓库页面
2. 点击 `Actions` 标签
3. 选择 `Deploy to Cloudflare Workers` workflow
4. 点击 `Run workflow` 按钮
5. 选择分支（通常是 `master`）
6. 点击 `Run workflow` 确认

## 部署流程说明

部署脚本会按以下步骤执行：

1. **检出代码** - 从 GitHub 拉取最新代码
2. **安装依赖** - 安装 npm 依赖包
3. **配置 KV**（可选）- 如果设置了 `KV_NAMESPACE_ID`，自动修改 `wrangler.toml` 启用 KV 配置
4. **部署到 Cloudflare** - 使用 wrangler 部署到 Cloudflare Workers
5. **设置环境变量** - 将 GitHub Secrets 中的环境变量同步到 Cloudflare Workers
6. **显示部署摘要** - 在 Actions 页面显示配置信息

## 配置示例

### 示例 1：最小配置（仅消息转发，无验证）

只需配置必需的 secrets：

```
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
```

其他 secrets 不设置，Bot 将使用默认配置，保持原有的消息转发功能。

### 示例 2：完整配置（启用验证功能）

配置所有 secrets：

```
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
KV_NAMESPACE_ID=abc123def456
PREFIX=my-bot
SECRET_TOKEN=MySecureToken123ABC
VERIFICATION_ENABLED=true
VERIFICATION_TIMEOUT_DAYS=7
```

这将启用人机验证功能，用户首次发消息时需要完成数学题验证。

### 示例 3：自定义配置（部分可选项）

只配置部分可选 secrets：

```
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ACCOUNT_ID=your_account_id
PREFIX=my-custom-prefix
SECRET_TOKEN=MySecureToken123ABC
```

这将使用自定义的 PREFIX 和 SECRET_TOKEN，但不启用验证功能。

## 查看部署结果

部署完成后，可以在 Actions 页面查看：

1. 点击具体的 workflow run
2. 查看 `Deploy to Cloudflare Workers` job
3. 在 `Summary` 标签页可以看到部署摘要，包括：
   - KV Namespace 配置状态
   - PREFIX 配置状态
   - SECRET_TOKEN 配置状态
   - VERIFICATION_ENABLED 配置状态
   - VERIFICATION_TIMEOUT_DAYS 配置状态

## 故障排查

### 部署失败：API Token 权限不足

**错误信息**：`Authentication error`

**解决方法**：
1. 检查 `CLOUDFLARE_API_TOKEN` 是否正确
2. 确认 API Token 具有以下权限：
   - Account - Cloudflare Workers Scripts - Edit
   - Account - Cloudflare Workers KV Storage - Edit（如果使用 KV）

### 部署失败：Account ID 错误

**错误信息**：`Account not found`

**解决方法**：
1. 检查 `CLOUDFLARE_ACCOUNT_ID` 是否正确
2. 在 Cloudflare Dashboard → Workers & Pages 页面右侧栏查看正确的 Account ID

### KV 配置未生效

**症状**：设置了 `KV_NAMESPACE_ID` 但验证功能未启用

**解决方法**：
1. 确认 `VERIFICATION_ENABLED` 设置为 `true`
2. 确认 `KV_NAMESPACE_ID` 是有效的 namespace ID
3. 查看部署日志，确认 "检测到 KV_NAMESPACE_ID，启用 KV 配置..." 消息出现

### 环境变量未生效

**症状**：设置了环境变量但 Bot 行为未改变

**解决方法**：
1. 检查 GitHub Secrets 中的变量名是否正确（区分大小写）
2. 查看部署摘要，确认变量显示为"已配置"
3. 重新触发部署

## 安全建议

1. **保护 Secrets**：
   - 不要在代码或日志中暴露 secrets
   - 定期轮换 API Token
   - 使用最小权限原则配置 API Token

2. **SECRET_TOKEN 要求**：
   - 至少 16 位
   - 包含大小写字母和数字
   - 避免使用简单的密码

3. **分支保护**：
   - 建议启用 `master` 分支保护
   - 要求 PR review 后才能合并
   - 防止意外部署

## 与本地部署的区别

| 特性 | GitHub Actions 部署 | 本地部署 |
|------|-------------------|---------|
| 配置方式 | GitHub Secrets | 本地环境变量 + wrangler.toml |
| KV 配置 | 自动修改 wrangler.toml | 手动修改 wrangler.toml |
| 环境变量 | 通过 wrangler-action 传递 | 通过 wrangler secret put 设置 |
| 触发方式 | 自动（推送）或手动 | 手动执行 npm run deploy |
| 适用场景 | CI/CD 自动化 | 本地开发测试 |

## 相关文档

- [Cloudflare Workers 文档](https://developers.cloudflare.com/workers/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions 文档](https://docs.github.com/en/actions)
- [项目 README](./README.md)
