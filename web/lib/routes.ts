// lib/routes.ts
export interface Route {
  path: string;
  name?: string;
  component?: string; // 组件路径，可选，因为重定向路由不需要
  layout?: string;   // 布局组件路径
  meta?: {
    requiresAuth?: boolean;
    title?: string;
    [key: string]: any;
  };
  children?: Route[];
  redirect?: string;
}

export const routes: Route[] = [
  {
    path: '/',
    redirect: '/sentio'
  },
  {
    path: '/login',
    name: 'Login',
    component: './app/login/page.tsx',
    meta: {
      requiresAuth: false,
      title: '登录'
    }
  },
  {
    path: '/register',
    name: 'Register',
    component: './app/register/page.tsx',
    meta: {
      requiresAuth: false,
      title: '注册'
    }
  },
  {
    path: '/sentio',
    name: 'Sentio',
    component: './app/(products)/sentio/page.tsx',
    meta: {
      requiresAuth: false,
      title: 'Sentio'
    },
    children: [
      {
        path: '/sentio/settings',
        name: 'SentioSettings',
        component: './app/(products)/sentio/settings.tsx',
        meta: {
          requiresAuth: false,
          title: 'Sentio 设置'
        }
      }
    ]
  },
  {
    path: '/register',
    name: '/Register',
    component: './app/register/page.tsx',
    meta: {
      requiresAuth: false,
      title: '注册'
    }
  },
];