/**
 * 修改密码弹窗 (ChangePasswordModal.jsx)
 * 支持两种验证方式：原密码 或 邮箱验证码
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Lock, Eye, EyeOff, ShieldCheck, Send, Loader2, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const ChangePasswordModal = ({ onClose }) => {
  const { authFetch, user, API_BASE_URL } = useAuth();

  const [mode, setMode] = useState('password'); // 'password' | 'code'
  const [oldPwd, setOldPwd]   = useState('');
  const [newPwd, setNewPwd]   = useState('');
  const [code, setCode]       = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');

  // 发送验证码
  const handleSendCode = async () => {
    setSending(true);
    setError('');
    try {
      const resp = await fetch(`${API_BASE_URL}/api/auth/send-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, purpose: 'change-password' }),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || '发送失败'); }
      else {
        setCountdown(60);
        const timer = setInterval(() => {
          setCountdown(c => { if (c <= 1) { clearInterval(timer); return 0; } return c - 1; });
        }, 1000);
      }
    } catch { setError('网络错误'); }
    finally { setSending(false); }
  };

  const handleSubmit = async () => {
    if (!newPwd || newPwd.length < 6) { setError('新密码至少6位'); return; }
    if (mode === 'password' && !oldPwd) { setError('请输入原密码'); return; }
    if (mode === 'code' && !code) { setError('请输入验证码'); return; }

    setLoading(true); setError('');
    try {
      const body = mode === 'password'
        ? { oldPassword: oldPwd, newPassword: newPwd }
        : { code, newPassword: newPwd };

      const resp = await authFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      if (!resp.ok) { setError(data.error || '修改失败'); }
      else { setSuccess('密码修改成功！'); setTimeout(onClose, 1500); }
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 16 }}
        className="relative w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 text-neutral-600 hover:text-white transition-colors">
          <X size={18} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 bg-emerald-500/20 rounded-xl flex items-center justify-center">
            <KeyRound size={18} className="text-emerald-400" />
          </div>
          <h3 className="text-white font-black text-lg">修改密码</h3>
        </div>

        {/* 验证方式切换 */}
        <div className="flex bg-white/[0.04] rounded-xl p-1 mb-5">
          {[['password', '原密码验证'], ['code', '邮箱验证码']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                mode === m ? 'bg-emerald-500 text-white' : 'text-neutral-400 hover:text-white'
              }`}
            >{label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {mode === 'password' ? (
            <PwdInput label="原密码" value={oldPwd} onChange={setOldPwd} show={showOld} toggle={() => setShowOld(!showOld)} />
          ) : (
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 focus-within:border-emerald-500/50 transition-all">
              <ShieldCheck size={15} className="text-neutral-500 shrink-0" />
              <input
                type="text" inputMode="numeric" maxLength={6} placeholder="6位验证码"
                value={code} onChange={e => setCode(e.target.value)}
                className="flex-1 bg-transparent text-white text-sm placeholder:text-neutral-600 outline-none"
              />
              <button onClick={handleSendCode} disabled={countdown > 0 || sending}
                className="text-xs text-emerald-400 hover:text-emerald-300 disabled:text-neutral-600 whitespace-nowrap font-bold flex items-center gap-1">
                {sending ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                {countdown > 0 ? `${countdown}s` : '发送'}
              </button>
            </div>
          )}

          <PwdInput label="新密码" value={newPwd} onChange={setNewPwd} show={showNew} toggle={() => setShowNew(!showNew)} autoComplete="new-password" />

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle size={13} /> {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              <CheckCircle2 size={13} /> {success}
            </div>
          )}

          <button onClick={handleSubmit} disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-black rounded-xl transition-all flex items-center justify-center gap-2 text-sm disabled:opacity-60">
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={15} />}
            {loading ? '提交中...' : '确认修改'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const PwdInput = ({ label, value, onChange, show, toggle, autoComplete }) => (
  <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 focus-within:border-emerald-500/50 transition-all">
    <Lock size={15} className="text-neutral-500 shrink-0" />
    <input
      type={show ? 'text' : 'password'} placeholder={label} value={value}
      onChange={e => onChange(e.target.value)} autoComplete={autoComplete}
      className="flex-1 bg-transparent text-white text-sm placeholder:text-neutral-600 outline-none"
    />
    <button type="button" onClick={toggle} className="text-neutral-500 hover:text-white transition-colors">
      {show ? <EyeOff size={15} /> : <Eye size={15} />}
    </button>
  </div>
);

export default ChangePasswordModal;
