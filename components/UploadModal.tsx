
import React, { useState, useEffect, useContext } from 'react';
import type { Resource, ResourceRequest } from '../types';
import { ResourceType, ExamType, SemesterIntake } from '../types';
import { X, UploadCloud, Image as ImageIcon, Info, Loader2 } from 'lucide-react';
import { AppContext } from '../App';

// Re-implementing the high-fidelity SVG generator
export const generateFilePreview = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  let gradientStart, gradientEnd, shapePath;

  if (ext === 'pdf') {
    gradientStart = '#ef4444'; gradientEnd = '#b91c1c'; 
    shapePath = `
      <circle cx="200" cy="250" r="150" fill="white" fill-opacity="0.1"/>
      <rect x="140" y="160" width="120" height="150" rx="12" fill="white" fill-opacity="0.95"/>
      <rect x="165" y="190" width="70" height="8" rx="4" fill="${gradientEnd}" fill-opacity="0.8"/>
    `;
  } else if (['doc', 'docx'].includes(ext || '')) {
    gradientStart = '#3b82f6'; gradientEnd = '#1d4ed8'; 
    shapePath = `<rect x="140" y="160" width="120" height="150" rx="4" fill="white" fill-opacity="0.95"/>`;
  } else {
    gradientStart = '#6366f1'; gradientEnd = '#4338ca'; 
    shapePath = `<rect x="140" y="160" width="120" height="150" rx="12" fill="white" fill-opacity="0.9"/>`;
  }

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
      <defs><linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" /><stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" /></linearGradient></defs>
      <rect width="100%" height="100%" fill="url(#grad)" />${shapePath}</svg>`;
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

interface UploadModalProps {
  onClose: () => void;
  onUpload: (resource: any, file: File, coverImageFile: File | null) => void;
  fulfillingRequest?: ResourceRequest;
  isLoading: boolean;
}

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, fulfillingRequest, isLoading }) => {
  const [title, setTitle] = useState(fulfillingRequest?.title || '');
  const [courseCode, setCourseCode] = useState(fulfillingRequest?.courseCode || '');
  const [courseName, setCourseName] = useState('');
  const [type, setType] = useState<ResourceType>(ResourceType.PastPaper);
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState<SemesterIntake>(SemesterIntake.Feb);
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || isLoading) return;
    onUpload({ title, courseCode, courseName, type, year, semester, description }, file, coverImageFile);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
      <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col md:flex-row animate-in zoom-in-95 duration-300 border dark:border-zinc-700">
        <div className="hidden md:block w-72 bg-primary-600 p-8 text-white">
            <h2 className="text-3xl font-bold mb-4">Share Knowledge</h2>
            <p className="opacity-80 text-sm leading-relaxed">Contribute to the ExamVault community by uploading your notes, papers, or assignments. Help your fellow students succeed!</p>
            <div className="mt-12 space-y-6">
                <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">1</div>
                    <p className="text-xs">Fill in document details accurately for better searchability.</p>
                </div>
                <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center font-bold">2</div>
                    <p className="text-xs">Upload clear, readable files (PDFs preferred).</p>
                </div>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 relative">
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-700"><X /></button>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Title</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Course Code</label>
                        <input type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white" required />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Type</label>
                        <select value={type} onChange={e => setType(e.target.value as ResourceType)} className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white">
                            {Object.values(ResourceType).map(rt => <option key={rt} value={rt}>{rt}</option>)}
                        </select>
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Description</label>
                    <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-xl border border-slate-200 dark:border-zinc-700 outline-none focus:ring-2 focus:ring-primary-500 dark:text-white" rows={2} required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                     <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 p-4 rounded-2xl text-center">
                        <label className="cursor-pointer">
                            <UploadCloud className="mx-auto text-slate-400 mb-2" size={32} />
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{file ? file.name : 'Choose Resource'}</p>
                            <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} required={!file} />
                        </label>
                     </div>
                     <div className="border-2 border-dashed border-slate-200 dark:border-zinc-700 p-4 rounded-2xl text-center">
                        <label className="cursor-pointer">
                            <ImageIcon className="mx-auto text-slate-400 mb-2" size={32} />
                            <p className="text-[10px] font-bold text-slate-500 uppercase">{coverImageFile ? 'Cover Selected' : 'Custom Cover (Optional)'}</p>
                            <input type="file" className="hidden" accept="image/*" onChange={e => setCoverImageFile(e.target.files?.[0] || null)} />
                        </label>
                     </div>
                </div>

                <button type="submit" disabled={isLoading} className="w-full py-4 bg-primary-600 text-white rounded-2xl font-bold shadow-lg shadow-primary-500/30 hover:bg-primary-700 transition flex items-center justify-center gap-2">
                    {isLoading ? <><Loader2 className="animate-spin" /> Uploading...</> : 'Share Resource'}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;
