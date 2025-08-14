import { createYoga, createSchema } from 'graphql-yoga';

// GraphQL Schema 定义
const typeDefs = `#graphql
  type Query {
    status: String!
  }

  type Mutation {
    chat(message: String!): String!
  }
`;

// 解析器实现
const resolvers = {
  Query: {
    status: () => "GraphQL Yoga DeepSeek Worker 运行中",
  },

  Mutation: {
    // 普通聊天（非流式）
    chat: async (_, { message }, { env }) => {
      try {
        // 验证输入
        if (!message?.trim()) {
          throw new Error("消息内容不能为空");
        }

        // 调用 DeepSeek API
        const apiKey = env.DEEPSEEK_API_KEY;
        const messages = [
          { role: "system", content: "你是一个有用的AI助手" },
          { role: "user", content: message }
        ];

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
            "Accept": "application/json"
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
        return data.choices[0]?.message?.content || "抱歉，没有收到有效回复";
      } catch (error) {
        console.error("聊天处理失败:", error);
        throw new Error(`聊天失败: ${error.message}`);
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
  graphqlEndpoint: "/",
});

// CORS 头部
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept"
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

      return new Response(response.body, {
        status: response.status,
        headers: responseHeaders
      });
    } catch (error) {
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