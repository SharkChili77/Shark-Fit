import ReactConfetti from 'react-confetti';
import useFitnessStore from '../store/useFitnessStore';

const ConfettiEffect = () => {
  const { showConfetti } = useFitnessStore();
  
  if (!showConfetti) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <ReactConfetti 
        width={window.innerWidth} 
        height={window.innerHeight} 
        recycle={false} // 不循环，只喷一次
        numberOfPieces={400}
        gravity={0.15}
      />
    </div>
  );
};

export default ConfettiEffect;
