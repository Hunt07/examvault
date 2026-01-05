
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';

interface TooltipGuideProps {
  targetSelector: string;
  content: string;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}

const TooltipGuide: React.FC<TooltipGuideProps> = ({
  targetSelector,
  content,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  // Force a re-render to calculate position after tooltip mounts/resizes
  const [, forceUpdate] = useState({});

  useLayoutEffect(() => {
    // Delay slightly to allow any layout transitions to settle
    const timeoutId = setTimeout(() => {
        const targetElement = document.querySelector(targetSelector) as HTMLElement;

        // Treat 'body' as a general welcome/end step (modal view).
        if (targetElement && targetSelector !== 'body') {
          const style = window.getComputedStyle(targetElement);
          
          // Only modify position if it's static to preserve fixed/absolute layouts
          // NOTE: We avoid modifying DOM styles directly if possible to prevent layout thrashing,
          // but raising Z-Index is needed for the highlight effect.
          if (style.position === 'static') {
              targetElement.style.position = 'relative';
          }
          
          // Ensure target is above overlay
          targetElement.style.zIndex = '10001';

          const updateRect = () => {
            const rect = targetElement.getBoundingClientRect();
            // Basic validity check to avoid placing tooltip offscreen if element is hidden
            if (rect.width > 0 && rect.height > 0) {
                 setPosition({
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                });
            }
          };

          updateRect();
          window.addEventListener('resize', updateRect);
          window.addEventListener('scroll', updateRect, true); // Capture scroll

          return () => {
            targetElement.style.zIndex = '';
            if (targetElement.style.position === 'relative') {
                targetElement.style.position = '';
            }
            window.removeEventListener('resize', updateRect);
            window.removeEventListener('scroll', updateRect, true);
          };
        } else {
          setPosition(null); // Trigger modal view
        }
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [targetSelector, currentStep]);

  // Re-calculate position when content changes or step changes to ensure tooltip fits
  useLayoutEffect(() => {
      forceUpdate({});
  }, [content, position]);

  const getTooltipPosition = () => {
    if (!position || !tooltipRef.current) return { visibility: 'hidden' as const };
    
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let top = 0;
    let left = 0;

    // Heuristic: If the element is tall (like a sidebar) and on the left
    const isSidebar = position.height > viewportHeight * 0.5 && position.left < 100;

    if (isSidebar) {
        // Center vertically relative to the element, but clamped to viewport
        const verticalCenter = position.top + (position.height / 2);
        top = verticalCenter - (tooltipRect.height / 2);
        
        // Place to the Right of the sidebar with some padding
        left = position.left + position.width + 20;
    } else {
        // Standard horizontal layout (Top or Bottom placement)
        left = position.left + (position.width / 2) - (tooltipRect.width / 2);

        const spaceBelow = viewportHeight - (position.top + position.height);
        const spaceAbove = position.top;

        if (spaceBelow >= tooltipRect.height + 20) {
            // Place Bottom
            top = position.top + position.height + 15;
        } else if (spaceAbove >= tooltipRect.height + 20) {
            // Place Top
            top = position.top - tooltipRect.height - 15;
        } else {
            // Fallback: Place Bottom
            top = position.top + position.height + 15;
        }
    }
    
    // Safety Clamps to prevent off-screen
    if (top < 10) top = 10;
    if (top + tooltipRect.height > viewportHeight - 10) top = viewportHeight - tooltipRect.height - 10;
    
    if (left < 10) left = 10;
    if (left + tooltipRect.width > viewportWidth - 10) left = viewportWidth - tooltipRect.width - 10;

    return { top: `${top}px`, left: `${left}px` };
  };

  const tooltipStyle = getTooltipPosition();

  // Modal View (Start/End steps)
  if (!position) {
    const isLastStep = currentStep === totalSteps;
    return (
      <>
        <div className="fixed inset-0 bg-black bg-opacity-70 z-[10000] animate-fade-in" />
        <div ref={tooltipRef} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-md p-8 z-[10002] animate-zoom-in text-center border border-transparent dark:border-zinc-700">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-3">
                {currentStep === 1 ? 'Welcome to ExamVault!' : (isLastStep ? "Happy Studying!" : "You're all set!")}
            </h3>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8">{content}</p>
             <div className="flex justify-center gap-4">
                 {currentStep === 1 && (
                     <button onClick={onSkip} className="px-6 py-3 text-slate-500 dark:text-slate-400 font-bold hover:text-slate-800 dark:hover:text-white transition">
                         Skip Tour
                     </button>
                 )}
                <button 
                    onClick={onNext} 
                    className="bg-primary-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-primary-700 transition flex items-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                    {currentStep === totalSteps ? "Finish" : 'Start Tour'} 
                    {currentStep !== totalSteps && <ArrowRight size={20} />}
                </button>
            </div>
        </div>
      </>
    );
  }

  // Tooltip View (Targeted steps)
  return (
    <>
      {/* Overlay highlight ring */}
      <div
        className="fixed rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] z-[10001] pointer-events-none transition-all duration-300 border-2 border-primary-400/50"
        style={{
          top: position.top - 4,
          left: position.left - 4,
          width: position.width + 8,
          height: position.height + 8,
        }}
      />
      
      {/* Tooltip Bubble */}
      <div
        ref={tooltipRef}
        className="fixed bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-80 p-5 z-[10002] transition-all duration-300 border border-slate-100 dark:border-zinc-700"
        style={tooltipStyle}
      >
        <p className="text-slate-700 dark:text-slate-200 mb-5 font-medium leading-relaxed">{content}</p>
        <div className="flex justify-between items-center pt-2 border-t border-slate-100 dark:border-zinc-700">
          <button onClick={onSkip} className="text-xs font-bold text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 uppercase tracking-wider">Skip</button>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-400 dark:text-slate-500">{currentStep} / {totalSteps}</span>
            <div className="flex gap-1">
                <button 
                    onClick={onPrev} 
                    className="p-2 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 transition text-slate-600 dark:text-slate-300"
                    aria-label="Previous step"
                >
                    <ArrowLeft size={16} />
                </button>
                <button 
                    onClick={onNext} 
                    className="p-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition shadow-sm"
                    aria-label="Next step"
                >
                    {currentStep === totalSteps ? <X size={16} /> : <ArrowRight size={16} />}
                </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default TooltipGuide;
