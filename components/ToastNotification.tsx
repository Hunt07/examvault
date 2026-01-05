
import React, { useEffect } from 'react';
import { Award, CheckCircle, X, Info, TrendingDown } from 'lucide-react';

interface ToastNotificationProps {
  message: string;
  points?: number;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, points, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
        onClose();
    }, 4000); // Disappear after 4 seconds

    return () => clearTimeout(timer);
  }, [onClose]);

  const isNegativePoints = points && points < 0;

  const bgColor = type === 'error' || isNegativePoints ? 'bg-red-50 dark:bg-red-900/20' : (type === 'info' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-white dark:bg-zinc-800');
  const borderColor = type === 'error' || isNegativePoints ? 'border-red-500' : (type === 'info' ? 'border-blue-500' : 'border-primary-500');
  const textColor = type === 'error' || isNegativePoints ? 'text-red-800 dark:text-red-200' : (type === 'info' ? 'text-blue-800 dark:text-blue-200' : 'text-slate-800 dark:text-white');

  return (
    <div className="fixed top-24 right-4 md:right-8 z-50 animate-slide-in">
      <div className={`${bgColor} border-l-4 ${borderColor} shadow-lg rounded-lg p-4 flex items-center gap-4 pr-12 relative min-w-[300px]`}>
        <div className={`p-2 rounded-full ${type === 'error' || isNegativePoints ? 'bg-red-100 text-red-600' : (type === 'info' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400' : 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400')}`}>
            {isNegativePoints ? <TrendingDown size={24} /> : (points ? <Award size={24} /> : (type === 'error' ? <Info size={24}/> : (type === 'info' ? <Info size={24}/> : <CheckCircle size={24} />)))}
        </div>
        <div>
            <h4 className={`font-bold ${textColor} text-base`}>
                {points ? (points > 0 ? `+${points} Points Earned!` : `${points} Points Deducted`) : (type === 'error' ? 'Error' : (type === 'info' ? 'Update' : 'Success'))}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{message}</p>
        </div>
        <button 
            onClick={onClose} 
            className="absolute top-2 right-2 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-zinc-700 transition"
        >
            <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default ToastNotification;
