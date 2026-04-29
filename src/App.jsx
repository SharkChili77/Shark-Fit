/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 应用根组件 (App.jsx) [SaaS 升级版]
 *
 * 新增功能：
 *   1. AuthProvider 包裹全局认证状态
 *   2. /login 路由（无需登录）
 *   3. /admin 路由（仅管理员）
 *   4. ProtectedRoute 包裹所有主应用路由
 *   5. 导航栏右侧"用户中心"下拉菜单
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { BrowserRouter, Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Dumbbell, LibrarySquare, ShieldCheck, User, LogOut, KeyRound,
  ChevronDown, X, Link as LinkIcon, Mail, Camera, MessageSquare, Megaphone,
  Bell, Save, CheckCircle, Trash2, Loader2
} from 'lucide-react';
import { useEffect, useRef, useState, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useFitnessStore from './store/useFitnessStore';

// 认证相关
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// 核心页面（不懒加载，保证首页秒开）
import Dashboard from './views/Dashboard';
import WorkoutFlow from './views/WorkoutFlow';
import ExerciseLib from './views/ExerciseLib';
import Login from './views/Login';

// 非核心页面使用懒加载
const Settings = lazy(() => import('./views/Settings'));
const AnalyticsHub = lazy(() => import('./views/AnalyticsHub'));
const AdminPanel = lazy(() => import('./views/AdminPanel'));
const SocialLeaderboard = lazy(() => import('./views/SocialLeaderboard'));

// 其他组件
import ConfettiEffect from './components/ConfettiEffect';
import DynamicIslandTimer from './components/DynamicIslandTimer';
import ChangePasswordModal from './components/ChangePasswordModal';
import TapGlowEffect from './components/TapGlowEffect';
import ErrorBoundary from './components/ErrorBoundary';
import { compressImage } from './utils/imageUtils';

// 动态识别 API 地址：本地开发用 3001 端口，线上环境自动使用当前域名
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3001'
  : window.location.origin;

// ─── 主应用内容（需要在 AuthProvider 内部） ──────────────────────────────────

const AppContent = () => {
  const {
    pullData, isPublic, updatePublicStatus, modalOpen,
    announcement, dismissedAnnouncementId, fetchAnnouncement,
    publishAnnouncement, dismissAnnouncement, fetchAnnouncementHistory, deleteAnnouncement
  } = useFitnessStore();
  const { isAdmin, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  // ── 系统公告逻辑 ────────────────────────────────────────────────────────
  const [showAnnModal, setShowAnnModal] = useState(false);
  const [isAdminAnnOpen, setIsAdminAnnOpen] = useState(false); // 管理员发布窗口
  const [adminAnnForm, setAdminAnnForm] = useState({ title: '', content: '', active: true });
  const [annHistory, setAnnHistory] = useState([]);
  const [annLoading, setAnnLoading] = useState(false);

  useEffect(() => {
    fetchAnnouncement();
  }, [fetchAnnouncement]);

  const loadAnnHistory = async () => {
    setAnnLoading(true);
    const history = await useFitnessStore.getState().fetchAnnouncementHistory();
    if (history) setAnnHistory(history);
    setAnnLoading(false);
  };

  useEffect(() => {
    if (isAdminAnnOpen) loadAnnHistory();
  }, [isAdminAnnOpen]);

  // ── 欢迎弹窗：按用户ID持久化，每个账号只弹一次 ──────────────────────────
  // 用 localStorage 存储每个用户的已阅状态，key = 'sharkfit_welcome_{userId}'
  // 这样即使 logout 清空了 Zustand 缓存，同一用户下次登录也不会重复弹出
  const welcomeKey = user ? `sharkfit_welcome_${user.id}` : null;
  const [showWelcome, setShowWelcome] = useState(() => {
    // 初始化时读取：如果该用户已经看过欢迎弹窗，直接返回 false（不弹）
    if (!welcomeKey) return false;
    return !localStorage.getItem(welcomeKey);
  });

  // 关闭欢迎弹窗并记录该用户已看过（持久化到 localStorage）
  const dismissWelcome = () => {
    setShowWelcome(false);
    if (welcomeKey) {
      localStorage.setItem(welcomeKey, '1');
    }
    // 同时更新 Zustand（向后兼容）
    useFitnessStore.setState({ hasSeenWelcome: true });
  };

  // 自动弹窗逻辑：欢迎弹窗关闭后，如果有未读公告则弹出
  useEffect(() => {
    if (!showWelcome && announcement && announcement.active && announcement.id !== dismissedAnnouncementId) {
      setShowAnnModal(true);
    }
  }, [announcement, dismissedAnnouncementId, showWelcome]);

  // ── 隐藏设置入口：长按动作库图标 3 秒 ──────────────────────────────────
  const longPressTimer = useRef(null);
  const [secretFlash, setSecretFlash] = useState(false);

  // ── 用户下拉菜单状态 ─────────────────────────────────────────────────────
  const [menuOpen, setMenuOpen] = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [profileModal, setProfileModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactData, setContactData] = useState({ wechat: '', email: '', qr: '' });
  const [newUsername, setNewUsername] = useState('');
  const [newAvatar, setNewAvatar] = useState('');
  const [selectedFile, setSelectedFile] = useState(null); // 🆕 选中的本地文件
  const [previewUrl, setPreviewUrl] = useState('');      // 🆕 本地预览 URL
  const [isChangeLoading, setIsChangeLoading] = useState(false);
  const [changeError, setChangeError] = useState('');
  const menuRef = useRef(null);
  const fileInputRef = useRef(null); // 🆕 隐藏的文件输入框引用

  // 初始化资料表单
  useEffect(() => {
    if (user && profileModal) {
      setNewUsername(user.username || '');
      setNewAvatar(user.avatar_url || '');
      setPreviewUrl(user.avatar_url || '');
      setSelectedFile(null);
    }
  }, [user, profileModal]);

  // 处理文件选择预览
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setChangeError('图片不能超过 5MB');
        return;
      }
      // 客户端压缩：将图片压缩到 100KB 以内，最大 512px
      const compressed = await compressImage(file, { maxSizeMB: 0.1, maxWidthOrHeight: 512 });
      setSelectedFile(compressed);
      setPreviewUrl(URL.createObjectURL(compressed));
    }
  };

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handlePointerDown = (e) => {
    if (e.button === 2) return;
    longPressTimer.current = setTimeout(() => {
      setSecretFlash(true);
      setTimeout(() => setSecretFlash(false), 1500);
      navigate('/settings');
      longPressTimer.current = null;
    }, 3000);
  };

  const handlePointerUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      navigate('/lib');
    }
  };

  const handleContextMenu = (e) => e.preventDefault();

  useEffect(() => {
    pullData();
    // 🆕 获取创作者联系方式（增加时间戳防止缓存）
    const fetchContact = async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/system/contact?t=${Date.now()}`);
        if (!r.ok) return;
        const data = await r.json();
        // 确保字段存在，即使后端返回空也能正常回显
        setContactData({
          wechat: data.wechat || '',
          email: data.email || '',
          qr: data.qr || ''
        });
      } catch (err) {
        console.error('Failed to fetch contact:', err);
      }
    };
    fetchContact();
  }, [pullData]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setChangeError('');
    setIsChangeLoading(true);

    try {
      let finalAvatarUrl = newAvatar;

      // ── 步骤 1：如果有新选中的文件，先执行上传 ──────────────────────────
      if (selectedFile) {
        const formData = new FormData();
        formData.append('avatar', selectedFile);

        const uploadResp = await fetch(`${API_BASE_URL}/api/auth/upload-avatar`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('sharkfit_token')}`
          },
          body: formData,
        });

        const uploadData = await uploadResp.json();
        if (!uploadResp.ok) throw new Error(uploadData.error || '图片上传失败');
        finalAvatarUrl = uploadData.url; // 获取后端返回的 /uploads/xxx 路径
      }

      // ── 步骤 2：更新个人资料 ──────────────────────────────────────────
      const resp = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sharkfit_token')}`
        },
        body: JSON.stringify({ username: newUsername, avatar_url: finalAvatarUrl }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '更新失败');

      // 更新本地存储并提示用户刷新
      const updatedUser = { ...user, ...data.user };
      localStorage.setItem('sharkfit_user', JSON.stringify(updatedUser));
      window.location.reload();
    } catch (err) {
      setChangeError(err.message);
    } finally {
      setIsChangeLoading(false);
    }
  };

  // ── Keep-Alive 视图 ──────────────────────────────────────────────────────
  const views = [
    { path: '/', component: <Dashboard />, label: '仪表盘', padding: true },
    { path: '/workout', component: <WorkoutFlow />, label: '训练', padding: false },
    { path: '/lib', component: <ExerciseLib />, label: '动作库', padding: true },
    { path: '/analytics', component: <AnalyticsHub />, label: '数据分析', padding: true },
    { path: '/settings', component: <Settings />, label: '设置', padding: true },
    // 管理面板使用独立路由（不做 Keep-Alive，避免缓存权限问题）
  ];

  const isAdminPath = location.pathname === '/admin';

  // 🛡️ 管理员路径守卫：非管理员禁止进入 /admin
  useEffect(() => {
    if (isAdminPath && !isAdmin) {
      console.warn('非管理员尝试访问后台，已拦截并重定向');
      navigate('/', { replace: true });
    }
  }, [isAdminPath, isAdmin, navigate]);

  const renderPersistentViews = (currentPath) => {
    if (isAdminPath) {
      return (
        <div className="absolute inset-0 overflow-hidden z-10 opacity-100">
          <div className="w-full h-full p-4 overflow-y-auto">
            <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary" /></div>}>
              <AdminPanel />
            </Suspense>
          </div>
        </div>
      );
    }

    return views.map((view) => {
      const isActive = view.path === currentPath;
      return (
        <div
          key={view.path}
          className={`absolute inset-0 overflow-hidden transition-opacity duration-200 ${isActive ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none'
            }`}
        >
          <div className={`w-full h-full ${view.padding ? 'p-4 overflow-y-auto' : ''}`}>
            <Suspense fallback={<div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-primary" /></div>}>
              {view.component}
            </Suspense>
          </div>
        </div>
      );
    });
  };

  // ── 导出：判断当前激活的底部Tab ─────────────────────────────────────────
  const isTabActive = (path) => {
    if (path === '/lib') return location.pathname === '/lib' || location.pathname === '/settings';
    return location.pathname === path;
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background text-white">
      <ConfettiEffect />
      <DynamicIslandTimer />

      {/* 秘密闪烁提示 */}
      {secretFlash && (
        <div className="fixed inset-0 z-[999] pointer-events-none flex items-center justify-center">
          <div className="bg-primary/10 border border-primary/30 backdrop-blur-xl text-primary font-bold px-6 py-3 rounded-2xl text-sm shadow-[0_0_30px_rgba(16,185,129,0.4)] animate-pulse">
            🔐 进入隐藏设置
          </div>
        </div>
      )}

      {/* 顶部导航栏 */}
      <header className="h-16 border-b border-white/5 flex items-center justify-between px-4 shrink-0 glass-panel z-[100] sticky top-0 rounded-b-2xl mx-2 mt-2">
        <div className="flex flex-col">
          <motion.h1
            animate={{
              y: [0, -4, 0],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{
              willChange: "transform",
              textShadow: "0 0 10px rgba(57,255,20,0.4)"
            }}
            className="font-black text-2xl text-primary tracking-tighter"
          >
            FinFit
          </motion.h1>
          <button
            onClick={() => setShowContactModal(true)}
            className="flex items-center gap-1.5 text-[10px] font-bold text-neutral-500 hover:text-primary transition-colors group ml-0.5"
          >
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            <MessageSquare size={10} className="group-hover:scale-110 transition-transform" />
            反馈建议
          </button>
        </div>

        {/* 用户中心下拉菜单 */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-3 px-2 py-1 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all group"
          >
            {/* 头像显示 */}
            <div className="w-8 h-8 rounded-lg overflow-hidden bg-gradient-to-br from-primary/20 to-emerald-500/20 flex items-center justify-center border border-white/10 group-hover:border-primary/40 transition-all shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url.startsWith('/uploads') ? `${API_BASE_URL}${user.avatar_url}` : user.avatar_url}
                  alt="avatar"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xs text-primary font-bold">
                  {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </span>
              )}
            </div>

            <div className="flex flex-col items-start leading-tight pr-1 hidden sm:flex">
              <span className="text-xs font-bold text-neutral-200">
                {user?.username || user?.email?.split('@')[0] || '用户'}
              </span>
              <span className="text-[9px] text-neutral-500 uppercase tracking-tighter">
                {isAdmin ? '管理员' : '健身者'}
              </span>
            </div>

            <ChevronDown
              size={12}
              className={`text-neutral-500 mr-1 transition-transform duration-200 ${menuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {/* 下拉菜单内容 */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-48 bg-neutral-900/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-50"
              >
                {/* 用户信息 */}
                <div className="px-4 py-3 border-b border-white/5 bg-white/5">
                  <p className="text-[10px] text-emerald-500 font-black uppercase tracking-widest mb-1">当前身份</p>
                  <p className="text-sm font-bold text-white truncate">{user?.username || '健身达人'}</p>
                  <p className="text-[10px] text-neutral-500 truncate">{user?.email}</p>
                </div>

                {/* 菜单项 */}
                <div className="py-1.5">
                  {/* 修改资料 */}
                  <MenuButton
                    icon={<User size={14} />}
                    label="修改资料"
                    onClick={() => { setProfileModal(true); setMenuOpen(false); }}
                  />

                  {/* 修改密码 */}
                  <MenuButton
                    icon={<KeyRound size={14} />}
                    label="修改密码"
                    onClick={() => { setShowChangePwd(true); setMenuOpen(false); }}
                  />

                  {/* 管理员功能区 */}
                  {isAdmin && (
                    <div className="px-2 pt-2 mt-2 border-t border-white/5 space-y-1">
                      <div className="px-3 py-1.5 text-[10px] font-black text-neutral-600 uppercase tracking-widest">Admin Tools</div>
                      <button
                        onClick={() => { setIsAdminAnnOpen(true); setMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-primary hover:bg-primary/10 transition-all"
                      >
                        <Megaphone size={18} />
                        发布系统公告
                      </button>
                      <Link
                        to="/admin" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-neutral-400 hover:text-white hover:bg-white/5 transition-all"
                      >
                        <ShieldCheck size={18} />
                        用户管理后台
                      </Link>
                    </div>
                  )}

                  {/* 分割线 */}
                  <div className="mx-3 my-1.5 border-t border-white/5" />

                  {/* 退出登录 */}
                  <MenuButton
                    icon={<LogOut size={14} className="text-red-400" />}
                    label="退出登录"
                    labelClass="text-red-400"
                    onClick={() => {
                      logout();
                      navigate('/login', { replace: true });
                      setMenuOpen(false);
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </header>

      {/* 主视图区域 */}
      <main className="flex-1 relative">
        {renderPersistentViews(location.pathname)}
      </main>

      {/* 首次进入欢迎弹窗（每个账号只弹一次，按用户ID持久化） */}
      <AnimatePresence>
        {showWelcome && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 30 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[60px]" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/10 rounded-full blur-[60px]" />

              <div className="relative">
                <div className="w-20 h-20 bg-gradient-to-br from-primary to-emerald-600 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-primary/20 rotate-3">
                  <span className="text-4xl">🦈</span>
                </div>

                <h2 className="text-3xl font-black text-white mb-2 tracking-tight">你好！朋友</h2>
                <p className="text-neutral-400 leading-relaxed mb-4">
                  欢迎使用 <span className="text-primary font-bold">FinFit</span>。这是一个专注于纯粹训练体验的健身系统。
                </p>
                <p className="text-xs text-neutral-500 bg-white/5 p-3 rounded-xl border border-white/5 mb-8 leading-relaxed">
                  💡 <span className="text-neutral-300">提示：</span>系统内预设的计划均为<span className="text-primary">初始推荐计划</span>。在动作库中可以快捷修改切换自己的计划，任何意见可以点击“反馈建议”快捷反馈。
                </p>

                <div className="space-y-4 mb-8">
                  <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="w-10 h-10 rounded-full bg-neutral-800 flex items-center justify-center shrink-0">
                      <User className="text-primary" size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider">制作者</div>
                      <div className="text-white font-bold">Shark</div>
                    </div>
                  </div>
                </div>

                {/* 关闭时同时写入用户专属的已阅标记 */}
                <button
                  onClick={dismissWelcome}
                  className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.4)] active:scale-[0.98] transition-all text-lg"
                >
                  开启健身之旅
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 底部导航栏（弹窗打开时收起隐藏） */}
      <nav className={`h-[76px] glass-panel flex justify-around items-center shrink-0 env-pb border-t border-white/10 rounded-t-3xl pb-2 pt-1 mx-2 relative z-[50] transition-all duration-300 ${modalOpen ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`}>
        <NavItem to="/" icon={<Home />} label="主页" active={isTabActive('/')} />
        <NavItem to="/workout" icon={<Dumbbell />} label="训练" active={isTabActive('/workout')} />
        <div
          role="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onContextMenu={handleContextMenu}
          className={`flex flex-col items-center justify-center w-16 h-full space-y-1 cursor-pointer transition-all btn-scale select-none ${isTabActive('/lib')
              ? 'text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]'
              : 'text-neutral-500 hover:text-neutral-300'
            }`}
        >
          <div className="w-6 h-6"><LibrarySquare /></div>
          <span className="text-[10px] font-bold">动作库</span>
        </div>
      </nav>

      {/* ── 系统公告展示弹窗 (用户端) ────────────────────────────────── */}
      <AnimatePresence>
        {showAnnModal && announcement && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAnnModal(false)} className="absolute inset-0 bg-black/60 backdrop-blur-md" />
            <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }} className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mb-6 shadow-inner">
                  <Bell size={32} className="animate-bounce" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2 tracking-tight">{announcement.title || '系统公告'}</h3>
                <div className="w-full py-4 px-2 max-h-[30vh] overflow-y-auto text-neutral-400 text-sm leading-relaxed scrollbar-hide whitespace-pre-wrap">
                  {announcement.content}
                </div>
                <div className="w-full mt-8 space-y-3">
                  <button
                    onClick={() => setShowAnnModal(false)}
                    className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-transform"
                  >
                    我知道了
                  </button>
                  <button
                    onClick={() => { dismissAnnouncement(announcement.id); setShowAnnModal(false); }}
                    className="w-full py-3 text-neutral-500 hover:text-neutral-300 text-xs font-bold transition-colors"
                  >
                    此后不再显示此通知
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 系统公告发布弹窗 (管理员端) ────────────────────────────────── */}
      <AnimatePresence>
        {isAdminAnnOpen && (
          <div className="fixed inset-0 z-[3000] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsAdminAnnOpen(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-neutral-900 border border-white/10 rounded-[2rem] p-6 md:p-8 shadow-2xl max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-white flex items-center gap-2"><Megaphone className="text-primary" /> 发布系统公告</h3>
                <button onClick={() => setIsAdminAnnOpen(false)} className="text-neutral-500 hover:text-white"><X size={24} /></button>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">公告标题</label>
                  <input
                    type="text" value={adminAnnForm.title} onChange={e => setAdminAnnForm({ ...adminAnnForm, title: e.target.value })}
                    placeholder="例如：V2.1 版本更新说明"
                    className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-white placeholder:text-neutral-700 outline-none focus:border-primary/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest px-1">公告内容</label>
                  <textarea
                    rows={6} value={adminAnnForm.content} onChange={e => setAdminAnnForm({ ...adminAnnForm, content: e.target.value })}
                    placeholder="请输入详细的更新内容或提醒事项..."
                    className="w-full bg-black/50 border border-white/5 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-700 outline-none focus:border-primary/50 transition-all resize-none"
                  />
                </div>
                <div className="flex items-center justify-between bg-black/30 p-4 rounded-xl border border-white/5">
                  <div>
                    <div className="text-sm font-bold text-white">立即启用</div>
                    <div className="text-[10px] text-neutral-600 font-bold">关闭后用户将不会看到此公告</div>
                  </div>
                  <button
                    onClick={() => setAdminAnnForm({ ...adminAnnForm, active: !adminAnnForm.active })}
                    className={`w-12 h-6 rounded-full transition-all relative ${adminAnnForm.active ? 'bg-primary' : 'bg-neutral-800'}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${adminAnnForm.active ? 'left-7' : 'left-1'}`} />
                  </button>
                </div>
                <button
                  onClick={async () => {
                    const res = await publishAnnouncement(adminAnnForm);
                    if (res.success) {
                      setAdminAnnForm({ title: '', content: '', active: true });
                      loadAnnHistory();
                      alert('公告已成功发布！');
                    }
                  }}
                  className="w-full py-4 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 flex items-center justify-center gap-2 mb-8"
                >
                  <Save size={18} /> 保存并发布
                </button>

                {/* 历史记录部分 */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">历史发布记录</label>
                    {annLoading && <Loader2 size={12} className="animate-spin text-primary" />}
                  </div>

                  <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-2 custom-scrollbar">
                    {annHistory.length === 0 ? (
                      <div className="text-center py-8 bg-black/20 rounded-xl border border-dashed border-white/5 text-neutral-600 text-xs">
                        暂无历史记录
                      </div>
                    ) : (
                      annHistory.map((item) => (
                        <div key={item.id} className="bg-black/30 border border-white/5 rounded-xl p-3 flex items-center justify-between group">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${item.active ? 'bg-primary' : 'bg-neutral-700'}`} />
                              <div className="text-xs font-bold text-white truncate">{item.title}</div>
                            </div>
                            <div className="text-[10px] text-neutral-600 truncate">{item.content}</div>
                          </div>
                          <button
                            onClick={async (e) => {
                              // 1. 彻底移除 confirm，排除浏览器拦截
                              // 2. 增加调试断点
                              console.log('点击删除:', item.id);

                              try {
                                const resp = await fetch(`${API_BASE_URL}/api/announcements/${item.id}`, {
                                  method: 'DELETE',
                                  headers: {
                                    'Authorization': `Bearer ${localStorage.getItem('sharkfit_token')}`
                                  }
                                });

                                const data = await resp.json();
                                if (resp.ok && data.success) {
                                  loadAnnHistory();
                                  fetchAnnouncement();
                                } else {
                                  alert(`删除失败: ${resp.status}`);
                                }
                              } catch (err) {
                                alert(`系统错误: ${err.message}`);
                              }
                            }}
                            className="relative z-[100] ml-4 p-3 text-neutral-500 hover:text-red-400 hover:bg-red-500/10 active:scale-90 rounded-xl transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 🆕 联系创作者弹窗 */}
      <AnimatePresence>
        {showContactModal && (
          <div className="fixed inset-0 z-[1002] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowContactModal(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-primary/20 rounded-2xl flex items-center justify-center mb-4 border border-primary/20">
                  <MessageSquare className="text-primary" size={32} />
                </div>
                <h3 className="text-xl font-black text-white mb-1">联系创作者</h3>
                <p className="text-xs text-neutral-500 mb-6">如有 Bug 或建议，欢迎随时勾搭</p>

                {/* 二维码展示 */}
                <div className="w-48 h-48 bg-white p-2 rounded-2xl mx-auto mb-3 shadow-xl shadow-black/40 group relative">
                  {contactData.qr ? (
                    <>
                      <img src={`${API_BASE_URL}${contactData.qr}`} alt="wechat-qr" className="w-full h-full object-contain rounded-lg" />
                      {/* 图片保存遮罩 */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                        <button
                          onClick={async () => {
                            const response = await fetch(`${API_BASE_URL}${contactData.qr}`);
                            const blob = await response.blob();
                            const url = window.URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = 'wechat_qr.jpg';
                            link.click();
                          }}
                          className="bg-white text-black text-[10px] font-black px-4 py-2 rounded-full hover:bg-primary transition-all flex items-center gap-2 shadow-lg"
                        >
                          <Camera size={12} />
                          保存图片
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-300">
                      <Camera size={32} />
                    </div>
                  )}
                </div>
                <p className="text-[10px] text-neutral-600 mb-6 italic">长按或点击图片可直接保存</p>

                {/* 联系信息卡片 */}
                <div className="w-full space-y-3">
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-primary/30 transition-all">
                    <div className="flex flex-col items-start">
                      <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">微信号</span>
                      <span className="text-sm font-bold text-white tracking-wide">{contactData.wechat || '暂未填写'}</span>
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(contactData.wechat);
                        alert('微信号已复制！');
                      }}
                      className="px-3 py-1.5 bg-primary/10 text-primary text-[10px] font-black rounded-lg hover:bg-primary hover:text-black transition-all"
                    >
                      复制
                    </button>
                  </div>

                  {/* 邮箱 */}
                  <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between group hover:border-emerald-500/30 transition-all">
                    <div className="flex flex-col items-start text-left">
                      <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">反馈邮箱</span>
                      <span className="text-sm font-bold text-neutral-300">{contactData.email || '暂未填写'}</span>
                    </div>
                    {contactData.email && (
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(contactData.email);
                          alert('邮箱已复制！');
                        }}
                        className="px-3 py-1.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-black rounded-lg hover:bg-emerald-500 hover:text-black transition-all"
                      >
                        复制
                      </button>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => setShowContactModal(false)}
                  className="mt-8 text-neutral-600 hover:text-white text-xs font-bold transition-colors"
                >
                  下次再聊
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 修改密码弹窗 */}

      {showChangePwd && <ChangePasswordModal onClose={() => setShowChangePwd(false)} />}

      {/* 🆕 修改资料弹窗 */}
      <AnimatePresence>
        {profileModal && (
          <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setProfileModal(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[2rem] p-6 shadow-2xl overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-emerald-500" />

              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <User className="text-primary" size={20} />
                  编辑个人资料
                </h3>
                <button onClick={() => setProfileModal(false)} className="text-neutral-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-5">
                {/* 🆕 头像上传区域 */}
                <div className="flex flex-col items-center gap-4 mb-2">
                  <div
                    onClick={() => fileInputRef.current.click()}
                    className="relative w-24 h-24 rounded-3xl overflow-hidden bg-white/5 border-2 border-dashed border-white/10 hover:border-primary/50 transition-all cursor-pointer group"
                  >
                    {previewUrl ? (
                      <img src={previewUrl.startsWith('/uploads') ? `${API_BASE_URL}${previewUrl}` : previewUrl} alt="preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-neutral-600 group-hover:text-primary transition-colors">
                        <Camera size={24} />
                        <span className="text-[10px] mt-1 font-bold">上传照片</span>
                      </div>
                    )}
                    {/* 悬浮遮罩 */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="text-white" size={20} />
                    </div>
                  </div>
                  <input
                    type="file" ref={fileInputRef} hidden accept="image/*"
                    onChange={handleFileChange}
                  />
                  <p className="text-[10px] text-neutral-500 font-medium">支持 JPG、PNG，最大 2MB</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase ml-1 tracking-widest">用户名</label>
                  <div className="relative group">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-primary transition-colors" size={16} />
                    <input
                      type="text" required
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all placeholder:text-neutral-700"
                      placeholder="设置你的个性昵称"
                    />
                  </div>
                </div>

                {/* 🆕 隐私设置开关 */}
                <div className="bg-white/5 border border-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-primary/20 transition-all">
                  <div className="text-left">
                    <div className="text-sm font-bold text-white">公开 PR 记录</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5">允许在全站荣耀墙展示您的突破</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updatePublicStatus(!isPublic)}
                    className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${isPublic ? 'bg-primary' : 'bg-neutral-700'}`}
                  >
                    <motion.div
                      animate={{ x: isPublic ? 24 : 0 }}
                      className="w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                {changeError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-[11px] text-red-400">
                    ⚠️ {changeError}
                  </div>
                )}

                <button
                  type="submit" disabled={isChangeLoading}
                  className="w-full bg-primary hover:bg-emerald-400 disabled:bg-emerald-900 text-black font-black py-4 rounded-2xl transition-all shadow-lg shadow-primary/20 mt-2 flex items-center justify-center gap-2"
                >
                  {isChangeLoading ? '正在同步...' : '保存修改'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── 下拉菜单按钮子组件 ──────────────────────────────────────────────────────

const MenuButton = ({ icon, label, labelClass = 'text-neutral-300', onClick, active = false }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors text-left ${active ? 'bg-white/5' : ''
      }`}
  >
    <span className="text-neutral-500">{icon}</span>
    <span className={`font-medium ${labelClass}`}>{label}</span>
  </button>
);

// ─── 底部导航项 ──────────────────────────────────────────────────────────────

const NavItem = ({ to, icon, label, active }) => (
  <Link
    to={to}
    className={`flex flex-col items-center justify-center w-16 h-full space-y-1 transition-all btn-scale ${active ? 'text-primary drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-neutral-500 hover:text-neutral-300'
      }`}
  >
    <div className="w-6 h-6">{icon}</div>
    <span className="text-[10px] font-bold">{label}</span>
  </Link>
);

// ─── 根组件（包裹 AuthProvider 和路由） ─────────────────────────────────────

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <TapGlowEffect />
        <BrowserRouter>
          <Routes>
            {/* 公开路由：登录/注册页 */}
            <Route path="/login" element={<Login />} />

            {/* 受保护路由：需要登录 */}
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <AppContent />
                </ProtectedRoute>
              }
            />
            <Route
              path="/leaderboard"
              element={
                <ProtectedRoute>
                  <SocialLeaderboard />
                </ProtectedRoute>
              }
            />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
