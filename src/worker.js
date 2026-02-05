/**
 * Open Wegram Bot - Cloudflare Worker Entry Point
 * A two-way private messaging Telegram bot
 *
 * GitHub Repository: https://github.com/wozulong/open-wegram-bot
 */

import {handleRequest} from './core.js';

export default {
    async fetch(request, env, ctx) {
        const config = {
            prefix: env.PREFIX || 'public',
            secretToken: env.SECRET_TOKEN || '',
            // 修改点：添加人机验证功能 - 添加验证配置
            verificationEnabled: env.VERIFICATION_ENABLED === 'true',
            verificationTimeoutDays: parseInt(env.VERIFICATION_TIMEOUT_DAYS || '7')
        };

        // 修改点：添加人机验证功能 - 传递 KV binding
        return handleRequest(request, config, env.VERIFICATION_KV);
    }
};