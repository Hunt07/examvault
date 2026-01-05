
import React, { useContext, useState } from 'react';
import type { ResourceRequest, Attachment } from '../types';
import { ResourceRequestStatus } from '../types';
import { AppContext } from '../App';
import UserRankBadge from './UserRankBadge';
import { CheckCircle, Clock, Trash2, Paperclip, Download, Eye, X, FileText, Bookmark, BookmarkCheck } from 'lucide-react';

interface ResourceRequestCardProps {
  request: ResourceRequest;
}

const ResourceRequestCard: React.FC<ResourceRequestCardProps> = ({ request }) => {
    const { user, userRanks, setView, openUploadForRequest, deleteResourceRequest, savedRequestIds, toggleSaveRequest } = useContext(AppContext);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

    const requesterRank = userRanks.get(request.requester.id);
    const isOwnRequest = user?.id === request.requester.id;
    const canDelete = isOwnRequest || user?.role === 'admin'; // Allow Admin to delete
    const isSaved = savedRequestIds.includes(request.id);

    const handleUserClick = (userId: string) => {
        if (userId === user?.id) {
            setView('profile');
        } else {
            setView('publicProfile', userId);
        }
    };

    const handleDelete = () => {
        deleteResourceRequest(request.id);
    };

    const renderPreviewContent = (attachment: Attachment) => {
        const ext = attachment.name.split('.').pop()?.toLowerCase();
        const isPdf = ext === 'pdf';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
        const isOfficeDoc = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext || '');

        if (isImage) return <img src={attachment.url} alt="Preview" className="max-w-full max-h-full object-contain" />;
        if (isPdf) return <iframe src={attachment.url} className="w-full h-full border-none" title="PDF Preview"></iframe>;
        if (isOfficeDoc) return (<iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(attachment.url)}&embedded=true`} className="w-full h-full border-none" title="Office Document Preview" />);
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <FileText size={48} className="mb-4 text-slate-400" />
                <p>Preview not available for this file type.</p>
                <a href={attachment.url} download={attachment.name} className="mt-4 text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-2">
                    <Download size={16} /> Download File
                </a>
            </div>
        );
    };
    
    return (
        <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700 relative group">
            
            <button 
                onClick={(e) => {
                    e.stopPropagation();
                    toggleSaveRequest(request.id);
                }}
                className={`absolute top-4 right-4 p-2 rounded-full transition z-10 ${
                    isSaved 
                        ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400' 
                        : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-700 hover:text-slate-600 dark:hover:text-slate-200'
                } ${canDelete ? 'mr-10' : ''}`}
                title={isSaved ? "Unsave Request" : "Save Request"}
            >
                {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
            </button>

            {canDelete && (
                <div className="absolute top-4 right-4 sm:static sm:mt-0 sm:ml-auto">
                     <button 
                        onClick={() => setIsDeleteConfirmOpen(true)}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition"
                        title="Delete Request"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mt-2 sm:mt-0">
                <div className="flex-grow min-w-0 w-full pr-12">
                    <div className="flex items-center gap-2 mb-2">
                         <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{request.courseCode}</span>
                    </div>
                    <h3 title={request.title} className="text-xl font-bold text-slate-800 dark:text-white truncate">{request.title}</h3>
                </div>
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        handleUserClick(request.requester.id);
                    }}
                    className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 shrink-0 self-end sm:self-auto rounded-md p-2 -mr-2 hover:bg-slate-100 dark:hover:bg-zinc-700"
                    aria-label={`View profile for ${request.requester.name}`}
                >
                    <img src={request.requester.avatarUrl} alt={request.requester.name} className="w-10 h-10 rounded-full" />
                    <div className="text-left">
                        <div className="flex items-center">
                            <p className="font-semibold text-slate-700 dark:text-white">{request.requester.name}</p>
                            <UserRankBadge rank={requesterRank} size={16} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-300">
                            {new Date(request.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </button>
            </div>

            <p title={request.details} className="text-slate-600 dark:text-slate-200 mt-2">{request.details}</p>
            
            {/* Attachment Section */}
            {request.attachment && (
                <div className="mt-3 flex items-center gap-2">
                    <button 
                        onClick={() => setPreviewAttachment(request.attachment!)}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition border border-slate-200 dark:border-zinc-700 group max-w-full"
                    >
                        <Paperclip size={14} className="text-slate-500 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
                        <span className="font-medium truncate max-w-[200px]">{request.attachment.name}</span>
                        <Eye size={14} className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 group-hover:text-primary-600" />
                    </button>
                    <a 
                        href={request.attachment.url} 
                        download={request.attachment.name}
                        className="p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                        title="Download"
                    >
                        <Download size={16} />
                    </a>
                </div>
            )}
            
            {isDeleteConfirmOpen && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-sm font-semibold text-red-700 dark:text-red-300">Are you sure you want to delete this request?</p>
                    <div className="flex gap-2">
                        <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition">Cancel</button>
                        <button onClick={handleDelete} className="px-3 py-1.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition">Delete</button>
                    </div>
                </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700">
                {request.status === ResourceRequestStatus.Open && !isDeleteConfirmOpen && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
                            <Clock size={16} />
                            <span>Request is open</span>
                        </div>
                        {user?.id !== request.requester.id && (
                             <button
                                onClick={() => openUploadForRequest(request.id)}
                                className="w-full sm:w-auto bg-primary-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-700 transition"
                            >
                                Fulfill Request
                            </button>
                        )}
                    </div>
                )}
                {request.status === ResourceRequestStatus.Fulfilled && request.fulfillment && (
                    <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg border border-green-200 dark:border-green-900">
                        <div className="flex items-center gap-2 text-sm font-semibold text-green-700 dark:text-green-300">
                            <CheckCircle size={16} />
                            <span>Fulfilled by 
                                <button 
                                    onClick={() => handleUserClick(request.fulfillment!.fulfiller.id)} 
                                    className="font-bold hover:underline ml-1"
                                >
                                    {request.fulfillment.fulfiller.name}
                                </button>
                            </span>
                        </div>
                        <button 
                            onClick={() => setView('resourceDetail', request.fulfillment!.resourceId)}
                            className="w-full sm:w-auto bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition"
                        >
                            View Resource
                        </button>
                    </div>
                )}
            </div>

            {previewAttachment && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-default" onClick={(e) => e.stopPropagation()}>
                    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative animate-in zoom-in-95 duration-200 border border-transparent dark:border-zinc-700">
                        <div className="p-4 border-b dark:border-zinc-700 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50 rounded-t-xl">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="p-2 rounded-lg bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                                    <FileText size={20} />
                                </div>
                                <div className="overflow-hidden">
                                    <h3 className="font-bold text-slate-800 dark:text-white truncate text-lg leading-tight">{previewAttachment.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{previewAttachment.size || 'File'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <a 
                                    href={previewAttachment.url} 
                                    download={previewAttachment.name}
                                    className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-600 dark:text-slate-300 transition"
                                    title="Download"
                                >
                                    <Download size={20} />
                                </a>
                                <button onClick={() => setPreviewAttachment(null)} className="p-2 rounded-full hover:bg-red-100 dark:hover:bg-red-900/20 text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition">
                                    <X size={24} />
                                </button>
                            </div>
                        </div>
                        <div className="flex-grow bg-slate-200 dark:bg-zinc-900 overflow-hidden flex items-center justify-center rounded-b-xl relative">
                            {renderPreviewContent(previewAttachment)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceRequestCard;
