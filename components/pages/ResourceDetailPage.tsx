
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion, type Attachment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, AlertCircle, FileType, Bookmark, BookmarkCheck, Share2, Trash2, Paperclip, ImageIcon } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';
import FlashcardViewer from '../FlashcardViewer';
import QuizComponent from '../QuizComponent';
import ShareModal from '../ShareModal';
import ResourceCard from '../ResourceCard';
import Avatar from '../Avatar';
import { db, storage } from '../../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

  const handleUserClick = (userId: string) => {
    if (userId === user?.id) {
      setView('profile');
    } else {
      setView('publicProfile', userId);
    }
  };

  const handleVoteForComment = () => {
    if (isOwnComment || !user) return;
    handleCommentVote(resourceId, comment.id);
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (replyText.trim() && user) {
      addCommentToResource(resourceId, replyText, comment.id);
      setReplyText('');
      setIsReplying(false);
    }
  };

  const handleDelete = () => {
      deleteCommentFromResource(resourceId, comment);
      setIsDeleteConfirmOpen(false);
  };

  return (
    <div id={comment.id} className="mt-4 scroll-mt-24 transition-colors duration-1000 p-2 rounded-lg">
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
                 <span className="text-[10px] font-bold uppercase tracking-wider bg-slate-200 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-300 dark:border-zinc-600">
                    {comment.author.course}
                 </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                {new Date(comment.timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <div className="mt-2 dark:text-slate-200">
            <MarkdownRenderer content={comment.text} />
          </div>

          {comment.attachment && (
            <div className="mt-4">
                <a 
                    href={comment.attachment.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="inline-flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition shadow-sm group"
                >
                    <div className="p-2 bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 rounded-lg group-hover:scale-110 transition">
                        {comment.attachment.type === 'image' ? <ImageIcon size={20} /> : <FileText size={20} />}
                    </div>
                    <div className="overflow-hidden">
                        <p className="text-xs font-bold text-slate-800 dark:text-white truncate max-w-[150px]">{comment.attachment.name}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{comment.attachment.size || 'File'}</p>
                    </div>
                </a>
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={handleVoteForComment}
              disabled={isOwnComment}
              className={`flex items-center p-2 text-sm font-semibold rounded-lg transition-colors ${
                isUpvoted
                  ? 'bg-primary-600 text-white'
                  : isOwnComment
                  ? 'bg-slate-100 dark:bg-zinc-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                  : 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-600'
              }`}
            >
              <ThumbsUp size={14} />
              {comment.upvotes > 0 && <span className="ml-1.5">{comment.upvotes}</span>}
            </button>
            {user && user.id !== comment.author.id && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1.5 p-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
              >
                <MessageCircle size={14} /> Reply
              </button>
            )}
            {isOwnComment && (
               <>
                <button
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className="flex items-center gap-1.5 p-2 text-sm font-semibold text-red-500 bg-white dark:bg-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                    <Trash2 size={14} />
                </button>
                {isDeleteConfirmOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Comment?</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to delete this comment?</p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">Cancel</button>
                                <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">Delete</button>
                            </div>
                        </div>
                    </div>
                )}
               </>
            )}
          </div>
        </div>
      </div>

      {isReplying && (
        <div className="ml-14 mt-4">
          <form onSubmit={handleReplySubmit} className="flex gap-4 items-start">
            <Avatar src={user?.avatarUrl} alt={user?.name || "User"} className="w-8 h-8" />
            <div className="flex-grow">
              <MarkdownToolbar
                textareaRef={replyTextareaRef}
                value={replyText}
                onValueChange={setReplyText}
              />
              <textarea
                ref={replyTextareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Replying to ${comment.author.name}...`}
                className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-b-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none"
                rows={2}
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button type="submit" className="bg-primary-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-primary-700 transition text-sm">
                  Post Reply
                </button>
                <button type="button" onClick={() => setIsReplying(false)} className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 font-semibold py-1 px-3 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition text-sm">
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      <div className="pl-8 border-l-2 border-slate-200 dark:border-zinc-700 ml-5">
        {children}
      </div>
    </div>
  );
};


const ResourceDetailPage: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { user, userRanks, setView, handleVote, addCommentToResource, goBack, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, resources, deleteResource, scrollTargetId, setScrollTargetId, showToast } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isUploadingCommentFile, setIsUploadingCommentFile] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [hasReported, setHasReported] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [relatedStartIndex, setRelatedStartIndex] = useState(0);
  const [aiGeneratedPreview, setAiGeneratedPreview] = useState('');
  const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [studySet, setStudySet] = useState<(Flashcard[] | QuizQuestion[]) | null>(null);
  const [studySetType, setStudySetType] = useState<'flashcards' | 'quiz' | null>(null);
  const [isGeneratingStudySet, setIsGeneratingStudySet] = useState(false);

  const authorRank = userRanks.get(resource.author.id);
  const isFollowingLecturer = user?.subscriptions.lecturers.includes(resource.lecturer || '');
  const isFollowingCourse = user?.subscriptions.courseCodes.includes(resource.courseCode);
  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;

  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  // Handle Deep Linking / Scrolling
  useEffect(() => {
      if (scrollTargetId) {
          // Allow DOM to render
          setTimeout(() => {
              const targetElement = document.getElementById(scrollTargetId);
              if (targetElement) {
                  targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  targetElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/20', 'rounded-lg');
                  setTimeout(() => {
                      targetElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/20', 'rounded-lg');
                      setScrollTargetId(null);
                  }, 2000);
              }
          }, 500);
      }
  }, [scrollTargetId, resource.id]);

  useEffect(() => {
    setSummary('');
    setIsSummarizing(false);
    setStudySet(null);
    setStudySetType(null);
    setIsGeneratingStudySet(false);
    setNewComment('');
    setCommentFile(null);
    setIsReporting(false);
    setReportReason('');
    setHasReported(false);
    setIsPreviewOpen(false);
    setRelatedStartIndex(0);
    setAiGeneratedPreview('');
    setIsGeneratingPreview(false);
  }, [resource.id]);

  const isAISupported = useMemo(() => {
      if (!resource.mimeType) return false;
      return true; 
  }, [resource.mimeType]);

  const commentsByParentId = useMemo(() => {
    const group: Record<string, Comment[]> = {};
    for (const comment of resource.comments || []) {
        const parentId = comment.parentId || 'root';
        if (!group[parentId]) {
            group[parentId] = [];
        }
        group[parentId].push(comment);
    }
    for (const parentId in group) {
        group[parentId].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    }
    return group;
  }, [resource.comments]);

  const relatedResources = useMemo(() => {
    const candidates = resources.filter(r => r.id !== resource.id);
    let matches = candidates.filter(r => r.courseCode === resource.courseCode);
    
    if (matches.length < 8) {
        const subjectMatch = resource.courseCode.match(/^[A-Za-z]+/);
        if (subjectMatch) {
            const subject = subjectMatch[0];
            const subjectMatches = candidates.filter(r => 
                r.courseCode.startsWith(subject) && !matches.includes(r)
            );
            matches = [...matches, ...subjectMatches];
        }
    }

    if (matches.length < 8) {
        const typeMatches = candidates.filter(r => 
            r.type === resource.type && !matches.includes(r)
        );
        matches = [...matches, ...typeMatches];
    }
    
    if (matches.length < 8) {
        const otherMatches = candidates.filter(r => !matches.includes(r));
        matches = [...matches, ...otherMatches];
    }

    return matches.slice(0, 8);
  }, [resources, resource]);

  const handleAuthorClick = (authorId: string) => {
    if (authorId === user?.id) setView('profile');
    else setView('publicProfile', authorId);
  };

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
    } catch (error) {
        console.error("Error fetching file for AI:", error);
        return undefined;
    }
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    setSummary('');
    const base64 = await resolveFileBase64();
    if (!base64 && resource.fileUrl !== '#') {
        setSummary("⚠️ **Content Access Error**");
        setIsSummarizing(false);
        return;
    }
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}\nType: ${resource.type}`;
    if (!base64 && resource.fileUrl === '#') textContext += `\n\n[Mock Content]:\n${resource.contentForAI}`;
    const result = await summarizeContent(textContext, base64, resource.mimeType);
    setSummary(result);
    setIsSummarizing(false);
  };
  
  const handleGeneratePreview = async () => {
    if (!isAISupported) return;
    setIsGeneratingPreview(true);
    const base64 = await resolveFileBase64();
    if (!base64 && resource.fileUrl !== '#') {
        setAiGeneratedPreview("⚠️ **Content Access Error**");
        setIsGeneratingPreview(false);
        return;
    }
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}`;
    if (!base64 && resource.fileUrl === '#') textContext += `\n\n[Mock Content]:\n${resource.contentForAI}`;
    const result = await summarizeContent(textContext, base64, resource.mimeType);
    setAiGeneratedPreview(result);
    setIsGeneratingPreview(false);
  };
  
  const handleGenerateStudySet = async (type: 'flashcards' | 'quiz') => {
    setIsGeneratingStudySet(true);
    setStudySet(null);
    setStudySetType(type);
    const base64 = await resolveFileBase64();
    if (!base64 && resource.fileUrl !== '#') {
        setStudySet([]);
        setIsGeneratingStudySet(false);
        return;
    }
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}`;
    if (!base64 && resource.fileUrl === '#') textContext += `\n\n[Mock Content]:\n${resource.contentForAI}`;
    const result = await generateStudySet(textContext, type, base64, resource.mimeType);
    setStudySet(result);
    setIsGeneratingStudySet(false);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((newComment.trim() || commentFile) && user) {
        let attachment: Attachment | undefined;
        
        if (commentFile) {
            setIsUploadingCommentFile(true);
            try {
                const storageRef = ref(storage, `comments/${Date.now()}_${commentFile.name}`);
                await uploadBytes(storageRef, commentFile);
                const url = await getDownloadURL(storageRef);
                attachment = {
                    url,
                    name: commentFile.name,
                    type: commentFile.type.startsWith('image/') ? 'image' : 'file',
                    size: `${(commentFile.size / 1024).toFixed(0)} KB`
                };
            } catch (err) {
                showToast("Failed to upload attachment", "error");
                setIsUploadingCommentFile(false);
                return;
            }
        }

        addCommentToResource(resource.id, newComment, null, attachment);
        setNewComment('');
        setCommentFile(null);
        setIsUploadingCommentFile(false);
    }
  };

  const handleUpvoteClick = () => handleVote(resource.id, 'up');
  const handleDownvoteClick = () => handleVote(resource.id, 'down');
  
  const handleSubmitReport = async () => {
    if (reportReason.trim() !== "") {
      try {
        await addDoc(collection(db, "reports"), {
          resourceId: resource.id, resourceTitle: resource.title,
          uploaderId: resource.author.id, uploaderName: resource.author.name,
          reporterId: user?.id || 'anonymous', reporterName: user?.name || 'Anonymous',
          reason: reportReason, timestamp: new Date().toISOString(), status: 'pending'
        });
        setIsReporting(false); setReportReason(''); setHasReported(true);
      } catch (error) { showToast("Report failed", "error"); }
    }
  };

  const renderComments = (parentId: string | null) => {
    const comments = commentsByParentId[parentId || 'root'] || [];
    return comments.map(comment => (
        <CommentComponent key={comment.id} comment={comment} resourceId={resource.id}>
            {renderComments(comment.id)}
        </CommentComponent>
    ));
  };

  const renderPreviewContent = () => {
    const isMock = resource.fileUrl === '#';
    const ext = resource.fileName.split('.').pop()?.toLowerCase();
    const isPdf = ext === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
    const isOfficeDoc = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext || '');

    if (isMock) return <div className="p-8 text-center"><MarkdownRenderer content={resource.contentForAI} /></div>;
    if (isImage) return <img src={resource.fileUrl} alt="Preview" className="max-w-full max-h-full object-contain" />;
    if (isPdf) return <iframe src={resource.fileUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>;
    if (isOfficeDoc) return <iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(resource.fileUrl)}&embedded=true`} className="w-full h-full border-none" title="Office Document Preview" />;
    return <div className="flex flex-col items-center justify-center p-8 text-center">{isGeneratingPreview ? <Loader2 className="animate-spin text-primary-500" /> : <MarkdownRenderer content={aiGeneratedPreview || 'Preview unavailable.'} />}</div>;
  };

  return (
    <div className="animate-in fade-in duration-500">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 transition mb-6"><ArrowLeft size={20} /> Back</button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <span className={`flex items-center gap-2 text-sm font-black uppercase px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300`}>{resource.type}</span>
              <span className="text-sm font-bold px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full dark:text-white">{resource.courseCode}</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white leading-tight">{resource.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-1 font-medium">{resource.courseName}</p>
            <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-700 flex flex-col sm:flex-row gap-4">
                <button onClick={() => setIsPreviewOpen(true)} className="flex-1 py-4 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-xl font-bold hover:bg-slate-200 dark:hover:bg-zinc-700 transition flex items-center justify-center gap-2 shadow-sm"><Eye size={20}/> Preview Document</button>
                <a href={resource.fileUrl} download className="flex-1 py-4 bg-primary-600 text-white rounded-xl font-bold hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-lg shadow-primary-500/25"><Download size={20}/> Download File</a>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
            <h3 className="text-xl font-bold mb-6 dark:text-white flex items-center gap-2"><BrainCircuit size={24} className="text-primary-500"/> AI Academic Summary</h3>
            {!summary && !isSummarizing ? (
              <button onClick={handleGenerateSummary} className="w-full py-12 border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-2xl text-slate-500 hover:border-primary-500 transition flex flex-col items-center gap-4">
                <div className="p-4 bg-slate-50 dark:bg-zinc-800 rounded-full"><BrainCircuit size={40}/></div>
                <div className="text-center"><p className="font-bold text-slate-800 dark:text-white">Generate AI Analysis</p></div>
              </button>
            ) : isSummarizing ? (
              <div className="py-12 text-center flex flex-col items-center gap-4"><Loader2 size={48} className="animate-spin text-primary-500"/><p className="font-bold">Analyzing...</p></div>
            ) : (
              <div className="prose dark:prose-invert max-w-none"><MarkdownRenderer content={summary} /></div>
            )}
          </div>

          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md border dark:border-zinc-700">
            <h3 className="text-xl font-bold mb-8 dark:text-white flex items-center gap-2"><MessageSquare size={24} className="text-primary-500"/> Discussion</h3>
            <form onSubmit={handlePostComment} className="mb-10 space-y-4">
                <div className="relative">
                    <MarkdownToolbar textareaRef={commentTextareaRef} value={newComment} onValueChange={setNewComment} />
                    <textarea 
                        ref={commentTextareaRef}
                        value={newComment} 
                        onChange={(e) => setNewComment(e.target.value)} 
                        placeholder="Add a comment..." 
                        className="w-full bg-slate-50 dark:bg-zinc-900 border border-t-0 border-slate-200 dark:border-zinc-700 rounded-b-xl p-4 focus:ring-2 focus:ring-primary-500 outline-none dark:text-white transition" 
                        rows={3} 
                    />
                </div>

                {commentFile && (
                    <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
                        <div className="flex items-center gap-3 overflow-hidden">
                            <div className="text-primary-600 dark:text-primary-400">
                                {commentFile.type.startsWith('image/') ? <ImageIcon size={20} /> : <FileText size={20} />}
                            </div>
                            <span className="text-sm font-medium truncate max-w-[200px]">{commentFile.name}</span>
                        </div>
                        <button type="button" onClick={() => setCommentFile(null)} className="p-1 hover:bg-red-50 text-slate-400 hover:text-red-500 transition rounded-full"><X size={18} /></button>
                    </div>
                )}

                <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                        <button 
                            type="button" 
                            onClick={() => commentFileInputRef.current?.click()}
                            className="p-2 text-slate-500 hover:text-primary-600 dark:text-slate-400 dark:hover:text-primary-400 bg-slate-100 dark:bg-zinc-800 rounded-lg transition"
                            title="Attach File"
                        >
                            <Paperclip size={20} />
                        </button>
                        <input 
                            type="file" 
                            ref={commentFileInputRef} 
                            className="hidden" 
                            onChange={(e) => setCommentFile(e.target.files?.[0] || null)}
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={(!newComment.trim() && !commentFile) || isUploadingCommentFile} 
                        className="bg-primary-600 text-white font-bold py-2.5 px-8 rounded-xl hover:bg-primary-700 transition disabled:opacity-50 shadow-md flex items-center gap-2"
                    >
                        {isUploadingCommentFile ? <Loader2 size={18} className="animate-spin" /> : null}
                        Post Comment
                    </button>
                </div>
            </form>
            <div className="space-y-4">{renderComments(null)}</div>
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border dark:border-zinc-700 sticky top-24">
             <div className="relative group overflow-hidden rounded-xl mb-6 shadow-sm border dark:border-zinc-800">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-64 object-cover transform group-hover:scale-105 transition duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
             </div>
             
             <div className="space-y-3">
                <div className="flex gap-2">
                    <button onClick={handleUpvoteClick} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition font-black text-sm tracking-widest ${isUpvoted ? 'bg-green-600 text-white shadow-lg shadow-green-500/25' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <ThumbsUp size={18}/> UPVOTE {resource.upvotes || 0}
                    </button>
                    <button onClick={handleDownvoteClick} className={`py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition font-black text-sm tracking-widest ${isDownvoted ? 'bg-red-600 text-white shadow-lg shadow-red-500/25' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <ThumbsDown size={18}/> {resource.downvotes || 0}
                    </button>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => toggleSaveResource(resource.id)} className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition font-black text-sm tracking-widest ${isSaved ? 'text-amber-600 bg-amber-50 border border-amber-200 dark:bg-amber-900/20' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        <Bookmark size={18}/> {isSaved ? 'SAVED' : 'SAVE'}
                    </button>
                    <button onClick={() => setIsShareModalOpen(true)} className="p-3 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"><Share2 size={20}/></button>
                    {isAuthor && <button onClick={() => setIsDeleteConfirmOpen(true)} className="p-3 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl hover:bg-red-100 transition"><Trash2 size={20}/></button>}
                </div>
             </div>

             <div className="mt-8 pt-8 border-t border-slate-100 dark:border-zinc-700">
                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-4">Contributor</p>
                <button onClick={() => handleAuthorClick(resource.author.id)} className="flex items-center gap-4 text-left w-full hover:bg-slate-50 dark:hover:bg-zinc-800/50 p-2 -ml-2 rounded-xl transition-all">
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
            <div className="bg-white dark:bg-zinc-900 w-full max-w-6xl h-[90vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border dark:border-zinc-700">
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-900 p-8 rounded-2xl max-w-sm w-full text-center shadow-2xl border dark:border-zinc-700">
                <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600"><Trash2 size={40}/></div>
                <h3 className="text-2xl font-bold mb-2 dark:text-white">Delete?</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-8 text-sm">This action cannot be undone.</p>
                <div className="flex flex-col gap-3">
                  <button onClick={() => deleteResource(resource.id, resource.fileUrl)} className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition">Yes, Delete</button>
                  <button onClick={() => setIsDeleteConfirmOpen(false)} className="w-full py-3 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-xl font-bold">Cancel</button>
                </div>
            </div>
        </div>
      )}
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} resource={resource} />
    </div>
  );
};

export default ResourceDetailPage;
