// lib/router.ts
import { routes, Route } from './routes';

export function findRouteByPath(path: string): Route | undefined {
  // 扁平化路由数组
  const flatRoutes: Route[] = [];
  
  function flattenRoutes(routes: Route[]) {
    for (const route of routes) {
      flatRoutes.push(route);
      if (route.children) {
        flattenRoutes(route.children);
      }
    }
  }
  
  flattenRoutes(routes);
  return flatRoutes.find(route => route.path === path);
}

export function getRouteMeta(path: string) {
  const route = findRouteByPath(path);
  return route?.meta || {};
}