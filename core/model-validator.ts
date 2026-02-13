import * as https from 'https';
import * as http from 'http';

export interface ModelValidationResult {
  success: boolean;
  message: string;
  detail?: string;
  modelName?: string;
}

interface ProviderEndpoint {
  baseUrl: string;
  testPath: string;
  apiFormat: 'openai' | 'anthropic';
  testModel: string;
}

/**
 * 验证端点必须和 config-manager.ts 中的 DEFAULT_CONFIG.providers 保持一致！
 *
 * MiniMax 中国: api.minimaxi.com/anthropic → Anthropic 格式
 * GLM (zai):    open.bigmodel.cn/api/paas/v4 → OpenAI 格式
 * Doubao:       ark.cn-beijing.volces.com/api/v3 → OpenAI 格式
 * Moonshot:     api.moonshot.cn/v1 → OpenAI 格式
 */
const PROVIDER_ENDPOINTS: Record<string, ProviderEndpoint> = {
  minimax: {
    // 中国版 MiniMax — Anthropic Messages 格式
    baseUrl: 'https://api.minimaxi.com',
    testPath: '/anthropic/v1/messages',
    apiFormat: 'anthropic',
    testModel: 'MiniMax-M2.5',
  },
  zai: {
    // 智谱 GLM — OpenAI 格式
    baseUrl: 'https://open.bigmodel.cn',
    testPath: '/api/paas/v4/chat/completions',
    apiFormat: 'openai',
    testModel: 'glm-4.7-flash',
  },
  doubao: {
    // 豆包 — OpenAI 格式
    baseUrl: 'https://ark.cn-beijing.volces.com',
    testPath: '/api/v3/chat/completions',
    apiFormat: 'openai',
    testModel: 'doubao-1.5-pro-256k',
  },
  moonshot: {
    // 月之暗面 Kimi — OpenAI 格式
    baseUrl: 'https://api.moonshot.cn',
    testPath: '/v1/chat/completions',
    apiFormat: 'openai',
    testModel: 'moonshot-v1-128k',
  },
};

// 兼容旧 provider ID
const PROVIDER_ALIASES: Record<string, string> = {
  zhipu: 'zai',
};

export class ModelValidator {
  /**
   * 验证模型配置是否可用
   * 使用和 Gateway 相同的端点和格式发起真实请求
   */
  async validate(
    provider: string,
    apiKey: string,
    modelId: string
  ): Promise<ModelValidationResult> {
    if (!apiKey || apiKey.trim().length === 0) {
      return {
        success: false,
        message: 'API Key 不能为空',
        detail: '请输入有效的 API Key。',
      };
    }

    // 兼容旧的 provider ID（zhipu → zai）
    const resolvedProvider = PROVIDER_ALIASES[provider] || provider;
    const endpoint = PROVIDER_ENDPOINTS[resolvedProvider];

    if (!endpoint) {
      // 自定义 provider — 无法验证，给个友好提示
      if (provider === 'custom') {
        return {
          success: true,
          message: 'API Key 已保存（自定义供应商无法自动验证）',
          detail: '请确保 Base URL 和模型名称正确。',
        };
      }
      return {
        success: false,
        message: '不支持的模型供应商',
        detail: `供应商 "${provider}" 暂不支持验证。目前支持：MiniMax、智谱 GLM、豆包、Kimi。`,
      };
    }

    try {
      const url = endpoint.baseUrl + endpoint.testPath;
      const testModel = modelId || endpoint.testModel;

      // 根据 API 格式构造不同的请求体
      let testBody: any;
      if (endpoint.apiFormat === 'anthropic') {
        // Anthropic Messages 格式
        testBody = {
          model: testModel,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 5,
        };
      } else {
        // OpenAI Chat Completions 格式
        testBody = {
          model: testModel,
          messages: [{ role: 'user', content: '你好' }],
          max_tokens: 5,
        };
      }

      console.log(`[Validator] 测试 ${resolvedProvider}: ${url} (${endpoint.apiFormat} 格式)`);
      const result = await this.makeRequest(url, apiKey, endpoint.apiFormat);

      if (result.success) {
        return {
          success: true,
          message: '模型连接成功',
          modelName: testModel,
        };
      }

      return {
        success: false,
        message: result.error || '连接失败',
        detail: this.getErrorDetail(resolvedProvider, result.statusCode, result.error),
      };
    } catch (err: any) {
      return {
        success: false,
        message: '网络请求失败',
        detail: `无法连接到 ${provider} API：${err.message}\n\n请检查网络连接是否正常。`,
      };
    }
  }

  private makeRequest(
    url: string,
    apiKey: string,
    apiFormat: 'openai' | 'anthropic'
  ): Promise<{
    success: boolean;
    statusCode?: number;
    error?: string;
    data?: any;
  }> {
    return new Promise((resolve) => {
      const urlObj = new URL(url);
      const isHttps = urlObj.protocol === 'https:';
      const requestModule = isHttps ? https : http;

      // Anthropic 和 OpenAI 的请求体格式一样（messages + max_tokens）
      const body = {
        model: 'test',
        messages: [{ role: 'user', content: '你好' }],
        max_tokens: 5,
      };
      const data = JSON.stringify(body);

      // 构建请求头 — Anthropic 和 OpenAI 使用不同的认证方式
      const headers: Record<string, string | number> = {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      };

      if (apiFormat === 'anthropic') {
        // Anthropic 格式用 x-api-key 头
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
      } else {
        // OpenAI 格式用 Bearer token
        headers['Authorization'] = `Bearer ${apiKey}`;
      }

      const req = requestModule.request(
        {
          hostname: urlObj.hostname,
          port: urlObj.port || (isHttps ? 443 : 80),
          path: urlObj.pathname + (urlObj.search || ''),
          method: 'POST',
          headers,
          timeout: 15000,
        },
        (res) => {
          let responseBody = '';
          res.on('data', (chunk) => (responseBody += chunk));
          res.on('end', () => {
            console.log(`[Validator] 响应: ${res.statusCode} ${responseBody.slice(0, 300)}`);
            try {
              const json = JSON.parse(responseBody);

              // 成功条件：
              // OpenAI: 200 + json.choices
              // Anthropic: 200 + json.content
              if (res.statusCode === 200 && (json.choices || json.content)) {
                resolve({ success: true, data: json });
              } else if (res.statusCode === 401) {
                resolve({ success: false, statusCode: 401, error: 'API Key 无效' });
              } else if (res.statusCode === 403) {
                resolve({ success: false, statusCode: 403, error: '权限不足' });
              } else if (res.statusCode === 429) {
                // 429 说明 key 有效只是限流
                resolve({ success: true, data: { rate_limited: true } });
              } else if (res.statusCode === 400 && json.error?.type === 'invalid_request_error') {
                // Anthropic 返回 400 但 type=invalid_request_error 说明 key 有效、请求格式有问题
                // 但至少证明能连上，key 是对的
                resolve({ success: true, data: { format_issue: true } });
              } else {
                resolve({
                  success: false,
                  statusCode: res.statusCode,
                  error: json.error?.message || json.base_resp?.status_msg || json.message || '未知错误',
                });
              }
            } catch {
              // HTML 404 响应说明端点不存在
              if (res.statusCode === 404) {
                resolve({
                  success: false,
                  statusCode: 404,
                  error: 'API 端点不存在 (404)。请检查 Base URL 是否正确。',
                });
              } else {
                resolve({ success: false, statusCode: res.statusCode, error: '响应解析失败' });
              }
            }
          });
        }
      );

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: '请求超时' });
      });

      req.write(data);
      req.end();
    });
  }

  private getErrorDetail(
    provider: string,
    statusCode?: number,
    error?: string
  ): string {
    const providerNames: Record<string, string> = {
      minimax: 'MiniMax',
      zai: '智谱 GLM',
      doubao: '豆包',
      moonshot: 'Kimi',
    };
    const name = providerNames[provider] || provider;

    if (statusCode === 401) {
      return `${name} API Key 无效。\n\n请检查：\n• Key 是否正确复制（注意前后空格）\n• Key 是否已过期\n• Key 是否属于正确的账户`;
    }

    if (statusCode === 403) {
      return `${name} API 权限不足。\n\n可能原因：\n• 账户余额不足\n• 未开通对应模型的访问权限\n• 需要升级到付费套餐`;
    }

    if (statusCode === 404) {
      return `API 端点不存在 (404)。\n\n可能原因：\n• Base URL 地址不正确\n• API 路径格式和端点不匹配\n• 模型名称拼写错误`;
    }

    return `${name} API 返回错误：${error || '未知错误'}\n\n状态码：${statusCode || '无'}`;
  }
}
