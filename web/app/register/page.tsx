'use client';

import React, { useState } from 'react';
import { UserIcon, LockClosedIcon, EyeIcon, EyeSlashIcon, EnvelopeIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
// 导入背景图片
import bgImage from '@/app/img/bg.png';
// 导入注册API
import { register } from '@/lib/api/auth';

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    phone: '',
    email: '',
    password: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 调用新后端的注册接口
      const response = await register(formData);
      console.log('注册成功:', response);
      
      // 注册成功后跳转到登录页
      alert('注册成功，请登录');
      router.push('/login');
    } catch (error: any) {
      console.error('注册失败:', error);
      alert(`注册失败: ${error.message || '请重试'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ 
      backgroundImage: `url(${bgImage.src})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="w-full max-w-md p-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">AI-I 智能系统</h1>
          <p className="text-gray-200 text-opacity-80">快速开发属于自己的前端项目</p>
        </div>

        <div className="mb-8 text-center">
          <h2 className="text-xl font-semibold text-blue-400 relative inline-block">
            账户密码注册
            <span className="absolute bottom-0 left-0 w-full h-1 bg-blue-400 transform scale-x-0 origin-left transition-transform duration-500 ease-out animate-border-slide"></span>
          </h2>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-5">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <UserIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="text"
                name="phone"
                id="phone"
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-3"
                placeholder="请输入账号"
                value={formData.phone}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="mb-5">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <EnvelopeIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type="email"
                name="email"
                id="email"
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-3"
                placeholder="请输入邮箱"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                <LockClosedIcon className="w-5 h-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                id="password"
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 pr-10 p-3"
                placeholder="请输入密码"
                value={formData.password}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5 text-gray-400" />
                ) : (
                  <EyeIcon className="w-5 h-5 text-gray-400" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className={`w-full text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-3 text-center transition-all duration-200 ${loading ? 'opacity-75 cursor-not-allowed' : ''}`}
            disabled={loading}
          >
            {loading ? '注册中...' : '立即注册'}
          </button>

          <div className="text-center mt-4">
            <Link
              href="/login"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              已有账号？立即登录
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}