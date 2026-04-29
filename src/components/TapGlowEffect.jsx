import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TapGlowEffect = () => {
  const [glows, setGlows] = useState([]);

  useEffect(() => {
    const handlePointerDown = (e) => {
      // Ignore right clicks
      if (e.button && e.button !== 0) return;

      const newGlow = {
        id: Date.now() + Math.random(),
        x: e.clientX,
        y: e.clientY
      };

      setGlows(prev => [...prev, newGlow]);

      // Remove the glow after the animation completes
      setTimeout(() => {
        setGlows(prev => prev.filter(g => g.id !== newGlow.id));
      }, 500);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden">
      <AnimatePresence>
        {glows.map(glow => (
          <motion.div
            key={glow.id}
            initial={{ opacity: 0.8, scale: 0 }}
            animate={{ opacity: 0, scale: 1.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            style={{
              position: 'absolute',
              left: glow.x - 75,
              top: glow.y - 75,
              width: 150,
              height: 150,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(16,185,129,0.5) 0%, rgba(16,185,129,0) 70%)',
              mixBlendMode: 'screen',
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default TapGlowEffect;
