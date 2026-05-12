import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Plus, Trash2, Edit3, ChevronLeft, Loader2, 
  Flame, Beef, Wheat, Droplet, MoreVertical, LayoutGrid, List, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useDietStore from '../store/useDietStore';
import AddCustomFoodModal from '../components/AddCustomFoodModal';

const FoodLibrary = () => {
  const navigate = useNavigate();
  const { foods, isLoadingFoods, searchFoods, deleteFood, toggleFavorite } = useDietStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingFood, setEditingFood] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'favorite'
  const [foodToDelete, setFoodToDelete] = useState(null);

  useEffect(() => {
    searchFoods('');
  }, [searchFoods]);

  const handleSearch = (val) => {
    setSearchQuery(val);
    searchFoods(val);
  };

  const filteredFoods = foods.filter(f => {
    if (filterMode === 'favorite') return f.is_favorite;
    return true;
  });

  return (
    <div className="min-h-screen bg-black pb-32">
      {/* Background Glows */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[40%] bg-primary/10 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="px-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pt-8 mb-6">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)}
              className="w-11 h-11 rounded-2xl bg-neutral-900/50 backdrop-blur-xl border border-white/5 
                         flex items-center justify-center text-white active:scale-90 transition-all shadow-xl"
            >
              <ChevronLeft size={22} />
            </button>
            <div>
              <h1 className="text-xl font-black text-white italic tracking-tighter uppercase leading-none">食物库</h1>
              <p className="text-[9px] text-neutral-500 font-black uppercase tracking-[0.2em] mt-1">Food Library</p>
            </div>
          </div>
          
          <button
            onClick={() => {
              setEditingFood(null);
              setIsAddModalOpen(true);
            }}
            className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-black
                       shadow-[0_0_15px_rgba(0,255,157,0.3)] active:scale-90 transition-all"
          >
            <Plus size={22} strokeWidth={3} />
          </button>
        </div>

        {/* Search & Tabs */}
        <div className="space-y-4 mb-6">
          <div className="flex gap-2.5">
            <div className="relative flex-1 group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 group-focus-within:text-primary transition-colors" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="搜索食物或营养..."
                className="w-full bg-neutral-900/80 backdrop-blur-xl border border-white/5 rounded-2xl pl-11 pr-4 py-3.5
                           text-sm text-white placeholder:text-neutral-700 outline-none focus:border-primary/30 transition-all shadow-inner"
              />
            </div>
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="w-12 h-12 rounded-2xl bg-neutral-900/50 border border-white/5 flex items-center justify-center
                         text-neutral-500 hover:text-white transition-all shadow-xl"
            >
              {viewMode === 'grid' ? <List size={20} /> : <LayoutGrid size={20} />}
            </button>
          </div>

          <div className="flex gap-1.5 p-1 bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl w-fit">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all
                         ${filterMode === 'all' ? 'bg-primary text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              全部食物
            </button>
            <button
              onClick={() => setFilterMode('favorite')}
              className={`px-5 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all
                         ${filterMode === 'favorite' ? 'bg-amber-500 text-black' : 'text-neutral-500 hover:text-neutral-300'}`}
            >
              我的收藏
            </button>
          </div>
        </div>

        {/* List */}
        {isLoadingFoods ? (
          <div className="flex flex-col items-center justify-center py-32">
            <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-widest mt-6">同步中...</p>
          </div>
        ) : (
          <div className="pb-10">
            <AnimatePresence mode="popLayout">
              <motion.div 
                layout
                className={viewMode === 'grid' ? "grid grid-cols-2 gap-3" : "space-y-2.5"}
              >
                {filteredFoods.map(food => (
                  <FoodCard 
                    key={food.id} 
                    food={food} 
                    mode={viewMode} 
                    onDelete={() => setFoodToDelete(food)}
                    onEdit={() => {
                      setEditingFood(food);
                      setIsAddModalOpen(true);
                    }}
                    onToggleFav={() => toggleFavorite(food.id)}
                  />
                ))}
              </motion.div>
            </AnimatePresence>

            {filteredFoods.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-neutral-900/30 border border-dashed border-white/5 rounded-[32px] p-16 text-center"
              >
                <p className="text-xs text-neutral-500 font-bold uppercase tracking-widest">暂无记录</p>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>

      <ConfirmDeleteModal 
        isOpen={!!foodToDelete}
        food={foodToDelete} 
        onClose={() => setFoodToDelete(null)}
        onConfirm={async () => {
          await deleteFood(foodToDelete.id);
          setFoodToDelete(null);
        }}
      />

      <AddCustomFoodModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={() => searchFoods(searchQuery)}
        editFood={editingFood}
      />
    </div>
  );
};

const ConfirmDeleteModal = ({ isOpen, food, onClose, onConfirm }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-sm bg-neutral-900 border border-white/10 rounded-[28px] p-7 shadow-2xl overflow-hidden"
          >
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mb-5">
                <Trash2 size={28} />
              </div>
              <h3 className="text-lg font-black text-white uppercase mb-2">确认删除？</h3>
              <p className="text-xs text-neutral-500 font-medium leading-relaxed mb-6 px-4">
                确定要从库中移除 <span className="text-white font-bold italic">"{food?.name}"</span> 吗？此操作不可撤销。
              </p>
              <div className="grid grid-cols-2 gap-3 w-full">
                <button onClick={onClose} className="py-3.5 rounded-xl bg-neutral-800 text-neutral-400 font-black uppercase text-[10px] tracking-widest transition-all">取消</button>
                <button onClick={onConfirm} className="py-3.5 rounded-xl bg-red-500 text-black font-black uppercase text-[10px] tracking-widest transition-all">确定删除</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const FoodCard = ({ food, mode, onDelete, onEdit, onToggleFav }) => {
  const isFav = !!food.is_favorite;

  // Q-弹动画配置
  const springConfig = {
    type: "spring",
    stiffness: 500,
    damping: 30,
    mass: 1
  };

  const cardVariants = {
    initial: { opacity: 0, scale: 0.9, y: 10 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.95, y: 5, transition: { duration: 0.2 } }
  };

  if (mode === 'grid') {
    return (
      <motion.div
        layout
        variants={cardVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={springConfig}
        className="relative bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-[24px] p-3.5 
                   flex flex-col gap-3 overflow-hidden transition-colors shadow-xl"
      >
        {/* Header: Name & Star */}
        <div className="flex items-start justify-between">
          <h4 className="text-sm font-black text-white italic leading-tight truncate flex-1 pr-2">
            {food.name}
          </h4>
          <button 
            onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
            className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all shrink-0
                       ${isFav ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-neutral-700'}`}
          >
            <Star size={14} fill={isFav ? "currentColor" : "none"} strokeWidth={2.5} />
          </button>
        </div>

        {/* Calories Info */}
        <div className="flex items-center gap-1.5 -mt-1">
          <span className="text-xs text-orange-400 font-black tracking-tight">{food.calories_per_100g}</span>
          <span className="text-[8px] text-neutral-600 font-black uppercase tracking-tighter">kcal / {food.base_weight || 100}g</span>
        </div>

        {/* Macros: Compact Row */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { label: '蛋白质', val: food.protein_per_100g, color: 'text-blue-400' },
            { label: '碳水', val: food.carbs_per_100g, color: 'text-amber-400' },
            { label: '脂肪', val: food.fat_per_100g, color: 'text-purple-400' }
          ].map((m, idx) => (
            <div key={idx} className="bg-black/20 rounded-xl p-1.5 text-center border border-white/[0.02]">
              <div className="text-[7px] text-neutral-600 font-black mb-0.5">{m.label}</div>
              <div className={`text-[10px] ${m.color} font-black`}>{m.val}<span className="text-[7px] opacity-60 ml-0.5">g</span></div>
            </div>
          ))}
        </div>

        {/* Actions: Integrated row */}
        <div className="flex gap-1.5 pt-0.5">
          <button 
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="flex-1 py-2 rounded-xl bg-white/5 flex items-center justify-center text-neutral-500 hover:text-white transition-all border border-white/5"
          >
            <Edit3 size={14} />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-10 py-2 rounded-xl bg-red-500/5 flex items-center justify-center text-red-500/40 hover:text-red-500 transition-all border border-red-500/5"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={springConfig}
      className="bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-[20px] p-3.5 flex items-center justify-between gap-3
                 transition-colors shadow-xl"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <button 
          onClick={onToggleFav}
          className={`w-11 h-11 rounded-xl shrink-0 transition-all flex items-center justify-center shadow-lg
                     ${isFav ? 'bg-amber-500 text-black' : 'bg-white/5 text-neutral-700'}`}
        >
          <Star size={18} fill={isFav ? "currentColor" : "none"} strokeWidth={2.5} />
        </button>
        <div className="min-w-0">
          <h4 className="text-sm font-black text-white italic truncate leading-tight">
            {food.name}
          </h4>
          <div className="flex items-center gap-2.5 mt-1">
            <span className="text-xs text-orange-400 font-black">{food.calories_per_100g} kcal</span>
            <span className="text-[9px] text-neutral-600 font-black uppercase bg-white/5 px-1.5 py-0.5 rounded-md">
              {food.base_weight || 100}g 基准
            </span>
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-1.5 shrink-0">
        <button onClick={onEdit} className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-neutral-500 border border-white/5">
          <Edit3 size={18} />
        </button>
        <button onClick={onDelete} className="w-10 h-10 rounded-xl bg-red-500/5 flex items-center justify-center text-red-500/40 border border-red-500/5">
          <Trash2 size={18} />
        </button>
      </div>
    </motion.div>
  );
};

export default FoodLibrary;
