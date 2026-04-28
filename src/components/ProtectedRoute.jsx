/**
 * ProtectedRoute - 路由守卫组件
 *
 * 用法：
 *   <ProtectedRoute>            — 仅登录用户可访问
 *   <ProtectedRoute adminOnly>  — 仅管理员可访问
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, isAdmin } = useAuth();

  // 未登录 → 跳到登录页
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 需要管理员但不是管理员 → 跳回主页
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
