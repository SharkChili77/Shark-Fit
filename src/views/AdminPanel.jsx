/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 管理员控制台 (views/AdminPanel.jsx)
 *
 * 功能：
 *   - 查看所有注册用户（邮箱、角色、注册时间、数据量统计）
 *   - 一键删除用户（含确认弹窗）
 *   - 极客暗黑风格数据表格
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, ShieldCheck, Trash2, Loader2, RefreshCw,
  AlertTriangle, Dumbbell, ClipboardList, Crown, UserX, Mail, Camera
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const AdminPanel = () => {
  const { user: currentUser, authFetch, API_BASE_URL } = useAuth();

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // 待删除用户
  const [deleting, setDeleting]   = useState(false);
  const [error, setError]         = useState('');

  // 🆕 系统配置状态
  const [systemData, setSystemData] = useState({ wechat: '', email: '', qr: '' });
  const [systemLoading, setSystemLoading] = useState(false);
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  const qrInputRef = useRef(null);

  // ── 获取用户列表 ─────────────────────────────────────────────────────────
  const fetchUsers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const resp = await authFetch('/api/admin/users');
      if (!resp.ok) {
        const data = await resp.json();
        setError(data.error || '获取用户列表失败');
      } else {
        const data = await resp.json();
        setUsers(data);
      }
    } catch {
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // 🆕 获取系统配置
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/system/contact`)
      .then(r => r.json())
      .then(data => {
        setSystemData(data);
        setQrPreview(data.qr ? `${API_BASE_URL}${data.qr}` : '');
      });
  }, [API_BASE_URL]);

  const handleUpdateSystem = async (e) => {
    e.preventDefault();
    setSystemLoading(true);
    try {
      const formData = new FormData();
      formData.append('wechat', systemData.wechat);
      formData.append('email', systemData.email);
      if (qrFile) formData.append('qr_file', qrFile);

      const resp = await authFetch('/api/system/contact', {
        method: 'POST',
        body: formData, // 注意：不需要设置 Content-Type，浏览器会自动处理 multipart/form-data
      });

      if (!resp.ok) throw new Error('保存失败');
      alert('系统配置已更新！');
      window.location.reload(); // 🆕 强制刷新以同步全局系统配置
    } catch (err) {
      alert(err.message);
    } finally {
      setSystemLoading(false);
    }
  };

  // ── 删除用户 ─────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const resp = await authFetch(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (!resp.ok) {
        const data = await resp.json();
        setError(data.error || '删除失败');
      } else {
        // 从列表中移除
        setUsers(prev => prev.filter(u => u.id !== deleteTarget.id));
        setDeleteTarget(null);
      }
    } catch {
      setError('删除失败，请重试');
    } finally {
      setDeleting(false);
    }
  };

  // ─── 渲染 ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-full">
      {/* 页面标题区 */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <ShieldCheck size={18} className="text-emerald-400" />
          </div>
          <h2 className="text-xl font-black text-white tracking-wide">管理员控制台</h2>
          <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full border border-emerald-500/30 font-bold">
            ADMIN
          </span>
        </div>
        <p className="text-neutral-500 text-sm ml-11">用户管理与系统监控</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          icon={<Users size={18} />}
          label="注册用户"
          value={users.length}
          color="emerald"
        />
        <StatCard
          icon={<Crown size={18} />}
          label="管理员"
          value={users.filter(u => u.role === 'admin').length}
          color="amber"
        />
      </div>

      {/* 🆕 系统设置面板（固定在上方，方便管理员修改） */}
      <div className="bg-[#0d1117] border border-emerald-500/20 rounded-2xl overflow-hidden mb-8 shadow-lg shadow-emerald-500/5">
        <div className="px-5 py-4 border-b border-white/[0.06] bg-emerald-500/5 flex items-center justify-between">
          <h3 className="text-sm font-black text-emerald-400 flex items-center gap-2">
            <RefreshCw size={14} className={systemLoading ? 'animate-spin' : ''} />
            创作者名片设置 (仅管理员可见)
          </h3>
          <span className="text-[10px] text-neutral-500">更新用户反馈名片的信息</span>
        </div>
        
        <form onSubmit={handleUpdateSystem} className="p-6 flex flex-col md:flex-row gap-8">
          {/* 二维码预览与上传 */}
          <div className="flex flex-col items-center gap-3">
            <div 
              onClick={() => qrInputRef.current.click()}
              className="group relative w-36 h-36 bg-white/5 border-2 border-dashed border-white/10 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500/50 transition-all overflow-hidden shadow-inner"
            >
              {qrPreview ? (
                <img src={qrPreview} alt="qr" className="w-full h-full object-contain p-2" />
              ) : (
                <div className="flex flex-col items-center text-neutral-600 group-hover:text-emerald-500">
                  <Camera size={32} />
                  <span className="text-[10px] mt-1 font-bold">上传二维码</span>
                </div>
              )}
              {/* 悬浮遮罩 */}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold">
                点击更换图片
              </div>
            </div>
            <input 
              type="file" ref={qrInputRef} hidden accept="image/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                  setQrFile(file);
                  setQrPreview(URL.createObjectURL(file));
                }
              }}
            />
          </div>

          {/* 信息输入区 */}
          <div className="flex-1 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase ml-1 tracking-widest">微信号</label>
                <input 
                  type="text"
                  value={systemData.wechat}
                  onChange={(e) => setSystemData({...systemData, wechat: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="例如: SharkFit_Official"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-neutral-500 uppercase ml-1 tracking-widest">反馈邮箱</label>
                <input 
                  type="email"
                  value={systemData.email}
                  onChange={(e) => setSystemData({...systemData, email: e.target.value})}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                  placeholder="your-email@example.com"
                />
              </div>
            </div>
            
            <button 
              type="submit" disabled={systemLoading}
              className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-900 text-black font-black rounded-xl text-sm transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-2"
            >
              {systemLoading && <Loader2 size={16} className="animate-spin" />}
              {systemLoading ? '正在同步到系统...' : '保存并公开名片'}
            </button>
            <p className="text-[10px] text-neutral-600 text-center italic">
              ✨ 保存后，所有用户点击首页左上角的“反馈建议”都能看到这些信息。
            </p>
          </div>
        </form>
      </div>


      {/* 错误提示 */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4"
          >
            <AlertTriangle size={15} className="shrink-0" />
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 用户列表表格 */}
      <div className="bg-[#0d1117] border border-white/[0.06] rounded-2xl overflow-hidden">
        {/* 表头 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-neutral-300 flex items-center gap-2">
            <Users size={14} className="text-emerald-400" />
            用户列表
          </h3>
          <button
            onClick={() => fetchUsers(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-emerald-400 transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>

        {/* 内容区 */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-emerald-400" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-neutral-600">
            <Users size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">暂无注册用户</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {users.map((u, i) => (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="px-5 py-4 hover:bg-white/[0.02] transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* 头像 */}
                  <div className={`w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shrink-0 font-black text-sm border ${
                    u.role === 'admin'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                      : 'bg-white/5 text-neutral-400 border-white/10'
                  }`}>
                    {u.avatar_url ? (
                      <img 
                        src={u.avatar_url.startsWith('/uploads') ? `${API_BASE_URL}${u.avatar_url}` : u.avatar_url} 
                        alt="avatar" 
                        className="w-full h-full object-cover" 
                      />
                    ) : (
                      <span>{u.username?.[0]?.toUpperCase() || u.email[0].toUpperCase()}</span>
                    )}
                  </div>

                  {/* 信息 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-bold text-white truncate">
                        {u.username || u.email.split('@')[0]}
                      </span>
                      {u.role === 'admin' && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/20 text-amber-400 rounded border border-amber-500/30 font-bold shrink-0">
                          管理员
                        </span>
                      )}
                      {u.id === currentUser?.id && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded border border-emerald-500/30 font-bold shrink-0">
                          你
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-neutral-600 mb-1">
                      <Mail size={10} className="opacity-50" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-neutral-600">
                      <span>{formatDate(u.created_at)}</span>
                      <span className="flex items-center gap-1">
                        <Dumbbell size={10} />
                        {u.exercise_count} 个动作
                      </span>
                      <span className="flex items-center gap-1">
                        <ClipboardList size={10} />
                        {u.record_count} 条记录
                      </span>
                    </div>
                  </div>

                  {/* 删除按钮（不能删管理员和自己） */}
                  {u.role !== 'admin' && u.id !== currentUser?.id && (
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 transition-all flex items-center justify-center shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 删除确认弹窗 */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              onClick={() => !deleting && setDeleteTarget(null)}
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 16 }}
              className="relative w-full max-w-sm bg-[#0d1117] border border-red-500/20 rounded-2xl p-6 shadow-2xl"
            >
              <div className="w-12 h-12 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <UserX size={24} className="text-red-400" />
              </div>
              <h3 className="text-white font-black text-center text-lg mb-1">确认删除用户</h3>
              <p className="text-neutral-400 text-sm text-center mb-1">
                即将删除用户：<span className="text-white font-bold">{deleteTarget.email}</span>
              </p>
              <p className="text-red-400/70 text-xs text-center mb-6">
                此操作将删除该用户的所有训练记录、体重数据和计划，<strong>且不可恢复</strong>！
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-white/5 border border-white/10 text-neutral-300 rounded-xl text-sm font-bold hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl text-sm font-bold hover:bg-red-500/30 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleting ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                  {deleting ? '删除中...' : '确认删除'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── 子组件 ──────────────────────────────────────────────────────────────────

const StatCard = ({ icon, label, value, color }) => {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    amber:   'text-amber-400   bg-amber-500/10   border-amber-500/20',
  };
  return (
    <div className={`border rounded-2xl p-4 ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-bold opacity-80">{label}</span>
      </div>
      <div className="text-3xl font-black">{value}</div>
    </div>
  );
};

const formatDate = (dateStr) => {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
};

export default AdminPanel;
