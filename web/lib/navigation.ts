// lib/navigation.ts
'use client';

import { useRouter } from 'next/navigation';

export function useAppRouter() {
  const router = useRouter();
  
  return {
    push: (path: string) => router.push(path),
    replace: (path: string) => router.replace(path),
    back: () => router.back(),
    forward: () => router.forward(),
    reload: () => router.refresh(),
  };
}