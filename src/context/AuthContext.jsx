/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 全局认证状态管理 (context/AuthContext.jsx)
 *
 * 职责：
 *   1. 管理全局登录状态（当前用户信息、JWT Token）
 *   2. 提供 login / logout / register 方法
 *   3. 应用启动时自动从 localStorage 恢复登录状态
 *   4. 通过 React Context + useContext 在整个应用共享状态
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { createContext, useContext, useState, useCallback } from 'react';

// ─── 常量 ────────────────────────────────────────────────────────────────────

const API_BASE_URL = (() => {
  if (typeof window === 'undefined') return 'http://localhost:3001';
  const { hostname, protocol, port } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `${protocol}//${hostname}:3001`;
  }
  return `${protocol}//${hostname}${port ? ':' + port : ''}`;
})();

// localStorage 中存储 Token 的键名
const TOKEN_KEY = 'sharkfit_token';
const USER_KEY  = 'sharkfit_user';

// ─── 创建 Context ─────────────────────────────────────────────────────────────

// 创建空的 Context 对象（初始值在 Provider 中提供）
const AuthContext = createContext(null);

// ─── AuthProvider 组件 ────────────────────────────────────────────────────────

/**
 * AuthProvider - 认证状态提供者
 * 包裹在应用根组件外层，使所有子组件都能访问认证状态
 */
export const AuthProvider = ({ children }) => {

  // ── 初始化状态：从 localStorage 恢复上次的登录状态 ─────────────────────
  // 每次刷新页面都会重新初始化，所以要从 localStorage 读取持久化的 token 和 user 信息
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user,  setUser]  = useState(() => {
    const stored = localStorage.getItem(USER_KEY);
    // 安全解析：如果 localStorage 中的 JSON 格式错误，返回 null
    try {
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  // ── isLoading：用于在全局操作（如登出）时防止重复点击 ─────────────────
  const [isLoading, setIsLoading] = useState(false);

  // ─── 工具函数：发起 API 请求（自动附带 Auth 头）───────────────────────────

  const authFetch = useCallback(async (path, options = {}) => {
    const currentToken = localStorage.getItem(TOKEN_KEY);
    
    // 🆕 智能处理 Content-Type：如果 body 是 FormData，则让浏览器自动处理（以便添加 boundary）
    const isFormData = options.body instanceof FormData;
    
    const headers = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {}),
      ...options.headers,
    };
    const url = `${API_BASE_URL}${path}`;
    const response = await fetch(url, { ...options, headers });
    return response;
  }, []);

  // ─── login：保存 Token 和用户信息到状态和 localStorage ─────────────────────

  const login = useCallback((newToken, userData) => {
    // 保存到内存状态（React 响应式）
    setToken(newToken);
    setUser(userData);
    // 持久化到 localStorage（页面刷新后恢复）
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    
    // 🆕 记录最后一次登录成功的邮箱（用于登录页回显，不随退出登录清除）
    if (userData && userData.email) {
      localStorage.setItem('sharkfit_last_login_email', userData.email);
    }
  }, []);

  // ─── logout：清除所有认证状态 ───────────────────────────────────────────────

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    // 清除 localStorage
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // 同时清除 Zustand store 的缓存（避免不同用户看到上一个用户的数据）
    localStorage.removeItem('fitness-pwa-storage');
  }, []);

  // ─── 计算属性 ────────────────────────────────────────────────────────────────

  const isAuthenticated = !!token && !!user;  // 是否已登录
  const isAdmin = user?.role === 'admin';       // 是否是管理员

  // ─── Context 值：提供给所有子组件使用的状态和方法 ───────────────────────────

  const contextValue = {
    token,
    user,
    isAuthenticated,
    isAdmin,
    isLoading,
    setIsLoading,
    login,
    logout,
    authFetch,
    API_BASE_URL,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// ─── 自定义 Hook：useAuth ─────────────────────────────────────────────────────

/**
 * useAuth - 在组件中访问认证状态的快捷 Hook
 * 
 * 用法：
 *   const { user, isAdmin, logout } = useAuth();
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth 必须在 AuthProvider 内部使用');
  }
  return context;
};

export default AuthContext;
