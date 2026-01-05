
import React, { useState, useRef } from 'react';
import { X, Paperclip, ImageIcon, FileText, Loader2 } from 'lucide-react';

interface CreateRequestModalProps {
  onClose: () => void;
  onSubmit: (requestData: { title: string; courseCode: string; details: string; }, file?: File) => void;
}

const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [details, setDetails] = useState('');
  const [file, setFile] = useState<File | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !courseCode || !details) {
        alert('Please fill out all fields.');
        return;
    }

    setIsSubmitting(true);
    // Simulate slight delay for UX
    await new Promise(resolve => setTimeout(resolve, 500));
    onSubmit({ title, courseCode, details }, file);
    setIsSubmitting(false);
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
          setFile(selectedFile);
      }
  };

  const removeFile = () => {
      setFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-zoom-in border border-transparent dark:border-zinc-700">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Make a New Request</h2>
          <button onClick={onClose} disabled={isSubmitting} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition disabled:opacity-50">
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

            {/* File Attachment Section */}
            <div>
                <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Attachment (Optional)</label>
                {!file ? (
                    <button 
                        type="button" 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition w-full justify-center"
                    >
                        <Paperclip size={18} />
                        <span>Attach a file</span>
                    </button>
                ) : (
                    <div className="flex items-center justify-between px-4 py-2 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="bg-primary-100 dark:bg-primary-800 p-1.5 rounded text-primary-600 dark:text-primary-300 shrink-0">
                                {file.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{file.name}</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
                            </div>
                        </div>
                        <button type="button" onClick={removeFile} className="p-1 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-full text-slate-500 hover:text-red-500 transition ml-2">
                            <X size={18} />
                        </button>
                    </div>
                )}
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    onChange={handleFileChange}
                />
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-4">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition disabled:opacity-50">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Submitting...</> : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateRequestModal;
