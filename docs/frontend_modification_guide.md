# 前端页面修改指南

## 项目概述

本项目是一个基于 **Next.js + HeroUI + Tailwind CSS** 的数字人交互前端应用。

### 技术栈
- **框架**: Next.js (React 框架)
- **UI 库**: HeroUI (基于 Next UI)
- **样式**: Tailwind CSS
- **状态管理**: Zustand
- **国际化**: next-intl
- **数字人渲染**: Live2D

### 目录结构说明
```
web/
├── app/                          # Next.js 应用路由
│   ├── (products)/sentio/       # Sentio 产品主页面
│   │   ├── components/          # 组件目录
│   │   │   ├── chatbot/         # 聊天机器人组件
│   │   │   ├── selector/        # 选择器组件
│   │   │   ├── settings/        # 设置组件
│   │   │   ├── header.tsx       # 头部组件
│   │   │   └── live2d.tsx       # Live2D 数字人渲染组件
│   │   ├── hooks/               # 自定义 Hooks
│   │   ├── app.tsx              # 主应用组件
│   │   ├── gallery.tsx          # 画廊组件(人物/背景选择)
│   │   ├── items.tsx            # 菜单项组件
│   │   ├── settings.tsx         # 设置面板
│   │   └── page.tsx             # 页面入口
│   ├── layout.tsx               # 根布局
│   ├── page.tsx                 # 首页(自动跳转到 /sentio)
│   └── providers.tsx            # 全局 Provider
├── components/                   # 全局组件
├── lib/                         # 工具库
│   ├── api/                     # API 请求
│   ├── live2d/                  # Live2D 核心库
│   ├── store/                   # Zustand 状态管理
│   ├── constants.ts             # 常量配置
│   └── protocol.ts              # 协议定义
├── i18n/                        # 国际化配置
│   └── locales/                 # 语言文件
│       ├── zh.json              # 中文
│       └── en.json              # 英文
└── public/                      # 静态资源
    └── sentio/characters/free/  # 免费人物模型目录
```[constants.ts](../web/lib/constants.ts)

---

## 一、删除内置人物模型

### 1.1 删除人物模型文件

内置免费人物模型存放在 `web/public/sentio/characters/free/` 目录下。

**当前内置人物列表**：
- HaruGreeter (默认人物)
- Haru
- Kei
- Chitose
- Epsilon
- Hibiki
- Hiyori
- Izumi
- Mao
- Rice
- Shizuku

**删除步骤**：
1. 进入目录：`web/public/sentio/characters/free/`
2. 删除不需要的人物文件夹（如删除 `Mao`、`Rice` 等）
3. **注意**：请保留至少一个人物模型，建议保留 `HaruGreeter` 作为默认人物

### 1.2 修改人物列表配置

修改文件：`web/lib/constants.ts`

**位置**：第 32 行

```typescript
// 修改前
export const SENTIO_CHARACTER_FREE_MODELS: string[] = [
    "HaruGreeter", "Haru", "Kei", "Chitose", "Epsilon", 
    "Hibiki", "Hiyori", "Izumi", "Mao", "Rice", "Shizuku"
]

// 修改后（示例：只保留 3 个人物）
export const SENTIO_CHARACTER_FREE_MODELS: string[] = [
    "HaruGreeter", "Haru", "Kei"
]
```

### 1.3 修改默认人物（可选）

如果删除了默认人物 `HaruGreeter`，需要修改默认配置：

```typescript
// 在 web/lib/constants.ts 第 33 行
export const SENTIO_CHARACTER_DEFAULT = "HaruGreeter"  // 改为你保留的人物名称
```

---

## 二、添加登录注册页面

### 2.1 创建认证相关页面

#### 方案 A：完全独立的登录注册页面

**步骤 1**：创建登录页面
```
web/app/login/page.tsx
```

**步骤 2**：创建注册页面
```
web/app/register/page.tsx
```

**步骤 3**：修改首页跳转逻辑

修改 `web/app/page.tsx`：
```typescript
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Page() {
  const router = useRouter();
  
  useEffect(() => {
    // 检查用户登录状态
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    
    if (isLoggedIn === 'true') {
      router.push('/sentio');    // 已登录，跳转到应用
    } else {
      router.push('/login');     // 未登录，跳转到登录页
    }
  }, [])

  return null;
}
```

#### 方案 B：在现有页面添加登录弹窗

在 `web/app/(products)/sentio/app.tsx` 中添加登录检查逻辑，显示登录弹窗。

### 2.2 创建用户状态管理

创建文件：`web/lib/store/auth.ts`

```typescript
import { create } from "zustand";
import { persist } from 'zustand/middleware'

interface AuthState {
    isLoggedIn: boolean,
    user: any | null,
    setLogin: (user: any) => void,
    setLogout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            isLoggedIn: false,
            user: null,
            setLogin: (user: any) => set({ isLoggedIn: true, user }),
            setLogout: () => set({ isLoggedIn: false, user: null }),
        }),
        {
            name: 'auth-storage'
        }
    )
)
```

### 2.3 添加国际化文案

国际化文案已经在 `web/i18n/locales/zh.json` 中预留了登录相关字段（第 39-73 行），包括：
- 登录/注册/登出
- 用户名/密码/手机号
- 验证码/忘记密码
- 错误提示等

可以直接使用这些字段。

---

## 三、隐藏不想要的功能

### 3.1 隐藏"用户指南"和"项目源码"按钮

修改文件：`web/app/(products)/sentio/items.tsx`

**位置**：第 50-80 行的下拉菜单项

#### 方法 1：注释掉相关代码

```typescript
<DropdownMenu
    aria-label="Items Actions" 
    variant="flat"
>   
    <DropdownItem 
        key="setting"
        startContent={<Cog8ToothIcon className="size-6"/>}
        onPress={() => setIsSettingsOpen(true)}
    >
        {t('setting')}
    </DropdownItem>

    <DropdownItem 
        key="gallery"
        startContent={<PhotoIcon className="size-6"/>}
        onPress={() => setIsGalleryOpen(true)}
    >
        {t('gallery')}
    </DropdownItem>

    {/* 注释掉用户指南 */}
    {/* <DropdownItem 
        key="guide"
        startContent={<AcademicCapIcon className="size-6"/>}
        onPress={() => window.open(SENTIO_GUIDE_URL, '_blank')}
    >
        {t('guide')}
    </DropdownItem> */}

    {/* 注释掉项目源码 */}
    {/* <DropdownItem 
        key="open"
        startContent={<GithubIcon className="size-6"/>}
        onPress={() => window.open(SENTIO_GITHUB_URL, '_blank')}
    >
        {t('open')}
    </DropdownItem> */}
</DropdownMenu>
```

#### 方法 2：完全删除相关代码块

直接删除第 66-80 行的代码。

### 3.2 隐藏其他功能项

根据需要，可以隐藏以下功能：

**隐藏设置按钮**：注释或删除 `setting` 相关的 `DropdownItem`

**隐藏画廊按钮**：注释或删除 `gallery` 相关的 `DropdownItem`

**隐藏聊天模式切换开关**：修改 `web/app/(products)/sentio/components/header.tsx`，注释第 41 行：
```typescript
export function Header() {
    return (
        <div className="flex w-full h-[64px] p-6 justify-between z-10">
            <LogoBar isExternal={true}/>
            <div className="flex flex-row gap-4 items-center">
                {/* <ChatModeSwitch /> */}  {/* 隐藏聊天模式切换 */}
                <Items />
            </div>
        </div>
    )
}
```

### 3.3 隐藏 Logo 或修改 Logo

修改文件：`web/components/header/logo.tsx`

可以：
- 修改 Logo 图片
- 修改跳转链接
- 完全隐藏 Logo

---

## 四、其他常见修改

### 4.1 修改默认背景

在 `web/lib/constants.ts` 中：
- `SENTIO_BACKGROUND_STATIC_IMAGES`：静态背景列表（第 26 行）
- `SENTIO_BACKGROUND_DYNAMIC_IMAGES`：动态背景列表（第 27 行）

可以删除不需要的背景，或添加自定义背景到 `public/sentio/backgrounds/` 目录。

### 4.2 修改应用标题

修改文件：`web/app/layout.tsx`（第 13 行）

```typescript
export const metadata: Metadata = {
  title: '沐光而行',  // 修改为你的标题
  icons: 'favicon.icon',
};
```

或在 `web/i18n/locales/zh.json` 中修改（第 3 行）。

### 4.3 修改默认聊天模式

修改 `web/lib/constants.ts` 第 44 行：

```typescript
// 默认对话模式
export const SENTIO_CHATMODE_DEFULT = PROTOCOL.CHAT_MODE.DIALOGUE

// 修改为默认沉浸模式
export const SENTIO_CHATMODE_DEFULT = PROTOCOL.CHAT_MODE.IMMSERSIVE
```

### 4.4 移除商务合作链接

在 `web/app/(products)/sentio/gallery.tsx` 第 260 行，注释或删除：

```typescript
{/* <Link className='hover:underline text-sm w-fit ml-2' 
      href={BUSINESS_COOPERATION_URL} color='warning' isExternal>
    👉 定制人物模型
</Link> */}
```

### 4.5 自定义界面颜色主题

修改 `web/tailwind.config.ts`，自定义主题色、背景色等。

---

## 五、开发与部署

### 5.1 本地开发

```bash
cd web
pnpm install          # 安装依赖
pnpm run dev          # 启动开发服务器（默认端口 3000）
```

访问：`http://localhost:3000`

### 5.2 生产构建

```bash
pnpm run build        # 构建生产版本
pnpm run start        # 启动生产服务器
```

### 5.3 Docker 部署

在项目根目录：

```bash
# 使用快速启动配置
docker-compose -f docker-compose-quickStart.yaml up -d

# 或使用完整配置
docker-compose up -d
```

前端访问地址：`http://localhost:3000` 或配置的端口。

---

## 六、注意事项

### 6.1 状态持久化

项目使用 Zustand 的 `persist` 中间件，将用户设置保存在浏览器 localStorage 中。

清除缓存：打开浏览器开发者工具 -> Application -> Local Storage -> 清除相关存储。

### 6.2 Live2D 模型格式

人物模型必须符合 Live2D Cubism 3.0+ 格式，包含以下文件：
- `.model3.json`：模型配置文件
- `.moc3`：模型数据文件（由 `.cdi3.json` 编译生成）
- 纹理图片（`.png`）
- 动作文件（`.motion3.json`）
- 表情文件（`.exp3.json`）
- 物理文件（`.physics3.json`，可选）

### 6.3 跨域问题

如果前端和后端分离部署，需要配置 CORS。

后端配置在：`digitalHuman/bin/app.py`

前端 API 地址配置在：`web/.env`（需要创建此文件）

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 6.4 国际化

切换语言需要修改用户浏览器语言设置，或在代码中手动控制。

---

## 七、常见问题

### Q1: 修改后页面没有变化？
**A**: 清除浏览器缓存和 localStorage，重新启动开发服务器。

### Q2: 删除人物后报错？
**A**: 确保 `constants.ts` 中的人物列表与实际文件夹名称一致，且至少保留一个人物。

### Q3: 如何添加自定义人物？
**A**: 
1. 将人物模型文件夹放入 `public/sentio/characters/free/`
2. 在 `constants.ts` 中添加人物名称到 `SENTIO_CHARACTER_FREE_MODELS` 数组
3. 确保人物文件夹名称与模型配置文件名一致

### Q4: 如何完全禁用某个功能模块？
**A**: 
- ASR（语音识别）：修改 `useSentioAsrStore` 默认 `enable: false`
- TTS（语音合成）：修改 `useSentioTtsStore` 默认 `enable: false`
- 相关代码在 `web/lib/store/sentio.ts`

### Q5: 如何修改 API 请求地址？
**A**: 修改 `web/lib/api/server.ts` 中的 API 基础地址配置。

---

## 八、推荐修改流程

为了确保修改成功且不破坏项目，建议按以下顺序进行：

1. **备份原始代码**：使用 Git 或手动备份
2. **先修改配置文件**：`constants.ts`、`i18n` 等
3. **再修改组件**：隐藏按钮、修改布局等
4. **测试功能**：每修改一处就测试一次
5. **清除缓存**：修改后记得清除浏览器缓存
6. **提交代码**：确认无误后提交

---

## 九、技术支持

- **项目文档**: `docs/` 目录下的其他文档
- **开发说明**: `docs/developer_instrction.md`
- **部署说明**: `docs/deploy_instrction.md`
- **常见问题**: `docs/Q&A.md`
- **项目仓库**: https://github.com/wan-h/awesome-digital-human-live2d

---

## 十、附录：关键文件速查

| 修改需求 | 文件路径 | 行号/位置 |
|---------|---------|----------|
| 删除人物模型 | `web/lib/constants.ts` | 第 32 行 |
| 隐藏菜单按钮 | `web/app/(products)/sentio/items.tsx` | 第 50-80 行 |
| 修改首页跳转 | `web/app/page.tsx` | 第 11 行 |
| 添加登录状态 | `web/lib/store/` (新建 `auth.ts`) | - |
| 修改标题 | `web/app/layout.tsx` | 第 13 行 |
| 修改背景列表 | `web/lib/constants.ts` | 第 26-27 行 |
| 修改国际化文案 | `web/i18n/locales/zh.json` | - |
| 修改 Logo | `web/components/header/logo.tsx` | - |
| 删除商务链接 | `web/app/(products)/sentio/gallery.tsx` | 第 260 行 |

---

**最后更新时间**: 2026-01-12
**文档版本**: v1.0
