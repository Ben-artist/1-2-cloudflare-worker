# Cloudflare Worker - DeepSeek API 代理

这是一个部署在Cloudflare Workers上的API代理服务，用于解决前端应用调用DeepSeek API时的跨域问题。

## 🎯 项目目标

- 解决前端应用调用DeepSeek API的跨域问题
- 提供统一的API接口，简化前端集成
- 支持流式响应和普通响应
- 自动处理CORS预检请求

## 🏗️ 架构说明

```
前端应用 → Cloudflare Worker → DeepSeek API
```

- **前端应用**: 你的网站或应用
- **Cloudflare Worker**: 中间代理层，处理跨域和请求转发
- **DeepSeek API**: 实际的AI服务提供商

## 🔧 跨域配置详解

### CORS头部设置

```javascript
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",           // 允许所有域名访问
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",  // 支持的HTTP方法
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept, Origin",  // 允许的请求头
  "Access-Control-Allow-Credentials": "true",   // 允许携带认证信息
  "Access-Control-Max-Age": "86400",            // 预检请求缓存24小时
};
```

### 预检请求处理

当浏览器发送复杂请求时，会先发送OPTIONS预检请求：

```javascript
if (request.method === "OPTIONS") {
  return new Response(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}
```

## 📡 API接口说明

### 1. POST / - 聊天对话

**请求体格式:**
```json
{
  "messages": [
    {"role": "user", "content": "你好"}
  ],
  "systemMessage": {"role": "system", "content": "你是一个有用的助手"},
  "model": "deepseek-chat",
  "stream": true
}
```

**参数说明:**
- `messages`: 对话消息数组
- `systemMessage`: 系统角色设定（可选）
- `model`: 使用的模型名称（默认：deepseek-chat）
- `stream`: 是否使用流式响应（默认：true）

### 2. GET / - 服务状态

返回Worker的基本信息：
```json
{
  "message": "DeepSeek API Worker",
  "status": "running",
  "supportedMethods": ["POST", "OPTIONS"],
  "cors": "enabled"
}
```

### 3. OPTIONS / - 预检请求

自动处理浏览器的CORS预检请求，返回200状态码和CORS头部。

## 🚀 使用方法

### 前端JavaScript调用示例

```javascript
// 普通请求
async function chatWithAI(message) {
  try {
    const response = await fetch('https://your-worker.your-subdomain.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: message }
        ],
        stream: false
      })
    });
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('请求失败:', error);
  }
}

// 流式请求
async function streamChat(message) {
  try {
    const response = await fetch('https://your-worker.your-subdomain.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          { role: 'user', content: message }
        ],
        stream: true
      })
    });
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      console.log('收到数据:', chunk);
    }
  } catch (error) {
    console.error('流式请求失败:', error);
  }
}
```

### 测试API

```bash
# 测试GET请求
curl https://your-worker.your-subdomain.workers.dev/

# 测试POST请求
curl -X POST https://your-worker.your-subdomain.workers.dev/ \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"你好"}]}'

# 测试OPTIONS预检请求
curl -X OPTIONS https://your-worker.your-subdomain.workers.dev/ \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

## ⚙️ 部署配置

### 环境变量

在`wrangler.jsonc`中配置：
```json
{
  "name": "cloudflare-worker",
  "main": "src/index.js",
  "compatibility_date": "2024-08-01",
  "vars": {
    "DEEPSEEK_API_KEY": "your-api-key-here"
  }
}
```

### 部署命令

```bash
# 安装依赖
pnpm install

# 本地测试
pnpm run dev

# 部署到Cloudflare
pnpm run deploy
```

## 🔍 常见问题解决

### 1. 跨域错误仍然存在

**检查项:**
- 确保Worker已正确部署
- 检查CORS头部是否正确设置
- 验证OPTIONS预检请求是否返回200状态码

### 2. 预检请求失败

**解决方案:**
- 确保OPTIONS方法被正确处理
- 检查CORS头部是否完整
- 验证`Access-Control-Max-Age`设置

### 3. 认证失败

**检查项:**
- 验证API密钥是否正确设置
- 检查请求头中的Authorization字段
- 确认DeepSeek API密钥是否有效

## 📝 代码结构

```
src/
├── index.js          # 主入口文件，包含CORS配置和请求处理
wrangler.jsonc        # Cloudflare Worker配置文件
package.json          # 项目依赖配置
README.md            # 项目说明文档
```

## 🔄 更新日志

- **v1.0.0**: 初始版本，支持基本的API代理和跨域处理
- **v1.1.0**: 完善CORS配置，添加预检请求处理
- **v1.2.0**: 增加GET接口和错误处理优化

## 📞 技术支持

如果遇到问题，请检查：
1. 浏览器开发者工具的网络面板
2. Cloudflare Worker的日志
3. 确保所有CORS头部正确设置

---

**注意**: 请确保在生产环境中使用环境变量来存储API密钥，而不是硬编码在代码中。
