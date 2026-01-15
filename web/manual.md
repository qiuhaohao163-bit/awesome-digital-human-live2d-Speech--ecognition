# 项目开发手册

## 1. 如何添加新接口

### 1.1 接口类型定义

在 `lib/api` 目录下创建或编辑相关文件，定义接口的请求和响应类型：

```typescript
// lib/api/example.ts

// 请求参数类型
export interface ExampleRequest {
  param1: string;
  param2: number;
}

// 响应数据类型
export interface ExampleResponse {
  code: number;
  message: string;
  data: {
    id: number;
    name: string;
    // 其他字段
  };
}
```

### 1.2 接口实现

使用现有的 `get` 或 `post` 等方法实现接口调用：

```typescript
// lib/api/example.ts
import { get, post } from './requests';

// 新后端基础URL
const NEW_BACKEND_BASE_URL = 'http://localhost:8120';

// GET接口示例
export async function getExampleData(params: ExampleRequest): Promise<ExampleResponse> {
  // 如果是完整URL，直接传递；否则会使用系统配置的后端地址
  return get(`${NEW_BACKEND_BASE_URL}/api/example`, { params });
}

// POST接口示例
export async function createExampleData(data: ExampleRequest): Promise<ExampleResponse> {
  return post(`${NEW_BACKEND_BASE_URL}/api/example`, data);
}
```

### 1.3 在组件中使用

在需要使用接口的组件中导入并调用：

```typescript
// app/example/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { getExampleData } from '@/lib/api/example';

const ExamplePage: React.FC = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getExampleData({
          param1: 'value1',
          param2: 123
        });
        setData(response.data);
      } catch (error) {
        console.error('获取数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // 组件渲染...
};

export default ExamplePage;
```

## 2. 路由守卫实现

### 2.1 基于Next.js中间件的路由守卫

在项目根目录创建 `middleware.ts` 文件：

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isLoggedIn } from './lib/api/auth';

// 定义需要认证的路由
const protectedRoutes = ['/sentio', '/sentio/settings'];

// 定义公开路由
const publicRoutes = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuth = isLoggedIn();

  // 处理需要认证的路由
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuth) {
      // 未认证，重定向到登录页
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // 处理公开路由
  if (publicRoutes.includes(pathname) && isAuth) {
    // 已认证用户访问登录/注册页，重定向到首页
    return NextResponse.redirect(new URL('/sentio', request.url));
  }

  return NextResponse.next();
}

// 配置中间件匹配的路由
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
```

### 2.2 基于组件的路由守卫

创建一个高阶组件来保护需要认证的页面：

```typescript
// components/AuthGuard.tsx
'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/api/auth';

interface AuthGuardProps {
  children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoggedIn()) {
      router.push('/login');
    }
  }, [router]);

  if (!isLoggedIn()) {
    return null; // 或者加载动画
  }

  return <>{children}</>;
};
```

在页面组件中使用：

```typescript
// app/sentio/page.tsx
import { AuthGuard } from '@/components/AuthGuard';

export default function SentioPage() {
  return (
    <AuthGuard>
      <div>
        {/* 页面内容 */}
      </div>
    </AuthGuard>
  );
}
```

## 3. 请求拦截器和响应拦截器

### 3.1 修改请求工具

编辑 `lib/api/requests.ts` 文件，添加拦截器逻辑：

```typescript
// lib/api/requests.ts

// ... 现有代码 ...

// 请求拦截器
export function requestInterceptor(config: RequestInit): RequestInit {
  // 添加认证token
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  // 添加其他请求头
  config.headers = {
    ...config.headers,
    'X-Request-Time': new Date().toISOString(),
  };

  return config;
}

// 响应拦截器
export async function responseInterceptor(response: Response): Promise<Response> {
  // 处理401未授权
  if (response.status === 401) {
    // 清除本地存储
    localStorage.removeItem('userInfo');
    localStorage.removeItem('auth_token');
    // 跳转到登录页
    window.location.href = '/login';
  }

  // 处理其他状态码
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败: ${response.status}`);
  }

  return response;
}

// 修改现有的fetch调用，添加拦截器
async function fetchWithInterceptors(url: string, config: RequestInit): Promise<Response> {
  // 应用请求拦截器
  const interceptedConfig = requestInterceptor(config);
  
  // 发送请求
  const response = await fetch(url, interceptedConfig);
  
  // 应用响应拦截器
  return responseInterceptor(response);
}

// 更新现有的get、post等方法，使用带拦截器的fetch
export async function get(
  path: string,
  signal?: AbortSignal,
  headers: { [key: string]: string } = {"Content-Type": "application/json"}
): Promise<any> {
  const url = getUrl(path);
  headers["Request-Id"] = uuidv4();
  headers["User-Id"] = "";

  return fetchWithInterceptors(url, {
    method: "GET",
    headers: headers,
    signal: signal,
  })
    .then((response) => {
      return responseParse(response);
    })
    .catch((error) => {
      errorHandler(error, signal);
      return Promise.reject(error.message);
    });
}

// 同样更新post、put、del等方法
```

### 3.2 完整的请求工具示例

```typescript
// lib/api/requests.ts
import "whatwg-fetch";
import { v4 as uuidv4 } from 'uuid';
import { addToast } from "@heroui/react";

const SERVER_PROTOCOL = process.env.NEXT_PUBLIC_SERVER_PROTOCOL;
const SERVER_PORT = process.env.NEXT_PUBLIC_SERVER_PORT;

export function getHost(): string {
  const SERVER_IP = process.env.NEXT_PUBLIC_SERVER_IP || globalThis.location?.hostname;
  let host = SERVER_PROTOCOL + "://" + SERVER_IP;
  if (SERVER_PORT != "80" && SERVER_PORT != "443") {
      host = host + ":" + SERVER_PORT;
  }
  return host;
}

function getUrl(path: string): string {
  if (path.includes("http")) return path;
  return getHost() + path;
}

export function getWsUrl(path: string): string {
  if (path.includes("ws")) return path;
  return getHost().replace("https", "wss").replace("http", "ws") + path;
}

// 请求拦截器
export function requestInterceptor(config: RequestInit): RequestInit {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${token}`,
    };
  }

  config.headers = {
    ...config.headers,
    'X-Request-Time': new Date().toISOString(),
  };

  return config;
}

// 响应拦截器
export async function responseInterceptor(response: Response): Promise<Response> {
  if (response.status === 401) {
    localStorage.removeItem('userInfo');
    localStorage.removeItem('auth_token');
    window.location.href = '/login';
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `请求失败: ${response.status}`);
  }

  return response;
}

// 带拦截器的fetch包装函数
async function fetchWithInterceptors(url: string, config: RequestInit): Promise<Response> {
  const interceptedConfig = requestInterceptor(config);
  const response = await fetch(url, interceptedConfig);
  return responseInterceptor(response);
}

export function errorHandler(error: Error, signal: AbortSignal | null = null ) {
  if (signal && signal.aborted  ) {
    return;
  }
  addToast({
    title: error.message,
    variant: "flat",
    color: "danger",
  });
}

export async function responseParse(response: Response): Promise<any> {
  return response.json().then((data) => {
    if (data.code && data.code != 0) {
      throw new Error(data.message);
    } else {
      return data;
    }
  });
}

export async function get(
  path: string,
  signal?: AbortSignal,
  headers: { [key: string]: string } = {"Content-Type": "application/json"}
): Promise<any> {
  const url = getUrl(path);
  headers["Request-Id"] = uuidv4();
  headers["User-Id"] = "";

  return fetchWithInterceptors(url, {
    method: "GET",
    headers: headers,
    signal: signal,
  })
    .then((response) => {
      return responseParse(response);
    })
    .catch((error) => {
      errorHandler(error, signal);
      return Promise.reject(error.message);
    });
}

export async function post(
  path: string,
  data?: string | Record<string, any>,
  signal?: AbortSignal,
  headers: { [key: string]: string } = {"Content-Type": "application/json"}
): Promise<any> {
  const body =  typeof data === "string" ? data : JSON.stringify(data);
  const url = getUrl(path);
  headers["Request-Id"] = uuidv4();
  headers["User-Id"] = "";
  return fetchWithInterceptors(url, {
    method: "POST",
    body,
    headers: headers,
    signal: signal,
  })
    .then((response) => {
      return responseParse(response);
    })
    .catch((error) => {
      errorHandler(error, signal);
      return Promise.reject(error.message);
    });
}

// 其他方法类似更新...
```

## 4. 项目结构说明

### 4.1 核心目录

```
web/
├── app/                # 应用页面
│   ├── login/          # 登录页面
│   ├── register/       # 注册页面
│   ├── sentio/         # 主功能页面
│   └── layout.tsx      # 根布局
├── components/         # 通用组件
├── lib/                # 工具库
│   ├── api/            # API相关
│   │   ├── auth.ts     # 认证相关API
│   │   ├── example.ts  # 示例API
│   │   └── requests.ts # 请求工具
│   └── router.ts       # 路由工具
├── styles/             # 样式文件
├── middleware.ts       # 中间件（路由守卫）
└── manual.md           # 开发手册
```

### 4.2 环境变量

在 `.env` 文件中配置环境变量：

```env
# 现有系统后端配置
NEXT_PUBLIC_SERVER_PROTOCOL=http
NEXT_PUBLIC_SERVER_IP=localhost
NEXT_PUBLIC_SERVER_PORT=8080

# 新后端配置（可选，可在代码中直接使用）
NEXT_PUBLIC_NEW_BACKEND_URL=http://localhost:8120
```

## 5. 最佳实践

### 5.1 代码规范

- 使用 TypeScript 类型定义
- 每个 API 模块独立管理
- 清晰的命名规范
- 添加适当的注释

### 5.2 错误处理

- 使用 `try-catch` 捕获异步错误
- 统一的错误处理机制
- 友好的用户提示

### 5.3 性能优化

- 合理使用缓存
- 避免不必要的请求
- 使用 `signal` 参数支持请求取消

### 5.4 安全性

- 不要在客户端存储敏感信息
- 使用 HTTPS 传输
- 合理处理认证信息

## 6. 常见问题

### 6.1 接口调用失败

- 检查网络连接
- 确认后端服务是否运行
- 检查接口URL是否正确
- 查看浏览器控制台的错误信息

### 6.2 路由守卫不生效

- 检查 `middleware.ts` 是否配置正确
- 确认路由规则是否匹配
- 清除浏览器缓存

### 6.3 拦截器不工作

- 确认拦截器代码是否正确
- 检查是否在所有请求方法中应用了拦截器
- 查看浏览器网络请求的请求头和响应

## 7. 扩展建议

### 7.1 添加API文档

使用 Swagger 或 Postman 文档管理API

### 7.2 添加Mock数据

在开发阶段使用Mock数据，提高开发效率

### 7.3 添加状态管理

使用 Zustand 或 Redux 管理全局状态

### 7.4 添加测试

为API和组件添加单元测试和集成测试

## 8. 总结

本手册介绍了如何在现有项目中添加新接口、实现路由守卫、添加请求和响应拦截器。遵循这些规范可以保持代码的可维护性和扩展性，同时确保项目的安全性和性能。

随着项目的发展，可以根据需要扩展更多功能，如国际化、主题切换、性能监控等。