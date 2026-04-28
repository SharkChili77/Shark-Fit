/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Shark Fit - 默认种子数据 (seedData.js)
 * 
 * 包含：
 *   - 31 个基础训练动作 (defaultExercises)
 *   - 7 天初始周计划 (defaultRoutines)
 * 
 * 职责：
 *   1. 用于数据库首次启动时的初始化
 *   2. 用于新用户注册时的初始数据分配（确保新用户数据独立且标准，不随管理员更改而变动）
 * ═══════════════════════════════════════════════════════════════════════════
 */

const defaultExercises = [
  // 周一 胸+三头+腹
  { id: 'e1', name: '平板杠铃卧推', target: '胸', sets: 4, reps: '6-8', rest: 90, imageUrl: '', notes: '作用：胸部主力动作，优先建立胸部厚度和基础推力。\n细节：沉肩扎根，肩胛骨收紧贴紧椅背，下放至胸骨下缘。' },
  { id: 'e2', name: '上斜哑铃卧推', target: '胸', sets: 3, reps: '8-10', rest: 75, imageUrl: '', notes: '作用：补上胸，改善胸型，让上半身更立体。\n细节：椅子角度30度左右，推起时体会锁骨下方的收缩。' },
  { id: 'e3', name: '器械推胸', target: '胸', sets: 3, reps: '10-12', rest: 60, imageUrl: '', notes: '作用：在更稳定轨迹里继续堆胸部训练量。\n细节：保持核心收紧，推起时不要耸肩。' },
  { id: 'e4', name: '蝴蝶机夹胸 / 绳索夹胸', target: '胸', sets: 2, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：胸部挤压收尾，让胸部更有泵感 and 线条。\n细节：手臂微屈固定角度，想象用手肘去抱树，顶峰收缩停顿1秒。' },
  { id: 'e5', name: '绳索下压', target: '三头', sets: 3, reps: '10-12', rest: 45, imageUrl: '', notes: '作用：训练三头，帮你后续卧推更稳。\n细节：大臂夹紧身体两侧固定不动，只活动小臂。' },
  { id: 'e6', name: '过顶臂屈伸', target: '三头', sets: 2, reps: '10-12', rest: 45, imageUrl: '', notes: '作用：补三头长头，让手臂更完整。\n细节：下放时感受大臂后侧的强烈拉伸。' },
  { id: 'e7', name: '卷腹 / 悬垂举腿', target: '腹部', sets: 3, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：腹部刺激。\n细节：卷腹时下背部贴紧地面，靠挤压腹肌把上背部带离地面。' },
  // 周二 背+二头
  { id: 'e8', name: '高位下拉', target: '背', sets: 4, reps: '8-10', rest: 75, imageUrl: '', notes: '作用：建立背阔发力，改善背不宽的问题。\n细节：下拉时挺胸，手肘向腰部内收，不要过度后仰。' },
  { id: 'e9', name: '坐姿划船', target: '背', sets: 3, reps: '10-12', rest: 60, imageUrl: '', notes: '作用：补中背厚度和体态。\n细节：拉起时肩胛骨先收缩，手肘贴着身体两侧拉至腹部。' },
  { id: 'e10', name: '单臂哑铃划船', target: '背', sets: 3, reps: '10', rest: 60, imageUrl: '', notes: '作用：补左右平衡，强化控制。\n细节：背部保持平直，手肘像拉锯一样向后上方拉。' },
  { id: 'e11', name: '面拉 / 反向飞鸟', target: '肩背', sets: 3, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：改善圆肩、补后束和上背。\n细节：绳索面拉时向额头方向拉，并在终点做外部旋转。' },
  { id: 'e12', name: '哑铃弯举', target: '二头', sets: 3, reps: '10-12', rest: 45, imageUrl: '', notes: '作用：基础二头训练。\n细节：手腕保持中立或微微外旋，下放时控制速度。' },
  { id: 'e13', name: '锤式弯举', target: '二头', sets: 2, reps: '10-12', rest: 45, imageUrl: '', notes: '作用：补肱肌和前臂，让手臂更有形。\n细节：像拿锤子一样握住哑铃，直上直下。' },
  // 周四 肩+胸+腹
  { id: 'e14', name: '坐姿肩推', target: '肩', sets: 3, reps: '8-10', rest: 75, imageUrl: '', notes: '作用：肩部基础力量和立体感。\n细节：手肘略微向前指向，不要完全向两侧打开以保护肩关节。' },
  { id: 'e15', name: '哑铃侧平举', target: '肩', sets: 4, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：肩宽、肩线，对薄肌观感非常关键。\n细节：手臂微屈，想象用手肘去提水桶，不要耸肩借力。' },
  { id: 'e16', name: '反向飞鸟', target: '肩背', sets: 3, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：后束和体态。\n细节：俯身或使用器械，感受肩部后侧的挤压。' },
  { id: 'e17', name: '上斜器械推胸', target: '胸', sets: 3, reps: '8-10', rest: 60, imageUrl: '', notes: '作用：胸第二次刺激，重点上胸。\n细节：控制离心下放的速度。' },
  { id: 'e18', name: '绳索夹胸', target: '胸', sets: 3, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：胸部线条和收缩感。\n细节：动作要慢，体会胸大肌从拉伸到完全收缩的全过程。' },
  { id: 'e19', name: '俯卧撑', target: '胸', sets: 2, reps: '力竭', rest: 60, imageUrl: '', notes: '作用：胸部收尾，增加血感。\n细节：核心收紧，身体呈一条直线。' },
  { id: 'e20', name: '绳索卷腹', target: '腹部', sets: 3, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：腹部第二次刺激。\n细节：固定臀部，像是要把胸腔卷向骨盆。' },
  // 周五 腿+核心
  { id: 'e21', name: '深蹲 / 史密斯深蹲', target: '腿', sets: 4, reps: '6-8', rest: 90, imageUrl: '', notes: '作用：腿部主力动作，维持整体比例和代谢。\n细节：膝盖顺着脚尖方向打开，背部挺直，蹲至大腿至少平行地面。' },
  { id: 'e22', name: '罗马尼亚硬拉', target: '腿', sets: 3, reps: '8-10', rest: 75, imageUrl: '', notes: '作用：臀腿后侧，让下肢线条更完整。\n细节：膝盖微屈固定，臀部向后推，感受大腿后侧的强烈拉伸。' },
  { id: 'e23', name: '腿举', target: '腿', sets: 3, reps: '10-12', rest: 60, imageUrl: '', notes: '作用：继续堆腿部训练量。\n细节：推起时膝盖不要完全锁死，下放时幅度要够但臀部不要离开靠背。' },
  { id: 'e24', name: '腿弯举', target: '腿', sets: 3, reps: '12', rest: 45, imageUrl: '', notes: '作用：补股二头。\n细节：顶峰收缩时稍微停顿。' },
  { id: 'e25', name: '提踵', target: '小腿', sets: 3, reps: '15-20', rest: 45, imageUrl: '', notes: '作用：小腿。\n细节：下放至最低点感受拉伸，垫起至最高点停顿。' },
  { id: 'e26', name: '平板支撑 + 卷腹', target: '核心', sets: 3, reps: '力竭', rest: 45, imageUrl: '', notes: '作用：核心稳定和腹部刺激。\n细节：平板支撑时注意不要塌腰。' },
  // 周六 背+手臂+腹
  { id: 'e27', name: '高位下拉（反手 / 窄握）', target: '背', sets: 3, reps: '10-12', rest: 60, imageUrl: '', notes: '作用：换角度再刺激背阔。\n细节：反手握距与肩同宽，下拉时感受下背阔肌的收缩。' },
  { id: 'e28', name: '胸托划船 / 器械划船', target: '背', sets: 3, reps: '10-12', rest: 60, imageUrl: '', notes: '作用：减少借力，更专注背部发力。\n细节：胸部全程紧贴靠垫。' },
  { id: 'e29', name: '直臂下压', target: '背', sets: 3, reps: '12-15', rest: 45, imageUrl: '', notes: '作用：背阔孤立收尾。\n细节：手臂微屈固定，用背阔肌的力量把绳索压向大腿前方。' },
  { id: 'e30', name: '杠铃弯举', target: '二头', sets: 3, reps: '10-12', rest: 45, imageUrl: '', notes: '作用：二头主练。\n细节：身体不要前后摇晃借力，大臂贴紧身体。' },
  { id: 'e31', name: '绳索弯举 / 集中弯举', target: '二头', sets: 2, reps: '10-12', rest: 45, imageUrl: '', notes: '作用：补泵感 and 手臂线条。\n细节：全程控制重量，顶峰极致挤压。' },
];

const defaultRoutines = [
  { dayOfWeek: 1, name: "胸 + 三头 + 腹", exerciseIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6', 'e7'] },
  { dayOfWeek: 2, name: "背 + 二头", exerciseIds: ['e8', 'e9', 'e10', 'e11', 'e12', 'e13'] },
  { dayOfWeek: 3, name: "休息", exerciseIds: [] },
  { dayOfWeek: 4, name: "肩 + 胸 + 腹", exerciseIds: ['e14', 'e15', 'e16', 'e17', 'e18', 'e19', 'e20'] },
  { dayOfWeek: 5, name: "腿 + 核心", exerciseIds: ['e21', 'e22', 'e23', 'e24', 'e25', 'e26'] },
  { dayOfWeek: 6, name: "背 + 手臂 + 腹", exerciseIds: ['e27', 'e28', 'e29', 'e30', 'e31', 'e7'] },
  { dayOfWeek: 0, name: "休息", exerciseIds: [] },
];

module.exports = {
  defaultExercises,
  defaultRoutines
};
