
import React, { useState, useEffect, useContext } from 'react';
import type { Resource, ResourceRequest } from '../types';
import { ResourceType, ExamType, SemesterIntake } from '../types';
import { X, UploadCloud, Image as ImageIcon, Info } from 'lucide-react';
import { AppContext } from '../App';

interface UploadModalProps {
  onClose: () => void;
  onUpload: (resource: Omit<Resource, 'id' | 'author' | 'uploadDate' | 'upvotes' | 'downvotes' | 'upvotedBy' | 'downvotedBy' | 'comments' | 'fileUrl' | 'fileName' | 'previewImageUrl' | 'contentForAI' | 'fileBase64' | 'mimeType'>, file: File, coverImageFile: File | null) => void;
  fulfillingRequest?: ResourceRequest;
}

// Helper to generate SVG Data URI for previews (Abstract, Text-Free)
export const generateFilePreview = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  let gradientStart, gradientEnd;
  let shapePath;

  // Creative, Abstract, Text-Free configurations
  if (ext === 'pdf') {
    // Red abstract / Curves
    gradientStart = '#ef4444'; gradientEnd = '#b91c1c'; 
    shapePath = `
      <circle cx="200" cy="250" r="150" fill="white" fill-opacity="0.1"/>
      <path d="M50 400 C 150 350, 250 450, 350 400" stroke="white" stroke-width="20" stroke-opacity="0.2" fill="none"/>
      <path d="M50 440 C 150 390, 250 490, 350 440" stroke="white" stroke-width="10" stroke-opacity="0.1" fill="none"/>
      <rect x="140" y="160" width="120" height="150" rx="12" fill="white" fill-opacity="0.95"/>
      <rect x="165" y="190" width="70" height="8" rx="4" fill="${gradientEnd}" fill-opacity="0.8"/>
      <rect x="165" y="210" width="70" height="8" rx="4" fill="${gradientEnd}" fill-opacity="0.4"/>
      <rect x="165" y="230" width="40" height="8" rx="4" fill="${gradientEnd}" fill-opacity="0.4"/>
      <path d="M220 270 L 240 290 L 220 290 Z" fill="${gradientEnd}" fill-opacity="0.8"/>
    `;
  } else if (['doc', 'docx'].includes(ext || '')) {
    // Blue abstract / Geometric
    gradientStart = '#3b82f6'; gradientEnd = '#1d4ed8'; 
    shapePath = `
      <rect x="0" y="0" width="400" height="500" fill="url(#grad)"/>
      <path d="M0 0 L 400 500" stroke="white" stroke-width="300" stroke-opacity="0.05"/>
      <circle cx="300" cy="100" r="80" fill="white" fill-opacity="0.1"/>
      <rect x="140" y="160" width="120" height="150" rx="4" fill="white" fill-opacity="0.95"/>
      <rect x="160" y="185" width="80" height="6" rx="3" fill="${gradientEnd}" fill-opacity="0.8"/>
      <rect x="160" y="205" width="80" height="6" rx="3" fill="${gradientEnd}" fill-opacity="0.3"/>
      <rect x="160" y="225" width="80" height="6" rx="3" fill="${gradientEnd}" fill-opacity="0.3"/>
      <rect x="160" y="245" width="50" height="6" rx="3" fill="${gradientEnd}" fill-opacity="0.3"/>
    `;
  } else if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
    // Green abstract / Grid
    gradientStart = '#10b981'; gradientEnd = '#047857'; 
    shapePath = `
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" stroke-width="2" stroke-opacity="0.1"/>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
      <rect x="130" y="170" width="140" height="140" rx="8" fill="white" fill-opacity="0.95"/>
      <rect x="150" y="190" width="45" height="45" rx="4" fill="${gradientEnd}" fill-opacity="0.2"/>
      <rect x="205" y="190" width="45" height="45" rx="4" fill="${gradientEnd}" fill-opacity="0.6"/>
      <rect x="150" y="245" width="45" height="45" rx="4" fill="${gradientEnd}" fill-opacity="0.6"/>
      <rect x="205" y="245" width="45" height="45" rx="4" fill="${gradientEnd}" fill-opacity="0.2"/>
    `;
  } else if (['ppt', 'pptx'].includes(ext || '')) {
    // Orange abstract / Pie Chart
    gradientStart = '#f97316'; gradientEnd = '#c2410c'; 
    shapePath = `
       <circle cx="200" cy="250" r="180" fill="white" fill-opacity="0.05"/>
       <path d="M200 240 L 200 180 A 60 60 0 0 1 252 270 Z" fill="white" fill-opacity="0.9"/>
       <path d="M190 250 L 242 280 A 60 60 0 0 1 150 295 Z" fill="white" fill-opacity="0.5"/>
       <circle cx="200" cy="250" r="10" fill="white" fill-opacity="0.8"/>
    `;
  } else {
    // Generic Indigo / File
    gradientStart = '#6366f1'; gradientEnd = '#4338ca'; 
    shapePath = `
      <circle cx="50" cy="50" r="100" fill="white" fill-opacity="0.1"/>
      <circle cx="350" cy="450" r="100" fill="white" fill-opacity="0.1"/>
      <rect x="140" y="160" width="120" height="150" rx="12" fill="white" fill-opacity="0.9"/>
      <circle cx="200" cy="220" r="30" stroke="${gradientEnd}" stroke-width="6" fill="none" opacity="0.8"/>
      <rect x="170" y="270" width="60" height="6" rx="3" fill="${gradientEnd}" opacity="0.5"/>
    `;
  }

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 400 500">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${gradientStart};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${gradientEnd};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#grad)" />
      ${shapePath}
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, fulfillingRequest }) => {
  const { showToast } = useContext(AppContext);
  const [title, setTitle] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [courseName, setCourseName] = useState('');
  const [type, setType] = useState<ResourceType>(ResourceType.PastPaper);
  const [year, setYear] = useState(new Date().getFullYear());
  const [semester, setSemester] = useState<SemesterIntake>(SemesterIntake.Feb);
  const [examType, setExamType] = useState<ExamType | undefined>(ExamType.Final);
  const [lecturer, setLecturer] = useState('');
  const [description, setDescription] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);

  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [coverImagePreviewUrl, setCoverImagePreviewUrl] = useState<string | null>(null);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  
  useEffect(() => {
    if (fulfillingRequest) {
        setCourseCode(fulfillingRequest.courseCode);
        setTitle(fulfillingRequest.title);
    }
  }, [fulfillingRequest]);

  const processFile = (selectedFile: File) => {
    if (selectedFile) {
      setFile(selectedFile);
      
      // If user hasn't explicitly set a cover image yet, generate one
      if (!coverImageFile) {
          if (selectedFile.type.startsWith('image/')) {
             const url = URL.createObjectURL(selectedFile);
             setFilePreviewUrl(url);
          } else {
             // Generate creative SVG preview
             const svgUrl = generateFilePreview(selectedFile.name);
             setFilePreviewUrl(svgUrl);
          }
      }
    }
  };
  
  const processCoverImageFile = (selectedFile: File) => {
    if (selectedFile) {
        if (selectedFile.type.startsWith('image/')) {
            setCoverImageFile(selectedFile);
            setCoverImagePreviewUrl(URL.createObjectURL(selectedFile));
        } else {
            showToast('Cover image must be an image file (e.g., PNG, JPG).', 'error');
        }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };
  
  const handleCoverImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
        processCoverImageFile(selectedFile);
    }
  };
  
  const handleFileDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };
  
  const handleFileDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };
  
  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      processFile(droppedFiles[0]);
    }
  };
  
  const handleCoverDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCover(true);
  };
  
  const handleCoverDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCover(false);
  };
  
  const handleCoverDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingCover(false);
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      processCoverImageFile(droppedFiles[0]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      showToast('Please select a file to upload.', 'error');
      return;
    }
    
    // Enable examType/lecturer for PastPaper, Assignment, and Other
    const supportsExamType = [ResourceType.PastPaper, ResourceType.Assignment, ResourceType.Other].includes(type);

    const newResource = {
      title,
      courseCode,
      courseName,
      type,
      year,
      semester,
      examType: supportsExamType ? examType : undefined,
      lecturer: supportsExamType ? lecturer : undefined,
      description,
    };
    onUpload(newResource, file, coverImageFile);
    onClose();
  };

  const displayPreviewUrl = coverImagePreviewUrl || filePreviewUrl;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200 border border-transparent dark:border-zinc-700">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Upload a New Resource</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <X size={24} className="text-slate-600 dark:text-slate-400" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6">
          {fulfillingRequest && (
            <div className="bg-primary-50 dark:bg-primary-900/20 border-l-4 border-primary-500 text-primary-800 dark:text-primary-200 p-4 rounded-r-lg mb-6 flex gap-4">
              <Info size={24} className="text-primary-600 dark:text-primary-400 shrink-0 mt-1"/>
              <div>
                <h4 className="font-bold">You're fulfilling a request!</h4>
                <p className="text-sm">Thank you for helping {fulfillingRequest.requester.name}. You'll receive <strong>50 points</strong> for this contribution.</p>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Resource Type</label>
              <select value={type} onChange={e => setType(e.target.value as ResourceType)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition">
                {Object.values(ResourceType).map((rt) => (
                  <option key={rt} value={rt}>{rt}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Title</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Course Code</label>
              <input type="text" value={courseCode} onChange={e => setCourseCode(e.target.value)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Course Name</label>
              <input type="text" value={courseName} onChange={e => setCourseName(e.target.value)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
             <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" placeholder="Provide a brief description of the resource..." required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Year</label>
              <input type="number" value={year} onChange={e => setYear(parseInt(e.target.value, 10))} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Semester</label>
              <select value={semester} onChange={e => setSemester(e.target.value as SemesterIntake)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition">
                  {Object.values(SemesterIntake).map(si => <option key={si} value={si}>{si}</option>)}
              </select>
            </div>
            
            {/* Show Exam Type and Lecturer for Past Paper, Assignment, and Other */}
            {(type === ResourceType.PastPaper || type === ResourceType.Assignment || type === ResourceType.Other) && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">
                    {type === ResourceType.PastPaper ? 'Exam Type' : 'Assessment Type'}
                  </label>
                  <select value={examType} onChange={e => setExamType(e.target.value as ExamType)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition">
                    {Object.values(ExamType).map(et => <option key={et} value={et}>{et}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Lecturer (Optional)</label>
                  <input type="text" value={lecturer} onChange={e => setLecturer(e.target.value)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-600 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition" />
                </div>
              </>
            )}

            <div className="col-span-2 mt-4">
              <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">File Upload</label>
              <div
                onDragOver={handleFileDragOver}
                onDragLeave={handleFileDragLeave}
                onDrop={handleFileDrop}
                className={`mt-2 flex justify-center rounded-lg border border-dashed px-6 py-10 transition-colors ${isDraggingFile ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-300 dark:border-zinc-600'}`}
              >
                {!file ? (
                  <div className="text-center">
                    <UploadCloud className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
                    <div className="mt-4 flex text-sm leading-6 text-slate-600 dark:text-slate-300">
                      <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-semibold text-primary-600 dark:text-primary-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-600 focus-within:ring-offset-2 hover:text-primary-500">
                        <span>Upload a file</span>
                        <input id="file-upload" name="file-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.rar" />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">PDF, DOCX, PPT, Images up to 10MB</p>
                  </div>
                ) : (
                  <div className="text-center w-full">
                    {displayPreviewUrl ? (
                        <div className="relative mx-auto w-32 h-40 mb-4 shadow-md rounded-md overflow-hidden group">
                            <img src={displayPreviewUrl} alt="File preview" className="w-full h-full object-cover" />
                            {!coverImageFile && !file.type.startsWith('image/') && (
                                <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] py-1">Generated Preview</div>
                            )}
                        </div>
                    ) : null}
                    
                    <p className="font-semibold text-slate-700 dark:text-white">{file.name}</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <button type="button" onClick={() => { setFile(null); setFilePreviewUrl(null); setCoverImageFile(null); setCoverImagePreviewUrl(null); }} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-semibold">
                      Remove file
                    </button>
                  </div>
                )}
              </div>
            </div>

            {file && (
                <div className="col-span-2 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-sm font-medium text-slate-600 dark:text-slate-300 mb-2">Cover Image (Optional)</label>
                    <div
                      onDragOver={handleCoverDragOver}
                      onDragLeave={handleCoverDragLeave}
                      onDrop={handleCoverDrop}
                      className={`mt-2 flex justify-center rounded-lg border border-dashed px-6 py-10 transition-colors ${isDraggingCover ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-300 dark:border-zinc-600'}`}
                    >
                        {!coverImageFile ? (
                            <div className="text-center">
                                <ImageIcon className="mx-auto h-12 w-12 text-slate-400" aria-hidden="true" />
                                <div className="mt-4 flex text-sm leading-6 text-slate-600 dark:text-slate-300">
                                <label htmlFor="cover-image-upload" className="relative cursor-pointer rounded-md font-semibold text-primary-600 dark:text-primary-400 focus-within:outline-none focus-within:ring-2 focus-within:ring-primary-600 focus-within:ring-offset-2 hover:text-primary-500">
                                    <span>Upload custom cover</span>
                                    <input id="cover-image-upload" name="cover-image-upload" type="file" className="sr-only" onChange={handleCoverImageChange} accept="image/*" />
                                </label>
                                </div>
                                <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">PNG, JPG up to 5MB</p>
                            </div>
                        ) : (
                            <div className="text-center">
                                {coverImagePreviewUrl && <img src={coverImagePreviewUrl} alt="Cover preview" className="mx-auto h-32 mb-4 rounded-md object-contain" />}
                                <p className="font-semibold text-slate-700 dark:text-white">{coverImageFile.name}</p>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{(coverImageFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button type="button" onClick={() => { setCoverImageFile(null); setCoverImagePreviewUrl(null); }} className="mt-2 text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-semibold">
                                    Remove cover image
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
          </div>
          <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-bold py-2 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">
              Cancel
            </button>
            <button type="submit" className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition">
              Upload
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UploadModal;
