
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreateRequestModalProps {
  onClose: () => void;
  onSubmit: (requestData: { title: string; courseCode: string; details: string; }) => void;
}

const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [details, setDetails] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !courseCode || !details) {
        alert('Please fill out all fields.');
        return;
    }

    onSubmit({ title, courseCode, details });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-transparent dark:border-zinc-700">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Make a New Request</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <X size={24} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="req-title">Request Title</label>
              <input id="req-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g., Advanced Algorithms Final Exam 2023" className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="req-course-code">Course Code</label>
              <input id="req-course-code" type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="e.g., CS450" className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="req-details">Details</label>
              <textarea id="req-details" value={details} onChange={e => setDetails(e.target.value)} rows={4} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" placeholder="Provide more details about the resource you're looking for, such as the lecturer, year, or specific topics." required />
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">
              Cancel
            </button>
            <button type="submit" className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition">
              Submit Request
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRequestModal;
