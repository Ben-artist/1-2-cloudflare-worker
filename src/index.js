import { createYoga } from 'graphql-yoga';
import { createSchema } from 'graphql-yoga';
import { Repeater } from 'graphql-yoga';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';

// GraphQL Schema 定义
const typeDefs = `#graphql
  type Query {
    status: String!
    models: [String!]!
  }

  type Mutation {
    chat(input: ChatInput!): ChatResponse!
  }

  input ChatInput {
    message: String!
  }

  type ChatResponse {
    message: String!
  }

  type Subscription {
    chatStream(input: ChatInput!): ChatResponse!
  }
`;

// 解析器实现
const resolvers = {
  Query: {
    status: () => "GraphQL Yoga DeepSeek Worker 运行中",
    models: () => ["deepseek-chat", "deepseek-coder", "deepseek-math"]
  },
  
  Mutation: {
    // 普通聊天（非流式）
    chat: async (_, { input }, { env }) => {
      try {
        // 验证输入
        if (!input.message?.trim()) {
          throw new Error("消息内容不能为空");
        }

        // 调用 DeepSeek API
        const apiKey = env.DEEPSEEK_API_KEY;
        const messages = [
          { role: "system", content: "你是一个有用的AI助手" },
          { role: "user", content: input.message }
        ];

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json" // 添加 Accept 头
          },
          body: JSON.stringify({
            model: "deepseek-chat",
            messages,
            temperature: 0.7,
            max_tokens: 2000,
            stream: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`DeepSeek API 错误: ${response.status} - ${errorData.error?.message || response.statusText}`);
        }

        const data = await response.json();
        return {
          message: data.choices[0]?.message?.content || "抱歉，没有收到有效回复"
        };
      } catch (error) {
        console.error("聊天处理失败:", error);
        throw new Error(`聊天失败: ${error.message}`);
      }
    }
  },

  Subscription: {
    // 流式聊天订阅（优化版本）
    chatStream: {
      subscribe: (_, { input }, { env }) => {
        return new Repeater(async (push, stop) => {
          // 创建请求控制器用于客户端断开时取消请求
          const controller = new AbortController();
          
          // 当订阅被取消时终止请求
          stop.finally(() => controller.abort());
          
          try {
            // 验证输入
            if (!input.message?.trim()) {
              push({ message: "错误：消息内容不能为空" });
              stop();
              return;
            }

            // 获取API密钥
            const apiKey = env.DEEPSEEK_API_KEY;
            const messages = [
              { role: "system", content: "你是一个有用的AI助手" },
              { role: "user", content: input.message }
            ];

            // 发起流式请求
            const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
              signal: controller.signal,
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
                "Accept": "application/json" // DeepSeek API 需要这个头
              },
              body: JSON.stringify({
                model: "deepseek-chat",
                messages,
                temperature: 0.7,
                max_tokens: 2000,
                stream: true
              })
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              push({ message: `API错误: ${response.status} - ${errorData.error?.message || response.statusText}` });
              stop();
              return;
            }

            // 处理流式响应
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let messageBuffer = "";
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                messageBuffer += chunk;
                
                // 智能分段：查找自然断点
                const segments = [];
                while (true) {
                  // 中文断点：句号、问号、感叹号、换行
                  const cjkMatch = messageBuffer.match(/[。？！\n]/);
                  // 英文断点：句号、问号、感叹号后面跟空格或换行
                  const enMatch = messageBuffer.match(/[.?!]\s|\n/);
                  
                  let breakPos = -1;
                  let breakSize = 1;
                  
                  if (cjkMatch && cjkMatch.index !== undefined) {
                    breakPos = cjkMatch.index;
                  } else if (enMatch && enMatch.index !== undefined) {
                    breakPos = enMatch.index;
                    breakSize = enMatch[0].length;
                  }
                  
                  if (breakPos === -1) break; // 无合适断点
                  
                  segments.push(messageBuffer.substring(0, breakPos + breakSize));
                  messageBuffer = messageBuffer.substring(breakPos + breakSize);
                }
                
                // 推送所有完整的段落
                segments.forEach(segment => push({ message: segment }));
              }
              
              // 推送剩余内容
              if (messageBuffer) {
                push({ message: messageBuffer });
              }
              
            } finally {
              reader.releaseLock();
            }
            
          } catch (error) {
            // 区分网络取消和其他错误
            if (error.name !== 'AbortError') {
              console.error("流式处理失败:", error);
              push({ message: `服务错误: ${error.message || "未知错误"}` });
            }
            stop();
          }
        });
      }
    }
  }
};

// 创建 GraphQL Schema
const schema = createSchema({
  typeDefs,
  resolvers
});

// 创建 GraphQL Yoga 实例 (端点设为根路径)
const yoga = createYoga({
  schema,
  cors: false,
  endpoint: "/",
  graphqlEndpoint: "/", // 根路径作为 GraphQL 端点
  plugins: [useDeferStream()]
});

// CORS 头部 (更新以包含 Accept)
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept" // 添加 Accept
};

// 主请求处理函数
export default {
  async fetch(request, env) {
    try {
      // CORS 预检请求
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
      }
      
      // 直接使用 Yoga 处理所有请求
      const response = await yoga.fetch(request, { env });
      
      // 添加 CORS 头
      const responseHeaders = new Headers(response.headers);
      Object.entries(CORS_HEADERS).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });
      
      // 如果是订阅请求，设置正确的 Content-Type
      if (request.url.includes("subscription")) {
        responseHeaders.set("Content-Type", "text/event-stream");
      }
      
      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
      
    } catch (error) {
      console.error("请求处理失败:", error);
      return new Response(JSON.stringify({
        error: "服务器错误",
        message: error.message
      }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...CORS_HEADERS }
      });
    }
  }
};