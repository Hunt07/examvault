
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
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
        <div className="flex-grow bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg">
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
            {user && user.id !== comment.author.id && (
              <button onClick={() => setIsReplying(!isReplying)} className="flex items-center gap-1.5 p-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 rounded-lg transition-colors">
                <MessageSquare size={14} /> Reply
              </button>
            )}
            {canDelete && <button onClick={() => setIsDeleteConfirmOpen(true)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete comment"><Trash2 size={14}/></button>}
          </div>
        </div>
      </div>
      {isDeleteConfirmOpen && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl text-center max-w-xs w-full">
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
  const { user, userRanks, setView, handleVote, goBack, savedResourceIds, toggleSaveResource, deleteResource, scrollTargetId, setScrollTargetId } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const isAdmin = user?.isAdmin;
  const canDelete = isAuthor || isAdmin;
  
  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  const resolveFileBase64 = async (): Promise<string | undefined> => {
    if (resource.fileBase64) return resource.fileBase64;
    try {
        const response = await fetch(resource.fileUrl);
        if (!response.ok) throw new Error('Fetch failed');
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) { return undefined; }
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    let base64;
    if (!resource.extractedText) base64 = await resolveFileBase64();
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}`;
    // Updated call to use configuration object
    const result = await summarizeContent({
        content: textContext, 
        fileBase64: base64, 
        mimeType: resource.mimeType, 
        extractedText: resource.extractedText
    });
    setSummary(result); setIsSummarizing(false);
  };

  const renderPreviewContent = () => {
    const ext = resource.fileName.split('.').pop()?.toLowerCase();
    if (resource.fileUrl === '#') return <div className="p-8 text-center"><MarkdownRenderer content={resource.contentForAI} /></div>;
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) return <img src={resource.fileUrl} alt="Preview" className="max-w-full max-h-full object-contain" />;
    if (ext === 'pdf') return <iframe src={resource.fileUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>;
    return <div className="p-8 text-center"><FileType size={64} className="mx-auto mb-4" /><p>Preview not available for .{ext} files.</p></div>;
  };

  return (
    <div>
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 transition mb-6"><ArrowLeft size={20} /> Back</button>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100">{resource.type}</span>
              <span className="text-sm font-bold px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full dark:text-white">{resource.courseCode}</span>
              {isAdmin && !isAuthor && (
                <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-black uppercase rounded">Moderator Access</span>
              )}
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{resource.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">{resource.courseName}</p>
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-700 flex flex-col gap-3">
                <button onClick={() => setIsPreviewOpen(true)} className="flex-1 py-3 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2"><Eye size={18}/> Preview</button>
                <a href={resource.fileUrl} download className="flex-1 py-3 bg-primary-600 text-white rounded-lg font-bold hover:bg-primary-700 transition flex items-center justify-center gap-2"><Download size={18}/> Download</a>
            </div>
          </div>
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border dark:border-zinc-700">
            <h3 className="text-xl font-bold mb-4 dark:text-white">AI Summary</h3>
            {!summary && !isSummarizing ? (
              <button onClick={handleGenerateSummary} className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg text-slate-500 hover:border-primary-500 transition flex flex-col items-center gap-2"><BrainCircuit size={32}/> <span>Generate AI Summary</span></button>
            ) : isSummarizing ? (
              <div className="py-8 text-center"><Loader2 size={32} className="animate-spin mx-auto text-primary-500"/><p className="mt-2 dark:text-slate-400">Thinking...</p></div>
            ) : (
              <div className="prose dark:prose-invert max-w-none"><MarkdownRenderer content={summary} /></div>
            )}
          </div>
        </div>
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border dark:border-zinc-700 sticky top-24">
             <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-64 object-cover rounded-lg mb-6" />
             <div className="flex flex-col gap-3">
                <div className="flex gap-2 w-full">
                    <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition font-bold ${isUpvoted ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <ThumbsUp size={18}/> {resource.upvotes || 0}
                    </button>
                    <button onClick={() => handleVote(resource.id, 'down')} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition font-bold ${isDownvoted ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <ThumbsDown size={18}/> {resource.downvotes || 0}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => toggleSaveResource(resource.id)} className={`flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 transition font-bold ${isSaved ? 'text-amber-500 bg-amber-50 border border-amber-200 dark:bg-amber-900/20 dark:border-amber-700' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <Bookmark size={18}/> {isSaved ? 'Saved' : 'Save'}
                    </button>
                    {canDelete && (
                      <button 
                        onClick={() => setIsDeleteConfirmOpen(true)} 
                        className="p-2.5 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                        title={isAdmin && !isAuthor ? "Delete (Admin Override)" : "Delete Resource"}
                      >
                        <Trash2 size={20}/>
                      </button>
                    )}
                </div>
             </div>
             <div className="mt-6 pt-6 border-t border-slate-100 dark:border-zinc-700">
                <p className="text-sm font-semibold mb-3 dark:text-slate-300">Uploaded by</p>
                <button onClick={() => setView('publicProfile', resource.author.id)} className="flex items-center gap-3 text-left w-full hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
                    <Avatar src={resource.author.avatarUrl} alt={resource.author.name} />
                    <div>
                      <p className="font-bold dark:text-white">{resource.author.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{resource.author.course}</p>
                    </div>
                </button>
             </div>
          </div>
        </div>
      </div>
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 w-full max-w-5xl h-[85vh] rounded-xl flex flex-col overflow-hidden">
                <div className="p-4 border-b dark:border-zinc-700 flex justify-between items-center bg-white dark:bg-zinc-800"><h3 className="font-bold truncate dark:text-white">{resource.fileName}</h3><button onClick={() => setIsPreviewOpen(false)} className="p-2 dark:text-white"><X size={24}/></button></div>
                <div className="flex-grow bg-slate-200 overflow-auto">{renderPreviewContent()}</div>
            </div>
        </div>
      )}
      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl max-w-sm text-center shadow-2xl border dark:border-zinc-700">
                <Trash2 size={48} className="mx-auto text-red-500 mb-4" />
                <h3 className="text-xl font-bold mb-2 dark:text-white">Delete Resource?</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{isAdmin && !isAuthor ? "You are deleting this as an administrator." : "This action cannot be undone."}</p>
                <div className="flex gap-3">
                  <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 dark:text-white rounded-lg">Cancel</button>
                  <button onClick={() => deleteResource(resource.id, resource.fileUrl, resource.previewImageUrl)} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">Delete</button>
                </div>
            </div>
        </div>
      )}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} resource={resource} />
    </div>
  );
};

export default ResourceDetailPage;
