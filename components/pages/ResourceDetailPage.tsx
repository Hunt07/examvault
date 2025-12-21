
import React, { useState, useContext, useMemo } from 'react';
import { ResourceType, type Resource, type Comment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent } from '../../services/geminiService';
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, X, Trash2, Eye, Bookmark, FileType } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import UserRankBadge from '../UserRankBadge';
import Avatar from '../Avatar';
import ShareModal from '../ShareModal';

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
  const canDelete = isOwnComment || user?.isAdmin;

  const handleUserClick = (userId: string) => {
    if (userId === user?.id) setView('profile');
    else setView('publicProfile', userId);
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyText.trim() && user) {
      addCommentToResource(resourceId, replyText, comment.id);
      setReplyText('');
      setIsReplying(false);
    }
  };

  return (
    <div id={comment.id} className="mt-4 scroll-mt-24 p-2 rounded-lg">
      <div className="flex gap-4 items-start">
        <button onClick={() => handleUserClick(comment.author.id)} className="shrink-0">
          <Avatar src={comment.author.avatarUrl} alt={comment.author.name} className="w-10 h-10" />
        </button>
        <div className="flex-grow bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg border dark:border-zinc-700">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                 <button onClick={() => handleUserClick(comment.author.id)} className="font-bold text-slate-900 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400 text-sm hover:underline">{comment.author.name}</button>
                 <UserRankBadge rank={authorRank} size={14} />
              </div>
              <p className="text-xs text-slate-400 mt-1">{new Date(comment.timestamp).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="mt-2 dark:text-slate-200"><MarkdownRenderer content={comment.text} /></div>
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => handleCommentVote(resourceId, comment.id)}
              disabled={isOwnComment}
              className={`flex items-center p-2 text-sm font-semibold rounded-lg transition-colors ${isUpvoted ? 'bg-primary-600 text-white' : 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-600'}`}
            >
              <ThumbsUp size={14} />
              {comment.upvotes > 0 && <span className="ml-1.5">{comment.upvotes}</span>}
            </button>
            {user && !isOwnComment && (
              <button onClick={() => setIsReplying(!isReplying)} className="flex items-center gap-1.5 p-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 rounded-lg transition-colors">
                <MessageSquare size={14} /> Reply
              </button>
            )}
            {canDelete && <button onClick={() => setIsDeleteConfirmOpen(true)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete comment"><Trash2 size={14}/></button>}
          </div>
          {isReplying && (
            <form onSubmit={handleReplySubmit} className="mt-4">
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write your reply..."
                className="w-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none dark:text-white"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-2">
                <button type="button" onClick={() => setIsReplying(false)} className="px-3 py-1 text-xs font-semibold text-slate-500">Cancel</button>
                <button type="submit" className="px-3 py-1 text-xs font-bold bg-primary-600 text-white rounded-md">Post Reply</button>
              </div>
            </form>
          )}
        </div>
      </div>
      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl text-center max-w-xs w-full shadow-2xl border dark:border-zinc-700">
                  <h3 className="font-bold mb-4 dark:text-white">Delete comment?</h3>
                  <div className="flex gap-2">
                      <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 dark:text-white rounded">Cancel</button>
                      <button onClick={() => deleteCommentFromResource(resourceId, comment)} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Delete</button>
                  </div>
              </div>
          </div>
      )}
      <div className="pl-8 border-l-2 border-slate-200 dark:border-zinc-700 ml-5">{children}</div>
    </div>
  );
};

const ResourceDetailPage: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { user, userRanks, setView, handleVote, goBack, savedResourceIds, toggleSaveResource, deleteResource, addCommentToResource } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');

  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const isAdmin = user?.isAdmin;
  const canDelete = isAuthor || isAdmin;
  
  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');

  const commentsByParentId = useMemo(() => {
    const group: Record<string, Comment[]> = {};
    (resource.comments || []).forEach(c => {
      const pId = c.parentId || 'root';
      if (!group[pId]) group[pId] = [];
      group[pId].push(c);
    });
    return group;
  }, [resource.comments]);

  const renderComments = (parentId: string | null) => {
    const list = commentsByParentId[parentId || 'root'] || [];
    return list.map(c => <CommentComponent key={c.id} comment={c} resourceId={resource.id}>{renderComments(c.id)}</CommentComponent>);
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    try {
        let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}\nDescription: ${resource.description}`;
        const result = await summarizeContent(textContext, resource.fileBase64, resource.mimeType);
        setSummary(result);
    } finally {
        setIsSummarizing(false);
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
      e.preventDefault();
      if (newCommentText.trim()) {
          addCommentToResource(resource.id, newCommentText, null);
          setNewCommentText('');
      }
  };

  const renderPreviewContent = () => {
    const ext = resource.fileName.split('.').pop()?.toLowerCase();
    if (resource.fileUrl === '#') return <div className="p-8 text-center"><MarkdownRenderer content={resource.contentForAI} /></div>;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <img src={resource.fileUrl} alt="Preview" className="max-w-full max-h-full object-contain mx-auto" />;
    if (ext === 'pdf') return <iframe src={resource.fileUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>;
    return <div className="p-8 text-center flex flex-col items-center justify-center h-full"><FileType size={64} className="mb-4 text-slate-400" /><p className="text-slate-500">Preview not available for .{ext} files.</p></div>;
  };

  return (
    <div className="animate-in fade-in duration-500">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 transition mb-6"><ArrowLeft size={20} /> Back</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-dark-surface p-6 sm:p-8 rounded-2xl shadow-md border dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-6">
              <span className="px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200">{resource.type}</span>
              <span className="text-xs font-black uppercase tracking-wider px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full dark:text-white">{resource.courseCode}</span>
              {isAdmin && !isAuthor && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-black uppercase rounded">Moderator Access</span>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white leading-tight">{resource.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-2 font-medium">{resource.courseName}</p>
            <div className="mt-8 prose dark:prose-invert max-w-none text-slate-600 dark:text-slate-400">{resource.description}</div>
            <div className="mt-10 pt-8 border-t border-slate-100 dark:border-zinc-700 flex flex-col sm:flex-row gap-4">
                <button onClick={() => setIsPreviewOpen(true)} className="flex-1 py-4 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2 shadow-sm"><Eye size={20}/> Preview Document</button>
                <a href={resource.fileUrl} download className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"><Download size={20}/> Download File</a>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 sm:p-8 rounded-2xl shadow-md border dark:border-zinc-700">
            <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2"><BrainCircuit size={24} className="text-primary-500"/> AI Academic Summary</h3>
            {!summary && !isSummarizing ? (
              <button onClick={handleGenerateSummary} className="w-full py-12 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-500 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition flex flex-col items-center gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-full"><BrainCircuit size={40}/></div>
                <div className="text-center">
                    <p className="font-bold text-slate-800 dark:text-white">Generate AI Analysis</p>
                    <p className="text-sm mt-1">Get key concepts, takeaways, and potential questions.</p>
                </div>
              </button>
            ) : isSummarizing ? (
              <div className="py-12 text-center flex flex-col items-center gap-4">
                <Loader2 size={48} className="animate-spin text-primary-500"/>
                <p className="font-bold text-slate-800 dark:text-white animate-pulse">Gemini is analyzing your document...</p>
              </div>
            ) : (
              <div className="prose dark:prose-invert max-w-none animate-in fade-in slide-in-from-top-4"><MarkdownRenderer content={summary} /></div>
            )}
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 sm:p-8 rounded-2xl shadow-md border dark:border-zinc-700">
            <h3 className="text-xl font-bold mb-8 dark:text-white flex items-center gap-2"><MessageSquare size={24} className="text-primary-500"/> Discussion</h3>
            <form onSubmit={handlePostComment} className="mb-10">
                <textarea 
                    value={newCommentText} 
                    onChange={(e) => setNewCommentText(e.target.value)} 
                    placeholder="Ask a question or share feedback..." 
                    className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl p-4 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white transition" 
                    rows={3} 
                />
                <div className="mt-3 flex justify-end">
                    <button type="submit" disabled={!newCommentText.trim()} className="bg-primary-600 text-white font-bold py-2.5 px-8 rounded-xl hover:bg-primary-700 transition disabled:opacity-50 shadow-md">Post Comment</button>
                </div>
            </form>
            <div className="space-y-2">{renderComments(null)}</div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700 sticky top-24">
             <div className="relative group overflow-hidden rounded-xl mb-6 shadow-sm border dark:border-zinc-800">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-64 object-cover transform group-hover:scale-105 transition duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             
             <div className="space-y-3">
                <div className="flex gap-2">
                    <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition font-black text-sm tracking-widest ${isUpvoted ? 'bg-green-600 text-white shadow-lg shadow-green-500/25' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <ThumbsUp size={18}/> UPVOTE {resource.upvotes || 0}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => toggleSaveResource(resource.id)} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition font-black text-sm tracking-widest ${isSaved ? 'text-amber-600 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <Bookmark size={18}/> {isSaved ? 'SAVED' : 'SAVE'}
                    </button>
                    {canDelete && (
                      <button 
                        onClick={() => setIsDeleteConfirmOpen(true)} 
                        className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 transition border border-transparent dark:border-red-900/50"
                      >
                        <Trash2 size={20}/>
                      </button>
                    )}
                </div>
             </div>

             <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-700">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Contributor</p>
                <button onClick={() => setView('publicProfile', resource.author.id)} className="flex items-center gap-4 text-left w-full hover:bg-slate-50 dark:hover:bg-zinc-800/50 p-2 -ml-2 rounded-xl transition-all">
                    <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-12 h-12 shadow-sm" />
                    <div className="overflow-hidden">
                      <div className="flex items-center gap-1">
                        <p className="font-bold text-slate-800 dark:text-white truncate">{resource.author.name}</p>
                        <UserRankBadge rank={userRanks.get(resource.author.id)} size={16}/>
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">{resource.author.course}</p>
                    </div>
                </button>
             </div>
          </div>
        </div>
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/90 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border dark:border-zinc-700 animate-in zoom-in-95">
                <div className="p-4 border-b dark:border-zinc-700 flex justify-between items-center bg-white dark:bg-zinc-800">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-100 dark:bg-zinc-700 rounded-lg"><FileType size={20} className="text-primary-500"/></div>
                        <h3 className="font-bold truncate dark:text-white max-w-xs sm:max-w-md">{resource.fileName}</h3>
                    </div>
                    <button onClick={() => setIsPreviewOpen(false)} className="p-2 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full transition"><X size={24}/></button>
                </div>
                <div className="flex-grow bg-slate-200 dark:bg-zinc-950 overflow-auto scrollbar-hide">{renderPreviewContent()}</div>
            </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl border dark:border-zinc-700 animate-in zoom-in-95">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                    <Trash2 size={40}/>
                </div>
                <h3 className="text-2xl font-bold mb-2 dark:text-white">Delete Resource?</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">
                    {isAdmin && !isAuthor ? "You are removing this as a moderator. This action cannot be reversed." : "This will permanently remove this resource and your earned points."}
                </p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => deleteResource(resource.id, resource.fileUrl)} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition shadow-md">Yes, Delete Resource</button>
                  <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full py-3 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-xl font-bold hover:bg-slate-200 transition">Cancel</button>
                </div>
            </div>
        </div>
      )}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} resource={resource} />
    </div>
  );
};

export default ResourceDetailPage;
