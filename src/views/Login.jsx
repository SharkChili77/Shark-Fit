/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 登录/注册页面 (views/Login.jsx)
 *
 * 功能：
 *   - 标签切换：登录 / 注册
 *   - 注册流程：输入邮箱 → 发送验证码 → 输入验证码+密码 → 提交
 *   - 登录流程：邮箱 + 密码 → 提交
 *   - 极客暗黑风格 UI + framer-motion 动画
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, Eye, EyeOff, Send, ShieldCheck, Loader2, AlertCircle, CheckCircle2, User } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, API_BASE_URL } = useAuth();

  // 已登录则直接跳转
  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  // ── 页面状态 ─────────────────────────────────────────────────────────────
  const [tab, setTab] = useState('login'); // 'login' | 'register' | 'reset'
  const [step, setStep] = useState(1);      // 注册/重置分步：1=输入邮箱, 2=输入验证码和密码

  // ── 表单字段 ─────────────────────────────────────────────────────────────
  // 🆕 记住密码逻辑：尝试从本地恢复
  const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('sharkfit_remember_me') === 'true');
  const [emailPrefix, setEmailPrefix] = useState(() => {
    const saved = localStorage.getItem('sharkfit_saved_email') || '';
    return rememberMe ? saved : '';
  });
  const [password, setPassword] = useState(() => {
    return rememberMe ? (localStorage.getItem('sharkfit_saved_pwd') || '') : '';
  });
  const [username, setUsername] = useState(''); // 🆕 用户名状态
  const [code, setCode]         = useState('');
  const [showPwd, setShowPwd]   = useState(false);

  // ── 🆕 邮箱后缀优化逻辑 ───────────────────────────────────────────────────
  const DOMAINS = ['@qq.com', '@163.com', '@gmail.com', '@outlook.com', '@icloud.com'];
  // 在登录模式下增加“纯用户名”选项
  const LOGIN_DOMAINS = [...DOMAINS, ' (纯用户名)'];
  
  // 🆕 优先从本地恢复上次使用的后缀
  const [emailSuffix, setEmailSuffix] = useState(() => {
    return localStorage.getItem('sharkfit_saved_suffix') || DOMAINS[0];
  });
  
  // 最终合成的邮箱地址
  const finalEmail = (emailPrefix.includes('@') || emailSuffix === ' (纯用户名)') 
    ? emailPrefix 
    : `${emailPrefix}${emailSuffix}`;

  // ── 交互状态 ─────────────────────────────────────────────────────────────
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState('');
  const [countdown, setCountdown]   = useState(0); // 倒计时（秒）

  // 倒计时 Effect（发送验证码后60秒内不能重发）
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { clearInterval(timer); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 切换Tab时重置状态
  const switchTab = (newTab) => {
    setTab(newTab);
    setStep(1);
    setError('');
    setSuccess('');
    setCode('');
    setPassword('');
  };

  // ── 发送验证码 (注册或找回密码) ──────────────────────────────────────────────────
  const handleSendCode = async () => {
    if (loading) return; // 预防多次触发
    if (!emailPrefix) {
      setError('请输入邮箱前缀');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    // 根据当前模式确定用途
    const purpose = tab === 'register' ? 'register' : 'reset-password';

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, purpose }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || '发送失败');
      } else {
        setSuccess('验证码已发送，请查收邮件 📬');
        setCountdown(60);
        setStep(2); // 进入第二步
      }
    } catch {
      setError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  // ── 注册提交 ─────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    if (loading) return;
    if (!code || !password || !username) {
      setError('用户名、验证码和密码均不能为空');
      return;
    }
    if (password.length < 6) {
      setError('密码长度不能少于 6 位');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password, code, username }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || '注册失败');
      } else {
        // 注册成功，自动登录
        login(data.token, data.user);
        navigate('/', { replace: true });
      }
    } catch {
      setError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  // ── 重置密码提交 ───────────────────────────────────────────────────────────
  const handleResetPassword = async () => {
    if (loading) return;
    if (!code || !password) {
      setError('验证码和新密码不能为空');
      return;
    }
    if (password.length < 6) {
      setError('新密码长度不能少于 6 位');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, code, newPassword: password }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || '重置失败');
      } else {
        setSuccess('密码已重置！请使用新密码登录 ✨');
        setTimeout(() => {
          switchTab('login');
        }, 2000);
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  // ── 登录提交 ─────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (loading) return;
    if (!emailPrefix || !password) {
      setError('邮箱和密码不能为空');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: finalEmail, password }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        setError(data.error || '邮箱或密码错误');
      } else {
        // 🆕 处理“记住我”逻辑
        if (rememberMe) {
          localStorage.setItem('sharkfit_remember_me', 'true');
          localStorage.setItem('sharkfit_saved_email', finalEmail);
          localStorage.setItem('sharkfit_saved_pwd', password);
        } else {
          localStorage.setItem('sharkfit_remember_me', 'false');
          localStorage.removeItem('sharkfit_saved_email');
          localStorage.removeItem('sharkfit_saved_pwd');
        }
        
        // 🆕 记住当前使用的后缀（无论是否勾选记住密码，都记住这个偏好）
        localStorage.setItem('sharkfit_saved_suffix', emailSuffix);
        
        login(data.token, data.user);
        navigate('/', { replace: true });
      }
    } catch {
      setError('网络错误，请检查连接后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (tab === 'login') handleLogin();
    else if (step === 1) handleSendCode();
    else if (tab === 'register') handleRegister();
    else if (tab === 'reset') handleResetPassword();
  };

  // ─── 渲染 ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#080c10] flex items-center justify-center p-4 relative overflow-hidden">

      {/* 背景光晕装饰 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-emerald-900/10 rounded-full blur-[100px] pointer-events-none" />

      {/* 网格背景 */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(16,185,129,0.5) 1px, transparent 1px),
                            linear-gradient(90deg, rgba(16,185,129,0.5) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative w-full max-w-md"
      >
        {/* Logo 区域 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-700 rounded-2xl shadow-lg shadow-emerald-900/40 mb-4 rotate-3">
            <span className="text-3xl">🐟</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wider">FINFIT</h1>
          <p className="text-xs text-emerald-500/70 tracking-[4px] uppercase mt-1">鱼健 · 训练追踪</p>
        </div>

        {/* 卡片主体 */}
        <div className="bg-[#0d1117] border border-white/[0.06] rounded-3xl p-8 shadow-2xl shadow-black/50 backdrop-blur">

          {/* Tab 切换 */}
          {tab !== 'reset' && (
            <div className="flex bg-white/[0.04] rounded-xl p-1 mb-8">
              {['login', 'register'].map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all duration-200 ${
                    tab === t
                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-900/50'
                      : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {t === 'login' ? '登录' : '注册'}
                </button>
              ))}
            </div>
          )}

          {tab === 'reset' && (
             <div className="mb-8">
                <button 
                  onClick={() => switchTab('login')}
                  className="text-xs text-neutral-500 hover:text-white flex items-center gap-1 transition-colors"
                >
                  ← 返回登录
                </button>
                <h2 className="text-xl font-black text-white mt-4">找回密码</h2>
                <p className="text-xs text-neutral-500 mt-1">通过邮箱验证码重置您的密码</p>
             </div>
          )}

          {/* 表单内容 */}
          <form onSubmit={handleSubmit} className="space-y-4" id={`${tab}-form`}>
            <AnimatePresence mode="wait">
              {tab === 'login' ? (
                /* ── 登录表单 ── */
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <InputField
                    icon={<Mail size={16} />}
                    type="text"
                    name="login_email"
                    placeholder="邮箱前缀或用户名"
                    value={emailPrefix}
                    onChange={setEmailPrefix}
                    autoComplete="username"
                    suffix={!emailPrefix.includes('@') && (
                      <select 
                        value={emailSuffix} 
                        onChange={e => setEmailSuffix(e.target.value)}
                        className="bg-transparent text-emerald-500 text-xs font-bold outline-none cursor-pointer border-l border-white/10 pl-2 ml-1 appearance-none"
                      >
                        {LOGIN_DOMAINS.map(d => <option key={d} value={d} className="bg-[#0d1117]">{d}</option>)}
                      </select>
                    )}
                  />
                  <InputField
                    icon={<Lock size={16} />}
                    type={showPwd ? 'text' : 'password'}
                    name="login_password"
                    placeholder="密码"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    suffix={
                      <button type="button" onClick={() => setShowPwd(!showPwd)}
                        className="text-neutral-500 hover:text-white transition-colors">
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    }
                  />

                  <div className="flex items-center justify-between px-1">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={rememberMe}
                          onChange={(e) => setRememberMe(e.target.checked)}
                        />
                        <div className={`w-4 h-4 border rounded transition-all flex items-center justify-center ${
                          rememberMe ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 bg-white/5'
                        }`}>
                          {rememberMe && <div className="w-2 h-2 bg-white rounded-[1px]" />}
                        </div>
                      </div>
                      <span className="text-xs text-neutral-400 group-hover:text-neutral-300 transition-colors">记住密码</span>
                    </label>
                    <button 
                      type="button"
                      onClick={() => switchTab('reset')}
                      className="text-xs text-emerald-500/70 hover:text-emerald-400 transition-colors"
                    >
                      忘记密码？
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* ── 注册/找回 页面共享布局 ── */
                <motion.div
                  key={tab}
                  initial={{ opacity: 0, x: 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -16 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  {/* 步骤提示 */}
                  <div className="flex items-center gap-2 text-xs text-neutral-500 mb-2">
                    <StepDot n={1} active={step >= 1} />
                    <div className={`flex-1 h-px ${step >= 2 ? 'bg-emerald-500/50' : 'bg-white/10'}`} />
                    <StepDot n={2} active={step >= 2} />
                  </div>

                  {/* 邮箱 */}
                  <InputField
                    icon={<Mail size={16} />}
                    type="text"
                    name="email"
                    placeholder="邮箱前缀"
                    value={emailPrefix}
                    onChange={setEmailPrefix}
                    disabled={step === 2}
                    autoComplete="email"
                    suffix={step === 1 && !emailPrefix.includes('@') && (
                      <select 
                        value={emailSuffix} 
                        onChange={e => setEmailSuffix(e.target.value)}
                        className="bg-transparent text-emerald-500 text-xs font-bold outline-none cursor-pointer border-l border-white/10 pl-2 ml-1 appearance-none"
                      >
                        {DOMAINS.map(d => <option key={d} value={d} className="bg-[#0d1117]">{d}</option>)}
                      </select>
                    )}
                  />

                  {/* 第二步：验证码 + 密码 (+ 用户名 if register) */}
                  <AnimatePresence>
                    {step === 2 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="space-y-4 overflow-hidden"
                      >
                        {tab === 'register' && (
                          <InputField
                            icon={<User size={16} />}
                            type="text"
                            placeholder="用户名"
                            value={username}
                            onChange={setUsername}
                          />
                        )}

                        <InputField
                          icon={<ShieldCheck size={16} />}
                          type="text"
                          name="code"
                          placeholder="6位验证码"
                          value={code}
                          onChange={setCode}
                          maxLength={6}
                          inputMode="numeric"
                          suffix={
                            <button
                              type="button"
                              onClick={handleSendCode}
                              disabled={countdown > 0 || loading}
                              className="text-xs text-emerald-400 hover:text-emerald-300 disabled:text-neutral-600 font-bold transition-colors"
                            >
                              {countdown > 0 ? `${countdown}s` : '重发'}
                            </button>
                          }
                        />

                        <InputField
                          icon={<Lock size={16} />}
                          type={showPwd ? 'text' : 'password'}
                          name="new-password"
                          placeholder={tab === 'register' ? "设置密码" : "新密码"}
                          value={password}
                          onChange={setPassword}
                          autoComplete="new-password"
                          suffix={
                            <button type="button" onClick={() => setShowPwd(!showPwd)}
                              className="text-neutral-500 hover:text-white transition-colors">
                              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          }
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 提示信息 */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                >
                  <AlertCircle size={15} className="shrink-0" />
                  {error}
                </motion.div>
              )}
              {success && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-4 py-3"
                >
                  <CheckCircle2 size={15} className="shrink-0" />
                  {success}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 按钮 */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black rounded-xl transition-all shadow-lg shadow-emerald-900/40 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 text-sm"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>
                  {tab === 'login' && '登录'}
                  {tab === 'reset' && step === 1 && '找回密码'}
                  {tab === 'reset' && step === 2 && '重置密码'}
                  {tab === 'register' && step === 1 && <><Send size={15} /> 发送验证码</>}
                  {tab === 'register' && step === 2 && '完成注册'}
                </>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-neutral-600 mt-6">
            © {new Date().getFullYear()} FinFit · 专注训练，持续进步
          </p>
        </div>
      </motion.div>
    </div>
  );
};

// ─── 子组件 ──────────────────────────────────────────────────────────────────

// onChange 从解构中单独取出，避免被 {...rest} 重复传入 <input>（React 警告）
// 同时保证 <input> 收到的 onChange 是正确的 DOM 事件格式
const InputField = ({ icon, suffix, className = '', onChange, ...rest }) => (
  <div className={`flex items-center gap-3 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 focus-within:border-emerald-500/50 focus-within:bg-emerald-500/5 transition-all duration-200 ${className}`}>
    <span className="text-neutral-500 shrink-0">{icon}</span>
    <input
      {...rest}
      onChange={e => onChange(e.target.value)}
      className="flex-1 bg-transparent text-white text-sm placeholder:text-neutral-600 outline-none disabled:opacity-50"
    />
    {suffix && <span className="shrink-0">{suffix}</span>}
  </div>
);

const StepDot = ({ n, active }) => (
  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all ${
    active ? 'bg-emerald-500 text-white' : 'bg-white/10 text-neutral-500'
  }`}>
    {n}
  </div>
);

export default Login;
