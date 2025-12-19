
import React, { useState, useContext, useRef, useMemo } from 'react';
import { type Resource, type Comment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent } from '../../services/geminiService';
import { ArrowLeft, ThumbsUp, ThumbsDown, Download, BrainCircuit, Loader2, FileText, Eye, X, Trash2, Bookmark, BookmarkCheck, Calendar, User as UserIcon, MessageSquare, ExternalLink } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import UserRankBadge from '../UserRankBadge';
import Avatar from '../Avatar';

const CommentComponent: React.FC<{
  comment: Comment;
  resourceId: string;
  children: React.ReactNode;
}> = ({ comment, resourceId, children }) => {
  const { user, userRanks, setView, handleCommentVote, addCommentToResource, deleteCommentFromResource } = useContext(AppContext);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const authorRank = userRanks.get(comment.author.id);
  const isUpvoted = comment.upvotedBy?.includes(user?.id || '');
  const isOwnComment = user?.id === comment.author.id;
  const isAdmin = user?.isAdmin;

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyText.trim() && user) {
      addCommentToResource(resourceId, replyText, comment.id);
      setReplyText('');
      setIsReplying(false);
    }
  };

  return (
    <div id={comment.id} className="mt-4 bg-white dark:bg-zinc-800/40 p-4 rounded-xl border border-slate-100 dark:border-zinc-700/50 shadow-sm transition-all">
      <div className="flex gap-4 items-start">
        <button onClick={() => setView('publicProfile', comment.author.id)} className="shrink-0">
          <Avatar src={comment.author.avatarUrl} alt={comment.author.name} className="w-10 h-10 border border-slate-200 dark:border-zinc-600" />
        </button>
        <div className="flex-grow">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                 <button onClick={() => setView('publicProfile', comment.author.id)} className="font-bold text-slate-900 dark:text-white hover:underline text-sm">{comment.author.name}</button>
                 <UserRankBadge rank={authorRank} size={14} />
                 <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-700 px-1.5 py-0.5 rounded">
                    {comment.author.course}
                 </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                {new Date(comment.timestamp).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="mt-2 text-slate-700 dark:text-zinc-200 text-sm leading-relaxed">
            <MarkdownRenderer content={comment.text} />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => handleCommentVote(resourceId, comment.id)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-xs font-bold ${isUpvoted ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-700'}`}
            >
              <ThumbsUp size={14} /> {comment.upvotes || 0}
            </button>
            <button
              onClick={() => setIsReplying(!isReplying)}
              className="text-xs font-bold text-slate-500 hover:text-primary-600 dark:text-zinc-400"
            >
              Reply
            </button>
            {(isOwnComment || isAdmin) && (
               <button
                  onClick={() => setIsDeleteConfirmOpen(true)}
                  className={`ml-auto text-xs font-bold ${isAdmin && !isOwnComment ? 'text-red-600 uppercase flex items-center gap-1' : 'text-slate-400 hover:text-red-500'}`}
               >
                  {isAdmin && !isOwnComment ? <><Trash2 size={12}/> Admin Delete</> : <Trash2 size={14} />}
               </button>
            )}
          </div>
        </div>
      </div>

      {isReplying && (
        <form onSubmit={handleReplySubmit} className="mt-4 ml-14">
          <textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            className="w-full bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-200 dark:border-zinc-700 focus:ring-2 focus:ring-primary-500 outline-none text-sm dark:text-white"
            placeholder="Write a reply..."
            rows={2}
            autoFocus
          />
          <div className="flex gap-2 mt-2">
            <button type="submit" className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">Post Reply</button>
            <button type="button" onClick={() => setIsReplying(false)} className="text-slate-500 dark:text-zinc-400 text-xs font-bold">Cancel</button>
          </div>
        </form>
      )}

      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl max-w-sm w-full shadow-2xl">
                  <h3 className="font-bold text-lg mb-2 dark:text-white">Delete Comment?</h3>
                  <p className="text-slate-500 text-sm mb-6">Are you sure? This cannot be undone.</p>
                  <div className="flex gap-3">
                      <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 rounded-lg font-bold dark:text-white">Cancel</button>
                      <button onClick={() => { deleteCommentFromResource(resourceId, comment); setIsDeleteConfirmOpen(false); }} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">Delete</button>
                  </div>
              </div>
          </div>
      )}

      <div className="pl-6 border-l-2 border-slate-100 dark:border-zinc-700/50 mt-2">
        {children}
      </div>
    </div>
  );
};

const ResourceDetailPage: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { user, userRanks, setView, handleVote, addCommentToResource, toggleSaveResource, deleteResource, savedResourceIds } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const authorRank = userRanks.get(resource.author.id);
  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const isAdmin = user?.isAdmin;
  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    const result = await summarizeContent({ 
        content: `Title: ${resource.title}\nCourse: ${resource.courseCode}\nDescription: ${resource.description}`,
        fileBase64: resource.fileBase64,
        mimeType: resource.mimeType,
        extractedText: resource.extractedText
    });
    setSummary(result);
    setIsSummarizing(false);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && user) {
      addCommentToResource(resource.id, newComment, null);
      setNewComment('');
    }
  };

  const groupedComments = useMemo(() => {
      const g: Record<string, Comment[]> = { root: [] };
      (resource.comments || []).forEach(c => {
          const pid = c.parentId || 'root';
          if (!g[pid]) g[pid] = [];
          g[pid].push(c);
      });
      return g;
  }, [resource.comments]);

  const renderComments = (pid: string = 'root') => {
      return (groupedComments[pid] || []).map(c => (
          <CommentComponent key={c.id} comment={c} resourceId={resource.id}>
              {renderComments(c.id)}
          </CommentComponent>
      ));
  };

  return (
    <div className="max-w-6xl mx-auto px-4 pb-12 animate-in fade-in slide-in-from-bottom-2">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold mb-6 hover:translate-x-[-4px] transition-transform">
        <ArrowLeft size={18} /> Back to Vault
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Hero Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-xl overflow-hidden border dark:border-zinc-700">
            <div className="relative h-72 md:h-96 bg-slate-200 dark:bg-zinc-900">
               <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-full object-cover" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent flex items-end p-8">
                  <div className="w-full">
                    <div className="flex items-center gap-3 mb-4">
                        <span className="bg-primary-600 text-white px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest">{resource.type}</span>
                        <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-3 py-1 rounded-full text-xs font-bold">{resource.courseCode}</span>
                    </div>
                    <h1 className="text-3xl md:text-5xl font-extrabold text-white mb-3 tracking-tight">{resource.title}</h1>
                    <p className="text-slate-300 text-lg font-medium line-clamp-1">{resource.courseName}</p>
                  </div>
               </div>
            </div>
            
            <div className="p-8">
                <div className="flex flex-wrap gap-8 mb-8 border-b dark:border-zinc-700 pb-6">
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-400 font-semibold"><Calendar size={20} className="text-primary-500"/> <span>{resource.year} • {resource.semester}</span></div>
                    {resource.lecturer && <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-400 font-semibold"><UserIcon size={20} className="text-primary-500"/> <span>{resource.lecturer}</span></div>}
                    <div className="flex items-center gap-2.5 text-slate-600 dark:text-zinc-400 font-semibold"><FileText size={20} className="text-primary-500"/> <span>{resource.fileName}</span></div>
                </div>
                
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">About this resource</h3>
                <p className="text-slate-600 dark:text-zinc-300 mb-10 leading-relaxed text-lg">{resource.description}</p>
                
                <div className="flex flex-col sm:flex-row gap-4">
                    <button onClick={() => setIsPreviewOpen(true)} className="flex-1 py-4 px-6 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-2xl font-bold dark:text-white transition-all flex items-center justify-center gap-3 text-lg">
                        <Eye size={22} /> Preview File
                    </button>
                    <a href={resource.fileUrl} download={resource.fileName} className="flex-1 py-4 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/30 transition-all flex items-center justify-center gap-3 text-lg">
                        <Download size={22} /> Download Now
                    </a>
                </div>
            </div>
          </div>

          {/* Gemini AI Assistant */}
          <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-lg p-8 border dark:border-zinc-700 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <BrainCircuit size={120} />
            </div>
            <div className="flex items-center justify-between mb-8 relative z-10">
                <div>
                    <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                        <BrainCircuit className="text-primary-600" size={28} /> AI Study Assistant
                    </h3>
                    <p className="text-slate-500 dark:text-zinc-400 mt-1">Instant analysis powered by Gemini 3 Flash</p>
                </div>
                {!summary && <button onClick={handleGenerateSummary} disabled={isSummarizing} className="bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-5 py-2 rounded-xl font-bold text-sm hover:bg-primary-100 transition-colors disabled:opacity-50">Generate Summary</button>}
            </div>
            
            <div className="relative z-10">
            {isSummarizing ? (
                <div className="py-16 text-center flex flex-col items-center gap-6 bg-slate-50 dark:bg-zinc-900/50 rounded-2xl">
                    <Loader2 className="animate-spin text-primary-600" size={48} />
                    <div className="space-y-2">
                        <p className="text-xl font-bold text-slate-700 dark:text-white">Analyzing Content...</p>
                        <p className="text-slate-500 dark:text-zinc-400 max-w-sm">Gemini is processing the document to extract key concepts and potential exam questions.</p>
                    </div>
                </div>
            ) : summary ? (
                <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-2xl p-8 border dark:border-zinc-700/50 shadow-inner">
                    <MarkdownRenderer content={summary} />
                </div>
            ) : (
                <div className="text-center py-12 bg-slate-50 dark:bg-zinc-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
                    <BrainCircuit className="mx-auto text-slate-300 dark:text-zinc-600 mb-4" size={56} />
                    <h4 className="text-lg font-bold text-slate-700 dark:text-zinc-300 mb-2">Save hours of reading</h4>
                    <p className="text-slate-500 dark:text-zinc-400 mb-8 max-w-sm mx-auto text-sm">Click the button below to get an intelligent summary and sample exam questions for this material.</p>
                    <button onClick={handleGenerateSummary} className="bg-primary-600 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary-500/20 hover:scale-105 transition-transform">Summarize with AI</button>
                </div>
            )}
            </div>
          </div>

          {/* Comments Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-lg p-8 border dark:border-zinc-700">
            <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-8 flex items-center gap-3">
                <MessageSquare className="text-slate-400" size={24} /> Discussion
            </h3>
            <form onSubmit={handlePostComment} className="flex gap-4 mb-10">
                <Avatar src={user?.avatarUrl} alt={user?.name || "User"} className="w-12 h-12 ring-2 ring-primary-500/20" />
                <div className="flex-grow">
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 p-5 rounded-2xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white transition-all min-h-[120px] text-lg" placeholder="Join the discussion..." />
                    <div className="flex justify-end mt-4">
                        <button type="submit" className="bg-primary-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-primary-500/20 hover:bg-primary-700 transition-all">Post Comment</button>
                    </div>
                </div>
            </form>
            <div className="space-y-6">
                {renderComments()}
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-8">
          <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-xl p-8 border dark:border-zinc-700 sticky top-24">
             <div className="flex gap-4 mb-8">
                <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all ${isUpvoted ? 'bg-green-600 text-white shadow-lg shadow-green-500/20' : 'bg-slate-50 dark:bg-zinc-700/50 text-slate-600 dark:text-zinc-300 hover:bg-slate-100'}`}>
                    <ThumbsUp size={24} /> 
                    <span className="text-sm">{resource.upvotes}</span>
                </button>
                <button onClick={() => handleVote(resource.id, 'down')} className={`flex-1 flex flex-col items-center justify-center gap-2 py-4 rounded-2xl font-bold transition-all ${isDownvoted ? 'bg-red-600 text-white shadow-lg shadow-red-500/20' : 'bg-slate-50 dark:bg-zinc-700/50 text-slate-600 dark:text-zinc-300 hover:bg-slate-100'}`}>
                    <ThumbsDown size={24} />
                    <span className="text-sm">{resource.downvotes}</span>
                </button>
             </div>
             
             <button onClick={() => toggleSaveResource(resource.id)} className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-3 mb-4 transition-all border-2 ${isSaved ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/50 text-amber-700 dark:text-amber-400' : 'bg-white dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-white hover:bg-slate-50'}`}>
                {isSaved ? <BookmarkCheck size={20}/> : <Bookmark size={20}/>} {isSaved ? 'Bookmarked' : 'Save for later'}
             </button>

             {(isAuthor || isAdmin) && (
                <button onClick={() => setIsDeleteConfirmOpen(true)} className="w-full py-4 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all border border-red-100 dark:border-red-900/30">
                    <Trash2 size={20} /> {isAdmin && !isAuthor ? 'Admin Delete' : 'Delete Resource'}
                </button>
             )}

             <div className="mt-10 pt-10 border-t dark:border-zinc-700">
                <p className="text-[10px] uppercase font-black text-slate-400 mb-6 tracking-[0.2em]">Shared By</p>
                <div className="flex items-center gap-5 group cursor-pointer" onClick={() => setView('publicProfile', resource.author.id)}>
                    <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-16 h-16 ring-4 ring-slate-100 dark:ring-zinc-700" />
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-white group-hover:text-primary-600 transition-colors text-lg leading-tight">{resource.author.name}</p>
                            <UserRankBadge rank={authorRank} size={20} />
                        </div>
                        <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">{resource.author.course}</p>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[80] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl max-w-md w-full shadow-2xl border border-red-100 dark:border-red-900/30 animate-in zoom-in-95 duration-200">
                  <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-6 mx-auto"><Trash2 size={40} /></div>
                  <h3 className="text-3xl font-bold text-center mb-2 dark:text-white">Delete resource?</h3>
                  <p className="text-slate-500 text-center mb-10 text-lg">This action is irreversible. All comments and downloads will be lost forever.</p>
                  <div className="flex gap-4">
                      <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-4 bg-slate-100 dark:bg-zinc-800 rounded-2xl font-bold dark:text-white hover:bg-slate-200 transition-colors">Cancel</button>
                      <button onClick={() => deleteResource(resource.id, resource.fileUrl, resource.previewImageUrl)} className="flex-1 py-4 bg-red-600 text-white rounded-2xl font-bold shadow-lg shadow-red-500/20 hover:bg-red-700 transition-colors">Confirm Delete</button>
                  </div>
              </div>
          </div>
      )}

      {/* Document Previewer */}
      {isPreviewOpen && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="absolute top-8 right-8 flex gap-4 z-[110]">
                   <a href={resource.fileUrl} download={resource.fileName} className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"><Download size={28} /></a>
                   <button onClick={() => setIsPreviewOpen(false)} className="p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all backdrop-blur-md"><X size={28}/></button>
              </div>
              <div className="w-full h-full max-w-[95vw] max-h-[90vh] overflow-hidden flex items-center justify-center bg-zinc-900/50 rounded-3xl border border-white/10 shadow-2xl relative">
                 {resource.mimeType?.includes('pdf') ? (
                    <iframe src={resource.fileUrl} className="w-full h-full border-none rounded-3xl" title="PDF Preview" />
                 ) : resource.mimeType?.startsWith('image/') ? (
                    <img src={resource.fileUrl} className="max-w-full max-h-full object-contain" alt="Preview" />
                 ) : (
                    <div className="text-center text-white p-12">
                        <FileText size={100} className="mx-auto mb-8 opacity-20" />
                        <h2 className="text-3xl font-black mb-4">No Direct Preview</h2>
                        <p className="text-slate-400 mb-10 max-w-md mx-auto text-lg">Your browser cannot render this specific file type ({resource.mimeType?.split('/').pop()?.toUpperCase()}) directly. Please download it to view.</p>
                        <a href={resource.fileUrl} download={resource.fileName} className="bg-primary-600 px-10 py-4 rounded-2xl font-bold hover:bg-primary-700 transition-transform hover:scale-105 inline-flex items-center gap-3 text-lg">
                            <Download size={24} /> Download File
                        </a>
                    </div>
                 )}
              </div>
          </div>
      )}
    </div>
  );
};

export default ResourceDetailPage;
