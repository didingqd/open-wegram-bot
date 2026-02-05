/**
 * Open Wegram Bot - Core Logic
 * Shared code between Cloudflare Worker and Vercel deployments
 */

export function validateSecretToken(token) {
    return token.length > 15 && /[A-Z]/.test(token) && /[a-z]/.test(token) && /[0-9]/.test(token);
}

// 修改点：添加人机验证功能 - 生成随机数学题
export function generateMathQuestion() {
    const num1 = Math.floor(Math.random() * 20) + 1;
    const num2 = Math.floor(Math.random() * 20) + 1;
    const operators = ['+', '-', '×'];
    const operator = operators[Math.floor(Math.random() * operators.length)];

    let answer;
    let question;

    switch (operator) {
        case '+':
            answer = num1 + num2;
            question = `${num1} + ${num2} = ?`;
            break;
        case '-':
            // 确保结果为正数
            if (num1 >= num2) {
                answer = num1 - num2;
                question = `${num1} - ${num2} = ?`;
            } else {
                answer = num2 - num1;
                question = `${num2} - ${num1} = ?`;
            }
            break;
        case '×':
            answer = num1 * num2;
            question = `${num1} × ${num2} = ?`;
            break;
    }

    return { question, answer };
}

// 修改点：添加人机验证功能 - 检查用户验证状态
export async function checkVerification(kv, botToken, userId, timeoutDays) {
    if (!kv) {
        return { verified: true, needReVerify: false };
    }

    try {
        const key = `verified_user:${botToken}:${userId}`;
        const data = await kv.get(key);

        if (!data) {
            return { verified: false, needReVerify: false };
        }

        const record = JSON.parse(data);
        const now = Date.now();
        const timeoutMs = timeoutDays * 24 * 60 * 60 * 1000;

        if (now - record.lastMessageTime > timeoutMs) {
            return { verified: true, needReVerify: true };
        }

        return { verified: true, needReVerify: false };
    } catch (error) {
        console.error('Error checking verification:', error);
        return { verified: true, needReVerify: false };
    }
}

// 修改点：添加人机验证功能 - 更新验证记录
export async function updateVerification(kv, botToken, userId) {
    if (!kv) {
        return;
    }

    try {
        const key = `verified_user:${botToken}:${userId}`;
        const now = Date.now();

        const existingData = await kv.get(key);
        let record;

        if (existingData) {
            record = JSON.parse(existingData);
            record.lastMessageTime = now;
        } else {
            record = {
                userId,
                lastMessageTime: now,
                verifiedAt: now
            };
        }

        await kv.put(key, JSON.stringify(record));
    } catch (error) {
        console.error('Error updating verification:', error);
    }
}

// 修改点：添加人机验证功能 - 发送验证消息
export async function sendVerificationMessage(botToken, chatId, userId) {
    try {
        const { question, answer } = generateMathQuestion();

        // 生成3个错误答案
        const wrongAnswers = [];
        while (wrongAnswers.length < 3) {
            const wrong = answer + Math.floor(Math.random() * 10) - 5;
            if (wrong !== answer && !wrongAnswers.includes(wrong) && wrong >= 0) {
                wrongAnswers.push(wrong);
            }
        }

        // 将正确答案和错误答案混合并随机排序
        const allAnswers = [answer, ...wrongAnswers];
        allAnswers.sort(() => Math.random() - 0.5);

        // 构造 inline_keyboard
        const keyboard = allAnswers.map(ans => [{
            text: ans.toString(),
            callback_data: `verify:${userId}:${ans}`
        }]);

        await postToTelegramApi(botToken, 'sendMessage', {
            chat_id: chatId,
            text: `🤖 请完成验证以继续使用：\n\n${question}\n\n请选择正确答案：`,
            reply_markup: {
                inline_keyboard: keyboard
            }
        });
    } catch (error) {
        console.error('Error sending verification message:', error);
    }
}

// 修改点：添加人机验证功能 - 处理 callback_query
export async function handleCallbackQuery(update, botToken, kv, ownerUid) {
    const callbackQuery = update.callback_query;
    const callbackData = callbackQuery.data;

    try {
        // 解析 callback_data: verify:{userId}:{answer}
        if (!callbackData.startsWith('verify:')) {
            return new Response('OK');
        }

        const parts = callbackData.split(':');
        if (parts.length !== 3) {
            return new Response('OK');
        }

        const userId = parts[1];
        const userAnswer = parseInt(parts[2]);

        // 从原始消息中提取问题并计算正确答案
        const messageText = callbackQuery.message.text;
        const questionMatch = messageText.match(/(\d+)\s*([+\-×])\s*(\d+)\s*=\s*\?/);

        if (!questionMatch) {
            return new Response('OK');
        }

        const num1 = parseInt(questionMatch[1]);
        const operator = questionMatch[2];
        const num2 = parseInt(questionMatch[3]);

        let correctAnswer;
        switch (operator) {
            case '+':
                correctAnswer = num1 + num2;
                break;
            case '-':
                correctAnswer = num1 - num2;
                break;
            case '×':
                correctAnswer = num1 * num2;
                break;
        }

        if (userAnswer === correctAnswer) {
            // 答案正确，存储验证状态
            await updateVerification(kv, botToken, userId);

            // 回复验证成功
            await postToTelegramApi(botToken, 'answerCallbackQuery', {
                callback_query_id: callbackQuery.id,
                text: '✅ 验证成功！'
            });

            // 编辑原消息
            await postToTelegramApi(botToken, 'editMessageText', {
                chat_id: callbackQuery.message.chat.id,
                message_id: callbackQuery.message.message_id,
                text: '✅ 验证成功！您现在可以发送消息了。'
            });
        } else {
            // 答案错误
            await postToTelegramApi(botToken, 'answerCallbackQuery', {
                callback_query_id: callbackQuery.id,
                text: '❌ 答案错误，请重试'
            });

            // 重新发送验证消息
            await sendVerificationMessage(botToken, callbackQuery.message.chat.id, userId);
        }

        return new Response('OK');
    } catch (error) {
        console.error('Error handling callback query:', error);
        return new Response('OK');
    }
}

export function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {'Content-Type': 'application/json'}
    });
}

export async function postToTelegramApi(token, method, body) {
    return fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(body)
    });
}

export async function handleInstall(request, ownerUid, botToken, prefix, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    const url = new URL(request.url);
    const baseUrl = `${url.protocol}//${url.hostname}`;
    const webhookUrl = `${baseUrl}/${prefix}/webhook/${ownerUid}/${botToken}`;

    try {
        // 修改点：添加人机验证功能 - 添加 callback_query 到 allowed_updates
        const response = await postToTelegramApi(botToken, 'setWebhook', {
            url: webhookUrl,
            allowed_updates: ['message', 'callback_query'],
            secret_token: secretToken
        });

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully installed.'});
        }

        return jsonResponse({success: false, message: `Failed to install webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error installing webhook: ${error.message}`}, 500);
    }
}

export async function handleUninstall(botToken, secretToken) {
    if (!validateSecretToken(secretToken)) {
        return jsonResponse({
            success: false,
            message: 'Secret token must be at least 16 characters and contain uppercase letters, lowercase letters, and numbers.'
        }, 400);
    }

    try {
        const response = await postToTelegramApi(botToken, 'deleteWebhook', {})

        const result = await response.json();
        if (result.ok) {
            return jsonResponse({success: true, message: 'Webhook successfully uninstalled.'});
        }

        return jsonResponse({success: false, message: `Failed to uninstall webhook: ${result.description}`}, 400);
    } catch (error) {
        return jsonResponse({success: false, message: `Error uninstalling webhook: ${error.message}`}, 500);
    }
}

// 修改点：添加人机验证功能 - 添加 kv 和 config 参数
export async function handleWebhook(request, ownerUid, botToken, secretToken, kv, config) {
    if (secretToken !== request.headers.get('X-Telegram-Bot-Api-Secret-Token')) {
        return new Response('Unauthorized', {status: 401});
    }

    const update = await request.json();

    // 修改点：添加人机验证功能 - 处理 callback_query
    if (update.callback_query) {
        return handleCallbackQuery(update, botToken, kv, ownerUid);
    }

    if (!update.message) {
        return new Response('OK');
    }

    const message = update.message;
    const reply = message.reply_to_message;
    try {
        if (reply && message.chat.id.toString() === ownerUid) {
            const rm = reply.reply_markup;
            if (rm && rm.inline_keyboard && rm.inline_keyboard.length > 0) {
                let senderUid = rm.inline_keyboard[0][0].callback_data;
                if (!senderUid) {
                    senderUid = rm.inline_keyboard[0][0].url.split('tg://user?id=')[1];
                }

                await postToTelegramApi(botToken, 'copyMessage', {
                    chat_id: parseInt(senderUid),
                    from_chat_id: message.chat.id,
                    message_id: message.message_id
                });
            }

            return new Response('OK');
        }

        if ("/start" === message.text) {
            return new Response('OK');
        }

        const sender = message.chat;
        const senderUid = sender.id.toString();
        const senderName = sender.username ? `@${sender.username}` : [sender.first_name, sender.last_name].filter(Boolean).join(' ');

        // 修改点：添加人机验证功能 - 验证检查
        if (config && config.verificationEnabled && kv) {
            const verifyResult = await checkVerification(kv, botToken, senderUid, config.verificationTimeoutDays);

            if (!verifyResult.verified || verifyResult.needReVerify) {
                await sendVerificationMessage(botToken, message.chat.id, senderUid);
                return new Response('OK');
            }

            // 更新最后通信时间
            await updateVerification(kv, botToken, senderUid);
        }

        const copyMessage = async function (withUrl = false) {
            const ik = [[{
                text: `🔏 From: ${senderName} (${senderUid})`,
                callback_data: senderUid,
            }]];

            if (withUrl) {
                ik[0][0].text = `🔓 From: ${senderName} (${senderUid})`
                ik[0][0].url = `tg://user?id=${senderUid}`;
            }

            return await postToTelegramApi(botToken, 'copyMessage', {
                chat_id: parseInt(ownerUid),
                from_chat_id: message.chat.id,
                message_id: message.message_id,
                reply_markup: {inline_keyboard: ik}
            });
        }

        const response = await copyMessage(true);
        if (!response.ok) {
            await copyMessage();
        }

        return new Response('OK');
    } catch (error) {
        console.error('Error handling webhook:', error);
        return new Response('Internal Server Error', {status: 500});
    }
}

// 修改点：添加人机验证功能 - 添加 kv 参数
export async function handleRequest(request, config, kv) {
    const {prefix, secretToken} = config;

    const url = new URL(request.url);
    const path = url.pathname;

    const INSTALL_PATTERN = new RegExp(`^/${prefix}/install/([^/]+)/([^/]+)$`);
    const UNINSTALL_PATTERN = new RegExp(`^/${prefix}/uninstall/([^/]+)$`);
    const WEBHOOK_PATTERN = new RegExp(`^/${prefix}/webhook/([^/]+)/([^/]+)$`);

    let match;

    if (match = path.match(INSTALL_PATTERN)) {
        return handleInstall(request, match[1], match[2], prefix, secretToken);
    }

    if (match = path.match(UNINSTALL_PATTERN)) {
        return handleUninstall(match[1], secretToken);
    }

    if (match = path.match(WEBHOOK_PATTERN)) {
        // 修改点：添加人机验证功能 - 传递 kv 和 config 到 handleWebhook
        return handleWebhook(request, match[1], match[2], secretToken, kv, config);
    }

    return new Response('Not Found', {status: 404});
}