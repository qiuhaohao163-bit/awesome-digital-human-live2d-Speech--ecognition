import clsx from 'clsx';
import {Inter} from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import {Providers} from "./providers";
import { getSrcPath } from '@/lib/path';
import type { Metadata } from 'next';
import "@/styles/globals.css";
import { getRouteMeta } from '@/lib/router';
// export const dynamic = 'error'
const inter = Inter({subsets: ['latin']});

// 动态生成标题
// 注意：在App Router中，generateMetadata函数会自动接收params和searchParams
// 但对于根布局，params可能不包含path信息，需要根据实际情况调整
export function generateMetadata({ params }: any) {
  // 获取当前路径
  let pathname = '/';
  
  // 处理路由组和动态路由
  if (params?.['(products)']?.sentio) {
    pathname = '/sentio';
  } else if (params?.['(products)']?.sentio === 'settings') {
    pathname = '/sentio/settings';
  } else if (params?.login) {
    pathname = '/login';
  }
  
  const routeMeta = getRouteMeta(pathname);
  
  return {
    title: routeMeta.title || '颐养智伴',
    icons: 'favicon.icon',
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className='dark'>
      <head>
        <script src={getSrcPath('sentio/core/live2dcubismcore.min.js')} />
      </head>
      <body className={clsx(inter.className)}>
        <NextIntlClientProvider messages={messages}>
          <Providers>
            <main>
              {children}
            </main>
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}