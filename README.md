# GraphQL Yoga DeepSeek AI 聊天服务

基于 GraphQL Yoga 和 DeepSeek AI 的智能聊天服务，部署在 Cloudflare Workers 上。支持普通聊天和流式聊天两种模式，提供完整的 GraphQL API 接口。

## 🚀 项目特性

- **GraphQL API**: 使用 GraphQL Yoga 框架，提供类型安全的 API 接口
- **AI 聊天**: 集成 DeepSeek AI 模型，支持智能对话
- **流式响应**: 支持实时流式聊天，提供更好的用户体验
- **Cloudflare Workers**: 部署在边缘计算平台，全球快速响应
- **CORS 支持**: 跨域请求支持，方便前端集成
- **智能分段**: 中文和英文智能断句，提供自然的流式体验

## 📋 系统要求

- Node.js 18+ 
- pnpm 包管理器
- Cloudflare 账户和 API Token
- DeepSeek API Key

## 🛠️ 安装和部署

### 1. 克隆项目
```bash
git clone <项目地址>
cd 1-2-cloudflare-worker
```

### 2. 安装依赖
```bash
pnpm install
```

### 3. 配置环境变量
在 Cloudflare Workers 中设置以下环境变量：
- `DEEPSEEK_API_KEY`: 你的 DeepSeek API 密钥

### 4. 本地开发
```bash
pnpm dev
```
服务将在 `http://localhost:8787` 启动

### 5. 部署到生产环境
```bash
pnpm deploy
```

## 📚 API 文档

### GraphQL Schema

```graphql
type Query {
  status: String!                    # 服务状态查询
  models: [String!]!                # 可用模型列表
}

type Mutation {
  chat(input: ChatInput!): ChatResponse!  # 普通聊天
}

input ChatInput {
  message: String!                   # 用户消息
}

type ChatResponse {
  message: String!                   # AI 回复
}

type Subscription {
  chatStream(input: ChatInput!): ChatResponse!  # 流式聊天
}
```

### 端点信息
- **GraphQL 端点**: `/` (根路径)
- **支持方法**: GET, POST, OPTIONS
- **CORS**: 已启用，支持跨域请求

## 🔧 使用方法

### 1. 普通聊天 (Mutation)

```javascript
// 发送聊天消息
const query = `
  mutation Chat($input: ChatInput!) {
    chat(input: $input) {
      message
    }
  }
`;

const variables = {
  input: {
    message: "你好，请介绍一下你自己"
  }
};

const response = await fetch('https://your-worker.your-subdomain.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query,
    variables
  })
});

const result = await response.json();
console.log(result.data.chat.message);
```

### 2. 流式聊天 (Subscription)

```javascript
// 使用 GraphQL 客户端订阅流式聊天
import { createClient } from 'graphql-ws';

const client = createClient({
  url: 'wss://your-worker.your-subdomain.workers.dev/',
});

const subscription = client.subscribe(
  {
    query: `
      subscription ChatStream($input: ChatInput!) {
        chatStream(input: $input) {
          message
        }
      }
    `,
    variables: {
      input: {
        message: "请写一首关于春天的诗"
      }
    }
  },
  {
    next: (data) => {
      console.log('收到流式回复:', data.data.chatStream.message);
    },
    error: (error) => {
      console.error('订阅错误:', error);
    },
    complete: () => {
      console.log('流式聊天完成');
    }
  }
);
```

### 3. 查询服务状态

```javascript
// 检查服务状态
const query = `
  query {
    status
  }
`;

const response = await fetch('https://your-worker.your-subdomain.workers.dev/', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query })
});

const result = await response.json();
console.log('服务状态:', result.data.status);
```

## 🌐 前端集成

项目包含一个完整的前端测试界面 (`public/index.html`)，你可以：

1. 直接在浏览器中打开测试聊天功能
2. 作为参考实现自己的前端界面
3. 集成到现有的 Web 应用中

### 前端特性
- 响应式设计，支持移动端
- 实时聊天界面
- 可调节的 AI 参数（温度、最大 Token 等）
- 支持多种 DeepSeek 模型
- 错误处理和状态显示

## ⚙️ 配置选项

### DeepSeek API 参数
- **模型**: `deepseek-chat` (默认)
- **温度**: 0.7 (可调节，范围 0-1)
- **最大 Token**: 2000 (可调节，范围 1-4000)
- **系统提示**: "你是一个有用的AI助手"

### Cloudflare Workers 配置
- **兼容性日期**: 2024-08-01
- **主文件**: `src/index.js`
- **CORS**: 已启用，支持所有来源

## 🔍 错误处理

服务包含完善的错误处理机制：

- **输入验证**: 检查消息内容是否为空
- **API 错误**: 处理 DeepSeek API 返回的错误
- **网络错误**: 处理网络请求失败
- **流式错误**: 区分网络取消和其他错误类型

### 常见错误码
- `400`: 输入参数错误
- `500`: 服务器内部错误
- `401`: API 密钥无效
- `429`: 请求频率超限

## 📊 性能优化

- **智能分段**: 根据中英文标点符号智能断句
- **流式处理**: 实时推送 AI 回复，减少等待时间
- **错误恢复**: 网络中断时自动重连
- **资源管理**: 自动释放流式读取器资源

## 🧪 测试

### 本地测试
```bash
# 启动开发服务器
pnpm dev

# 在浏览器中打开 http://localhost:8787
# 使用前端界面测试聊天功能
```

### API 测试
```bash
# 使用 curl 测试 GraphQL 接口
curl -X POST http://localhost:8787/ \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { chat(input: {message: \"你好\"}) { message } }"
  }'
```

## 🚨 注意事项

1. **API 密钥安全**: 不要在客户端代码中暴露 DeepSeek API 密钥
2. **请求限制**: 注意 DeepSeek API 的请求频率限制
3. **流式连接**: 流式聊天需要保持 WebSocket 连接
4. **错误处理**: 客户端应妥善处理各种错误情况
5. **CORS 配置**: 生产环境可能需要限制 CORS 来源

## 🔄 更新日志

### v1.0.0
- 初始版本发布
- 支持普通聊天和流式聊天
- 集成 DeepSeek AI 模型
- 部署在 Cloudflare Workers

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来改进这个项目！

## 📄 许可证

ISC License

## 📞 支持

如果你遇到问题或有建议，请：
1. 查看项目的 Issues 页面
2. 创建新的 Issue 描述你的问题
3. 联系项目维护者

---

**享受与 AI 的智能对话体验！** 🤖✨
