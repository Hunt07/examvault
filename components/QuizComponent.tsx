
import React, { useState } from 'react';
import type { QuizQuestion } from '../types';
import { RefreshCw } from 'lucide-react';

const QuizComponent: React.FC<{ questions: QuizQuestion[], onReset: () => void }> = ({ questions, onReset }) => {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [showResults, setShowResults] = useState(false);

  const handleAnswerChange = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionIndex]: answer }));
  };

  const handleSubmit = () => {
    if (Object.keys(answers).length !== questions.length) {
      alert('Please answer all questions before submitting.');
      return;
    }
    setShowResults(true);
  };
  
  const score = questions.reduce((acc, question, index) => {
      return answers[index] === question.correctAnswer ? acc + 1 : acc;
  }, 0);

  if (showResults) {
    return (
      <div className="mt-4">
        <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-700 dark:text-slate-200">Quiz Results</h4>
            <button onClick={onReset} className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 flex items-center gap-1">
                <RefreshCw size={14} />
                Generate New Quiz
            </button>
        </div>
        <div className="bg-slate-100 dark:bg-zinc-800 p-6 rounded-lg text-center border border-slate-200 dark:border-zinc-700">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">You scored {score} out of {questions.length}!</h3>
        </div>
        <div className="space-y-4 mt-4">
            {questions.map((q, index) => {
                const userAnswer = answers[index];
                const isCorrect = userAnswer === q.correctAnswer;
                return (
                    <div key={index} className={`p-4 rounded-lg border ${
                        isCorrect 
                        ? 'border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-800' 
                        : 'border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-800'
                    }`}>
                        <p className="font-semibold text-slate-800 dark:text-slate-100">{index + 1}. {q.question}</p>
                        <p className="text-sm mt-2 dark:text-slate-300">
                            Your answer: <span className={`font-bold ${isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>{userAnswer}</span>
                        </p>
                        {!isCorrect && (
                            <p className="text-sm dark:text-slate-300 mt-1">
                                Correct answer: <span className="font-bold text-green-700 dark:text-green-400">{q.correctAnswer}</span>
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4">
       <div className="flex justify-between items-center mb-4">
            <h4 className="font-bold text-slate-700 dark:text-slate-200">Practice Quiz</h4>
            <button onClick={onReset} className="text-sm text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 flex items-center gap-1">
                <RefreshCw size={14} />
                Generate New Quiz
            </button>
       </div>
       <div className="space-y-6">
        {questions.map((q, index) => (
          <div key={index} className="bg-white dark:bg-zinc-800 p-4 rounded-lg border border-slate-200 dark:border-zinc-700">
            <p className="font-semibold text-slate-800 dark:text-slate-100">{index + 1}. {q.question}</p>
            <div className="mt-3 space-y-2">
              {q.options.map(option => (
                <label key={option} className="flex items-center p-2 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-700 cursor-pointer">
                  <input
                    type="radio"
                    name={`question-${index}`}
                    value={option}
                    checked={answers[index] === option}
                    onChange={() => handleAnswerChange(index, option)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-slate-300 dark:border-zinc-600"
                  />
                  <span className="ml-3 text-slate-700 dark:text-slate-300">{option}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 text-center">
        <button 
            onClick={handleSubmit} 
            className="bg-primary-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-primary-700 transition shadow-md"
        >
            Submit Quiz
        </button>
      </div>
    </div>
  );
};

export default QuizComponent;