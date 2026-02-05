# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

Open Wegram Bot (OWB) 是一个基于多平台部署的 Telegram 双向私聊机器人。核心特点是无需数据库、无需服务器、完全无状态设计,支持在 Cloudflare Workers、Vercel、Deno Deploy、Netlify 和 EdgeOne 等多个平台上部署。

## 常用命令

### 部署命令
```bash
# Cloudflare Workers 部署
npm run deploy
# 或
npx wrangler deploy

# 设置 Secret Token (Cloudflare Workers)
npx wrangler secret put SECRET_TOKEN
```

### 开发依赖安装
```bash
npm install
```

## 核心架构

### 多平台适配架构

项目采用**核心逻辑分离**的设计模式,将业务逻辑与平台适配层解耦:

- **核心逻辑层** (`src/core.js`): 包含所有业务逻辑,与平台无关
  - `handleRequest()`: 主请求处理函数,路由分发
  - `handleInstall()`: Bot 注册逻辑
  - `handleUninstall()`: Bot 卸载逻辑
  - `handleWebhook()`: Telegram webhook 消息处理
  - `postToTelegramApi()`: Telegram API 调用封装
  - `validateSecretToken()`: 安全令牌验证

- **平台适配层**: 各平台入口文件负责将平台特定的请求/响应格式转换为标准 Web API 格式
  - `src/worker.js`: Cloudflare Workers 入口
  - `api/index.js`: Vercel 入口
  - `deno/server.js`: Deno Deploy 入口
  - `netlify/edge-functions/server.js`: Netlify 入口
  - `functions/[[index]].js`: EdgeOne 入口

### URL 路由模式

所有请求通过 URL 路径进行路由,格式为:
- 注册 Bot: `/{PREFIX}/install/{OWNER_UID}/{BOT_TOKEN}`
- 卸载 Bot: `/{PREFIX}/uninstall/{BOT_TOKEN}`
- Webhook 回调: `/{PREFIX}/webhook/{OWNER_UID}/{BOT_TOKEN}`

### 环境变量配置

不同平台使用不同的环境变量名称:

| 平台 | PREFIX 变量名 | SECRET_TOKEN 变量名 |
|------|--------------|-------------------|
| Cloudflare Workers | `PREFIX` | `SECRET_TOKEN` |
| Vercel | `PREFIX` | `SECRET_TOKEN` |
| Deno Deploy | `PREFIX` | `SECRET_TOKEN` |
| Netlify | `NETLIFY_PREFIX` | `SECRET_TOKEN` |
| EdgeOne | `EDGEONE_PREFIX` | `SECRET_TOKEN` |

**重要**: `SECRET_TOKEN` 必须至少 16 位,且包含大小写字母和数字。

### 消息处理流程

1. **接收用户消息**: 用户向 Bot 发送消息 → Telegram 调用 webhook → 验证 secret token → 转发消息给 owner (带发送者信息的 inline keyboard)
2. **回复用户消息**: Owner 回复转发的消息 → Bot 检测到 reply_to_message → 从 inline keyboard 提取原发送者 UID → 将回复发送给原发送者

### 安全机制

- 使用 Telegram 的 `X-Telegram-Bot-Api-Secret-Token` header 验证 webhook 请求
- Secret token 在注册时设置到 Telegram webhook 配置中
- 每个请求都会验证 secret token,防止未授权访问

## 重要注意事项

1. **无状态设计**: 项目完全无状态,不使用任何数据库或持久化存储。所有用户信息通过 Telegram 的 inline keyboard 传递。

2. **多 Bot 支持**: 一个部署实例可以注册多个不同的 Bot,每个 Bot 使用不同的 token 和 owner UID。

3. **修改 Secret Token 的影响**: 如果修改已部署实例的 `SECRET_TOKEN`,所有已注册的 Bot 将失效,需要重新注册。

4. **平台特定配置**:
   - EdgeOne 部署后必须绑定自定义域名,默认域名仅供预览且有效期 3 小时
   - Cloudflare Workers 默认域名在某些地区可能无法访问,建议绑定自定义域名

5. **代码修改原则**:
   - 修改核心逻辑时,只需修改 `src/core.js`
   - 添加新平台支持时,创建新的适配层文件,调用 `handleRequest()`
   - 保持各平台适配层的一致性,确保环境变量读取方式正确
