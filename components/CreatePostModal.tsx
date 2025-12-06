
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface CreatePostModalProps {
  onClose: () => void;
  onSubmit: (postData: { title: string; courseCode: string; body: string; tags: string[] }) => void;
}

const CreatePostModal: React.FC<CreatePostModalProps> = ({ onClose, onSubmit }) => {
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [body, setBody] = useState('');
  const [tagsString, setTagsString] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const tags = tagsString.split(',').map(tag => tag.trim()).filter(tag => tag);
    
    if (!title || !courseCode || !body) {
        alert('Please fill out all required fields.');
        return;
    }

    onSubmit({ title, courseCode, body, tags });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-transparent dark:border-zinc-700">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Create a New Post</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <X size={24} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="post-title">Title</label>
              <input id="post-title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
             <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="post-course-code">Course Code</label>
              <input id="post-course-code" type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} placeholder="e.g., CS450" className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="post-body">Body</label>
              <textarea id="post-body" value={body} onChange={e => setBody(e.target.value)} rows={6} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" placeholder="Share your thoughts or ask a question..." required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2" htmlFor="post-tags">Tags</label>
              <input id="post-tags" type="text" value={tagsString} onChange={e => setTagsString(e.target.value)} placeholder="e.g., query, algorithms, studying" className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Separate tags with a comma.</p>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">
              Cancel
            </button>
            <button type="submit" className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition">
              Post
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePostModal;
