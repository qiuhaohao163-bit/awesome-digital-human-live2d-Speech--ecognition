// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { findRouteByPath } from './lib/router';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const route = findRouteByPath(pathname);
  
  // 处理重定向
  if (route?.redirect) {
    return NextResponse.redirect(new URL(route.redirect, request.url));
  }
  
  // 处理认证
  const isAuthenticated = request.cookies.get('auth_token')?.value;
  
  if (route?.meta?.requiresAuth && !isAuthenticated) {
    // 未认证，重定向到登录页
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};