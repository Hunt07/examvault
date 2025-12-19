
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion, type Attachment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent } from '../../services/geminiService';
import { ArrowLeft, ThumbsUp, ThumbsDown, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Eye, X, Trash2, Bookmark, BookmarkCheck, Calendar, User as UserIcon, MessageSquare } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
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
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
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
                  className={`ml-auto text-xs font-bold ${isAdmin && !isOwnComment ? 'text-red-600 uppercase' : 'text-slate-400 hover:text-red-500'}`}
               >
                  {isAdmin && !isOwnComment ? 'Admin Delete' : <Trash2 size={14} />}
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
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

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
      resource.comments.forEach(c => {
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
          {/* Main Content Hero */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl overflow-hidden border dark:border-zinc-700">
            <div className="relative h-64 md:h-80 bg-slate-100 dark:bg-zinc-900">
               <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-full object-cover opacity-90" />
               <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-8">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                        <span className="bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">{resource.type}</span>
                        <span className="bg-white/20 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-bold">{resource.courseCode}</span>
                    </div>
                    <h1 className="text-3xl md:text-4xl font-bold text-white mb-2 leading-tight">{resource.title}</h1>
                    <p className="text-slate-300 text-sm line-clamp-1">{resource.courseName}</p>
                  </div>
               </div>
            </div>
            
            <div className="p-8">
                <div className="flex flex-wrap gap-6 mb-8">
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400"><Calendar size={18}/> <span>{resource.year} • {resource.semester}</span></div>
                    {resource.lecturer && <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400"><UserIcon size={18}/> <span>{resource.lecturer}</span></div>}
                    <div className="flex items-center gap-2 text-slate-600 dark:text-zinc-400"><FileText size={18}/> <span>{resource.fileName}</span></div>
                </div>
                
                <h3 className="font-bold text-slate-800 dark:text-white mb-3">Description</h3>
                <p className="text-slate-600 dark:text-zinc-300 mb-8 leading-relaxed">{resource.description}</p>
                
                <div className="flex gap-4">
                    <button onClick={() => setIsPreviewOpen(true)} className="flex-1 py-3 px-6 bg-slate-100 dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-xl font-bold dark:text-white transition flex items-center justify-center gap-2">
                        <Eye size={20} /> Preview File
                    </button>
                    <a href={resource.fileUrl} download={resource.fileName} className="flex-1 py-3 px-6 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold shadow-lg shadow-primary-500/30 transition flex items-center justify-center gap-2">
                        <Download size={20} /> Download
                    </a>
                </div>
            </div>
          </div>

          {/* AI Summary Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg p-8 border dark:border-zinc-700">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2"><BrainCircuit className="text-primary-600" /> AI Study Assistant</h3>
                {!summary && <button onClick={handleGenerateSummary} disabled={isSummarizing} className="text-sm font-bold text-primary-600 hover:underline disabled:opacity-50">Generate Summary</button>}
            </div>
            
            {isSummarizing ? (
                <div className="py-12 text-center flex flex-col items-center gap-4">
                    <Loader2 className="animate-spin text-primary-600" size={32} />
                    <p className="text-slate-500 font-medium animate-pulse">Gemini is analyzing the material...</p>
                </div>
            ) : summary ? (
                <div className="bg-slate-50 dark:bg-zinc-900/50 rounded-xl p-6 border dark:border-zinc-700/50">
                    <MarkdownRenderer content={summary} />
                </div>
            ) : (
                <div className="text-center py-10 bg-slate-50 dark:bg-zinc-900/30 rounded-xl border-2 border-dashed border-slate-200 dark:border-zinc-700">
                    <BrainCircuit className="mx-auto text-slate-300 dark:text-zinc-600 mb-4" size={48} />
                    <p className="text-slate-500 dark:text-zinc-400 mb-4">Click below to generate an AI summary and potential exam questions.</p>
                    <button onClick={handleGenerateSummary} className="bg-primary-600 text-white px-6 py-2.5 rounded-lg font-bold text-sm">Summarize with AI</button>
                </div>
            )}
          </div>

          {/* Comments Section */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-lg p-8 border dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><MessageSquare className="text-slate-400" /> Discussion</h3>
            <form onSubmit={handlePostComment} className="flex gap-4 mb-8">
                <Avatar src={user?.avatarUrl} alt={user?.name || "User"} className="w-12 h-12" />
                <div className="flex-grow">
                    <textarea value={newComment} onChange={e => setNewComment(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 p-4 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none dark:text-white" placeholder="Add to the conversation..." rows={3} />
                    <button type="submit" className="mt-2 bg-primary-600 text-white px-6 py-2 rounded-lg font-bold float-right shadow-md">Post Comment</button>
                </div>
            </form>
            <div className="space-y-4 clear-both">
                {renderComments()}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-8">
          {/* Action Card */}
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl p-6 border dark:border-zinc-700 sticky top-24">
             <div className="flex gap-3 mb-6">
                <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${isUpvoted ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                    <ThumbsUp size={18} /> {resource.upvotes}
                </button>
                <button onClick={() => handleVote(resource.id, 'down')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition ${isDownvoted ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-zinc-300'}`}>
                    <ThumbsDown size={18} /> {resource.downvotes}
                </button>
             </div>
             
             <button onClick={() => toggleSaveResource(resource.id)} className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 mb-4 transition ${isSaved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white hover:bg-slate-200'}`}>
                {isSaved ? <BookmarkCheck /> : <Bookmark />} {isSaved ? 'Bookmarked' : 'Save for later'}
             </button>

             {(isAuthor || isAdmin) && (
                <button onClick={() => setIsDeleteConfirmOpen(true)} className="w-full py-3 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition border border-red-100 dark:border-red-900/30">
                    <Trash2 size={18} /> {isAdmin && !isAuthor ? 'Admin Delete' : 'Delete Resource'}
                </button>
             )}

             <div className="mt-8 pt-8 border-t dark:border-zinc-700">
                <p className="text-xs uppercase font-bold text-slate-400 mb-4 tracking-widest">Uploader</p>
                <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setView('publicProfile', resource.author.id)}>
                    <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-14 h-14" />
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-bold text-slate-900 dark:text-white group-hover:underline">{resource.author.name}</p>
                            <UserRankBadge rank={authorRank} size={16} />
                        </div>
                        <p className="text-sm text-slate-500 dark:text-zinc-400">{resource.author.course}</p>
                    </div>
                </div>
             </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Overlay */}
      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl max-w-md w-full shadow-2xl border border-red-100 dark:border-red-900/30">
                  <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center text-red-600 mb-6 mx-auto"><Trash2 size={32} /></div>
                  <h3 className="text-2xl font-bold text-center mb-2 dark:text-white">Delete Resource?</h3>
                  <p className="text-slate-500 text-center mb-8">This action is irreversible. All associated comments and points will be removed.</p>
                  <div className="flex gap-4">
                      <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 rounded-xl font-bold dark:text-white">Cancel</button>
                      <button onClick={() => deleteResource(resource.id, resource.fileUrl, resource.previewImageUrl)} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20">Delete</button>
                  </div>
              </div>
          </div>
      )}

      {/* Fullscreen Preview Overlay */}
      {isPreviewOpen && (
          <div className="fixed inset-0 bg-black/95 z-[100] flex flex-col items-center justify-center animate-in fade-in duration-300">
              <div className="absolute top-6 right-6 flex gap-4 z-[110]">
                   <a href={resource.fileUrl} download={resource.fileName} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"><Download size={24} /></a>
                   <button onClick={() => setIsPreviewOpen(false)} className="p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"><X size={24}/></button>
              </div>
              <div className="w-full h-full max-w-6xl max-h-[90vh] overflow-hidden flex items-center justify-center bg-white/5 rounded-2xl border border-white/10">
                 {resource.mimeType?.includes('pdf') ? (
                    <iframe src={resource.fileUrl} className="w-full h-full border-none" title="PDF Preview" />
                 ) : resource.mimeType?.startsWith('image/') ? (
                    <img src={resource.fileUrl} className="max-w-full max-h-full object-contain" alt="Preview" />
                 ) : (
                    <div className="text-center text-white p-12">
                        <FileText size={80} className="mx-auto mb-6 opacity-30" />
                        <h2 className="text-2xl font-bold mb-4">No in-browser preview available</h2>
                        <p className="text-slate-400 mb-8 max-w-md mx-auto">This file type ({resource.mimeType}) can't be rendered directly in the browser. Please download it to view the content.</p>
                        <a href={resource.fileUrl} download={resource.fileName} className="bg-primary-600 px-8 py-3 rounded-xl font-bold hover:bg-primary-700 transition">Download Now</a>
                    </div>
                 )}
              </div>
          </div>
      )}
    </div>
  );
};

export default ResourceDetailPage;
