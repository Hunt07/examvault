import React, { useState } from 'react';
import { Flashcard } from '../types';
import { ArrowLeft, ArrowRight, RefreshCw } from 'lucide-react';

const FlashcardViewer: React.FC<{ flashcards: Flashcard[], onReset: () => void }> = ({ flashcards, onReset }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const handleNext = () => {
    if (currentIndex < flashcards.length - 1) {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex((prev) => prev + 1), 150);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
        setIsFlipped(false);
        setTimeout(() => setCurrentIndex((prev) => prev - 1), 150);
    }
  };

  const currentCard = flashcards[currentIndex];

  return (
    <div className="mt-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-bold text-slate-700">Interactive Flashcards</h4>
        <button onClick={onReset} className="text-sm text-primary-600 font-semibold hover:text-primary-800 flex items-center gap-1">
            <RefreshCw size={14} />
            Generate New Set
        </button>
      </div>
      <div className="relative">
        <div 
            className="w-full h-64 cursor-pointer"
            onClick={() => setIsFlipped(!isFlipped)}
            style={{ perspective: '1000px' }}
        >
          <div 
            className={`relative w-full h-full text-center transition-transform duration-500`}
            style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
          >
            <div className="absolute w-full h-full flex items-center justify-center p-6 bg-white border border-slate-200 rounded-lg shadow-md" style={{ backfaceVisibility: 'hidden' }}>
              <p className="text-xl font-semibold text-slate-800">{currentCard.term}</p>
            </div>
            <div className="absolute w-full h-full flex items-center justify-center p-6 bg-primary-600 text-white border rounded-lg shadow-md" style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
              <p className="text-lg">{currentCard.definition}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-4">
        <button onClick={handlePrev} disabled={currentIndex === 0} className="bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            <ArrowLeft size={16} /> Prev
        </button>
        <p className="text-sm font-medium text-slate-600">{currentIndex + 1} / {flashcards.length}</p>
        <button onClick={handleNext} disabled={currentIndex === flashcards.length - 1} className="bg-slate-200 text-slate-700 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
            Next <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default FlashcardViewer;
