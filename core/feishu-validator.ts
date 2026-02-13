import * as https from 'https';

export interface ValidationStep {
  id: string;
  label: string;
  status: 'pending' | 'checking' | 'success' | 'warning' | 'error';
  message?: string;
  detail?: string;
  action?: {
    label: string;
    url?: string;
    type?: 'link' | 'retry';
  };
}

interface FeishuTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

export class FeishuValidator {
  private token: string = '';

  /**
   * 逐步校验飞书配置，异步生成器
   */
  async *validate(appId: string, appSecret: string): AsyncGenerator<ValidationStep> {
    // === 第一步：凭证验证 ===
    yield {
      id: 'credentials',
      label: '凭证验证',
      status: 'checking',
      message: '正在验证 App ID 和 App Secret...',
    };

    const tokenResult = await this.getToken(appId, appSecret);

    if (!tokenResult.success) {
      yield {
        id: 'credentials',
        label: '凭证验证',
        status: 'error',
        message: tokenResult.error || 'App ID 或 App Secret 不正确',
        detail: this.getCredentialErrorDetail(tokenResult.code),
        action: {
          label: '查看获取教程',
          url: 'https://open.feishu.cn/app',
          type: 'link',
        },
      };
      return; // 凭证不对，后续无法继续
    }

    this.token = tokenResult.token!;
    yield {
      id: 'credentials',
      label: '凭证验证',
      status: 'success',
      message: 'App ID 和 App Secret 验证通过',
    };

    // === 第二步：权限检查 ===
    yield {
      id: 'permissions',
      label: '权限检查',
      status: 'checking',
      message: '正在检查应用权限...',
    };

    const permResult = await this.checkPermissions();

    if (permResult.missing.length > 0) {
      yield {
        id: 'permissions',
        label: '权限检查',
        status: 'warning',
        message: `缺少 ${permResult.missing.length} 项权限`,
        detail: `缺少权限：${permResult.missing.join('、')}\n\n请前往飞书开放平台 → 权限管理，搜索并开通以上权限。`,
        action: {
          label: '前往配置权限',
          url: `https://open.feishu.cn/app/${appId}/permission`,
          type: 'link',
        },
      };
    } else {
      yield {
        id: 'permissions',
        label: '权限检查',
        status: 'success',
        message: '消息收发权限已开通',
      };
    }

    // === 第三步：应用状态 ===
    yield {
      id: 'app_status',
      label: '应用状态',
      status: 'checking',
      message: '正在检查应用发布状态...',
    };

    const statusResult = await this.checkAppStatus(appId);

    if (!statusResult.published) {
      yield {
        id: 'app_status',
        label: '应用状态',
        status: 'warning',
        message: '应用尚未发布',
        detail:
          '你的飞书应用尚未发布，机器人将无法接收消息。\n\n请前往「版本管理与发布」→ 创建新版本 → 提交审核。\n\n企业自建应用通常会自动审核通过。',
        action: {
          label: '前往发布',
          url: `https://open.feishu.cn/app/${appId}/version`,
          type: 'link',
        },
      };
    } else {
      yield {
        id: 'app_status',
        label: '应用状态',
        status: 'success',
        message: '应用已发布',
      };
    }

    // === 第四步：机器人能力 ===
    yield {
      id: 'bot_capability',
      label: '机器人能力',
      status: 'checking',
      message: '正在检查机器人能力...',
    };

    const botResult = await this.checkBotCapability(appId);

    if (!botResult.hasBot) {
      yield {
        id: 'bot_capability',
        label: '机器人能力',
        status: 'error',
        message: '未添加机器人能力',
        detail:
          '你的应用尚未添加「机器人」能力。\n\n请前往应用详情 → 添加应用能力 → 勾选「机器人」。',
        action: {
          label: '前往添加',
          url: `https://open.feishu.cn/app/${appId}/bot`,
          type: 'link',
        },
      };
    } else {
      yield {
        id: 'bot_capability',
        label: '机器人能力',
        status: 'success',
        message: '机器人能力已启用',
      };
    }

    // === 第五步：事件订阅（长连接）===
    yield {
      id: 'event_subscription',
      label: '事件订阅',
      status: 'checking',
      message: '正在检查事件订阅配置...',
    };

    const eventResult = await this.checkEventSubscription(appId);

    if (!eventResult.configured) {
      yield {
        id: 'event_subscription',
        label: '事件订阅',
        status: 'warning',
        message: eventResult.message || '事件订阅未配置',
        detail:
          '请前往「事件订阅」页面：\n\n1. 选择「使用长连接接收事件」\n2. 添加事件：im.message.receive_v1\n3. 保存配置\n\n长连接模式无需公网地址，推荐使用。',
        action: {
          label: '前往配置',
          url: `https://open.feishu.cn/app/${appId}/event`,
          type: 'link',
        },
      };
    } else {
      yield {
        id: 'event_subscription',
        label: '事件订阅',
        status: 'success',
        message: '事件订阅已配置',
      };
    }
  }

  /**
   * 获取飞书 tenant_access_token
   */
  private async getToken(
    appId: string,
    appSecret: string
  ): Promise<{
    success: boolean;
    token?: string;
    error?: string;
    code?: number;
  }> {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        app_id: appId,
        app_secret: appSecret,
      });

      const req = https.request(
        {
          hostname: 'open.feishu.cn',
          path: '/open-apis/auth/v3/tenant_access_token/internal',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
          timeout: 10000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const json: FeishuTokenResponse = JSON.parse(body);
              if (json.code === 0 && json.tenant_access_token) {
                resolve({ success: true, token: json.tenant_access_token });
              } else {
                resolve({
                  success: false,
                  error: json.msg || '认证失败',
                  code: json.code,
                });
              }
            } catch {
              resolve({ success: false, error: '响应解析失败' });
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({
          success: false,
          error: `网络请求失败：${err.message}`,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({
          success: false,
          error: '请求超时，请检查网络连接',
        });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * 检查应用权限 — 通过实际调用需要权限的 API 来检测
   */
  private async checkPermissions(): Promise<{ missing: string[] }> {
    const missing: string[] = [];

    // 检查 im:message 相关权限（尝试获取聊天列表）
    try {
      const chatResult = await this.apiGet('/open-apis/im/v1/chats?page_size=1');
      if (chatResult.code === 99991672) {
        // 权限不足，从错误信息中提取缺失的权限
        const msg: string = chatResult.msg || '';
        const match = msg.match(/\[([^\]]+)\]/);
        if (match) {
          missing.push(`聊天权限 (${match[1].split(',').map((s: string) => s.trim()).join(' / ')})`);
        } else {
          missing.push('im:chat 相关权限');
        }
      }
    } catch {
      // 网络错误等，跳过
    }

    // 检查 im:message:send_as_bot 权限（尝试发消息接口但不实际发送）
    try {
      // 用一个无效的 receive_id 测试，只看权限错误
      const sendResult = await this.apiPost('/open-apis/im/v1/messages?receive_id_type=open_id', {
        receive_id: 'test_permission_check',
        msg_type: 'text',
        content: '{}',
      });
      if (sendResult.code === 99991672) {
        const msg: string = sendResult.msg || '';
        const match = msg.match(/\[([^\]]+)\]/);
        if (match) {
          missing.push(`发消息权限 (${match[1].split(',').map((s: string) => s.trim()).join(' / ')})`);
        } else {
          missing.push('im:message:send_as_bot 权限');
        }
      }
      // 其他错误码（如参数错误）说明权限是有的，只是参数不对
    } catch {
      // 网络错误，跳过
    }

    return { missing };
  }

  /**
   * 检查应用发布状态
   */
  private async checkAppStatus(
    appId: string
  ): Promise<{ published: boolean; status?: string }> {
    try {
      // 通过 bot info 接口间接判断
      const result = await this.apiGet('/open-apis/bot/v3/info/');
      if (result && result.code === 0) {
        return { published: true };
      }
      return { published: false };
    } catch {
      return { published: false };
    }
  }

  /**
   * 检查机器人能力
   */
  private async checkBotCapability(
    appId: string
  ): Promise<{ hasBot: boolean }> {
    try {
      const result = await this.apiGet('/open-apis/bot/v3/info/');
      if (result && result.code === 0 && result.bot) {
        return { hasBot: true };
      }
      return { hasBot: result?.code === 0 };
    } catch {
      return { hasBot: false };
    }
  }

  /**
   * 检查事件订阅
   * 飞书 API 无法直接查询事件订阅状态，但可以通过间接方式判断
   */
  private async checkEventSubscription(
    appId: string
  ): Promise<{ configured: boolean; message?: string }> {
    // 事件订阅状态无法通过公开 API 查询
    // 返回 warning 提醒用户自行确认，而非假装已配置
    return {
      configured: false,
      message: '无法自动检测 — 请手动确认已配置长连接事件订阅',
    };
  }

  /**
   * 通用 POST 请求
   */
  private apiPost(apiPath: string, body: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const req = https.request(
        {
          hostname: 'open.feishu.cn',
          path: apiPath,
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
          },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(data));
            } catch {
              reject(new Error('响应解析失败'));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      req.write(postData);
      req.end();
    });
  }

  /**
   * 通用 GET 请求
   */
  private apiGet(apiPath: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'open.feishu.cn',
          path: apiPath,
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        },
        (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              resolve(JSON.parse(body));
            } catch {
              reject(new Error('响应解析失败'));
            }
          });
        }
      );

      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
      req.end();
    });
  }

  /**
   * 根据错误码返回详细说明
   */
  private getCredentialErrorDetail(code?: number): string {
    const details: Record<number, string> = {
      10003: '请检查 App ID 是否正确。确保从飞书开放平台「凭证与基础信息」页面复制，注意前后不要有空格。',
      10014: '请检查 App Secret 是否正确。Secret 只在创建时显示一次，如果忘记可以在开放平台重新生成。',
      10015: 'App ID 和 App Secret 不匹配。请确认它们来自同一个应用。',
    };

    return (
      details[code || 0] ||
      '请确认 App ID 和 App Secret 来自同一个飞书应用，且应用类型为「企业自建应用」。'
    );
  }
}
