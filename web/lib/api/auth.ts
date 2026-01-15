// lib/api/auth.ts
import { post } from './requests';

// 新后端的基础URL
const NEW_BACKEND_BASE_URL = 'http://localhost:8120';
const NEW_BASE_URL = 'http://192.168.0.138:8080';

/**
 * 登录请求参数
 */
export interface UserLoginRequest {
  phone: string;
  password: string;
}

/**
 * 登录响应数据
 */
export interface UserLoginResponse {
  code: number;
  message: string;
  data: {
    id: number;
    phone: string;
    password: string;
    // 其他用户信息字段
  };
}

/**
 * 用户登录
 * @param data 登录请求数据
 * @returns 登录响应
 */
export async function login(data: UserLoginRequest): Promise<UserLoginResponse> {
  // 使用完整URL调用新后端的登录接口，避免与现有系统冲突
  return post(`${NEW_BASE_URL}/api/robot-users/login`, data);
}

/**
 * 注册请求参数
 */
export interface UserRegisterRequest {
  phone: string;
  password: string;
  email?: string;
}

/**
 * 注册响应数据
 */
export interface UserRegisterResponse {
  code: number;
  message: string;
  data?: any;
}

/**
 * 用户注册
 * @param data 注册请求数据
 * @returns 注册响应
 */
export async function register(data: UserRegisterRequest): Promise<UserRegisterResponse> {
  // 使用完整URL调用新后端的注册接口
  return post(`${NEW_BASE_URL}/api/robot-users/register`, data);
}

/**
 * 保存登录用户信息到本地存储
 * @param userInfo 用户信息
 */
export function saveUserInfo(userInfo: any): void {
  localStorage.setItem('userInfo', JSON.stringify(userInfo));
}

/**
 * 从本地存储获取登录用户信息
 * @returns 用户信息
 */
export function getUserInfo(): any {
  const userInfo = localStorage.getItem('userInfo');
  return userInfo ? JSON.parse(userInfo) : null;
}

/**
 * 清除本地存储中的用户信息
 */
export function clearUserInfo(): void {
  localStorage.removeItem('userInfo');
}

/**
 * 检查用户是否已登录
 * @returns 是否已登录
 */
export function isLoggedIn(): boolean {
  return !!getUserInfo();
}