
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, AlertCircle, FileType, Bookmark, BookmarkCheck, Share2, Trash2, UserPlus, UserMinus, Clock } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';
import FlashcardViewer from '../FlashcardViewer';
import QuizComponent from '../QuizComponent';
import ShareModal from '../ShareModal';
import ResourceCard from '../ResourceCard';
import Avatar from '../Avatar';
import { db } from '../../services/firebase';
import { collection, addDoc } from 'firebase/firestore';

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
          <div className="flex items-center gap-3 mt-3">
            <button
              onClick={() => user && !isOwnComment && handleCommentVote(resourceId, comment.id)}
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
            {user && !isOwnComment && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1.5 p-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
              >
                <MessageCircle size={14} /> Reply
              </button>
            )}
            {(isOwnComment || isAdmin) && (
               <>
                <button
                    onClick={() => setIsDeleteConfirmOpen(true)}
                    className={`flex items-center gap-1.5 p-2 text-sm font-semibold rounded-lg transition-colors ${isAdmin && !isOwnComment ? 'text-red-600 bg-red-50 hover:bg-red-100' : 'text-red-500 bg-white dark:bg-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/20'}`}
                    title={isAdmin && !isOwnComment ? "Admin Delete" : "Delete"}
                >
                    <Trash2 size={14} />
                    {isAdmin && !isOwnComment && <span className="text-[10px] font-bold">ADMIN</span>}
                </button>
                {isDeleteConfirmOpen && (
                    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                        <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Comment?</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to delete this comment?{isAdmin && !isOwnComment && " This action is taken as an administrator."}</p>
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
              <MarkdownToolbar textareaRef={replyTextareaRef} value={replyText} onValueChange={setReplyText} />
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
                <button type="submit" className="bg-primary-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-primary-700 transition text-sm">Post Reply</button>
                <button type="button" onClick={() => setIsReplying(false)} className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 font-semibold py-1 px-3 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition text-sm">Cancel</button>
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
  const { user, userRanks, setView, handleVote, addCommentToResource, goBack, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, resources, deleteResource, scrollTargetId, setScrollTargetId } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [newComment, setNewComment] = useState('');
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
  const [studySet, setStudySet] = useState<(Flashcard[] | QuizQuestion[]) | null>(null);
  const [studySetType, setStudySetType] = useState<'flashcards' | 'quiz' | null>(null);
  const [isGeneratingStudySet, setIsGeneratingStudySet] = useState(false);

  const authorRank = userRanks.get(resource.author.id);
  const isFollowingLecturer = user?.subscriptions.lecturers.includes(resource.lecturer || '');
  const isFollowingCourse = user?.subscriptions.courseCodes.includes(resource.courseCode);
  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const isAdmin = user?.isAdmin;

  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  useEffect(() => {
      if (scrollTargetId) {
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
    setSummary(''); setIsSummarizing(false); setStudySet(null); setStudySetType(null); setIsGeneratingStudySet(false);
    setNewComment(''); setIsReporting(false); setReportReason(''); setHasReported(false); setIsPreviewOpen(false);
    setRelatedStartIndex(0); setAiGeneratedPreview(''); setIsGeneratingPreview(false);
  }, [resource.id]);

  const isAISupported = useMemo(() => !!resource.mimeType, [resource.mimeType]);

  const commentsByParentId = useMemo(() => {
    const group: Record<string, Comment[]> = {};
    for (const comment of resource.comments) {
        const parentId = comment.parentId || 'root';
        if (!group[parentId]) group[parentId] = [];
        group[parentId].push(comment);
    }
    for (const parentId in group) group[parentId].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return group;
  }, [resource.comments]);

  const relatedResources = useMemo(() => {
    const candidates = resources.filter(r => r.id !== resource.id);
    let matches = candidates.filter(r => r.courseCode === resource.courseCode);
    if (matches.length < 8) {
        const subjectMatch = resource.courseCode.match(/^[A-Za-z]+/);
        if (subjectMatch) {
            const subject = subjectMatch[0];
            const subjectMatches = candidates.filter(r => r.courseCode.startsWith(subject) && !matches.includes(r));
            matches = [...matches, ...subjectMatches];
        }
    }
    if (matches.length < 8) {
        const typeMatches = candidates.filter(r => r.type === resource.type && !matches.includes(r));
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
    } catch (error) { return undefined; }
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true); setSummary('');
    let base64;
    if (!resource.extractedText) base64 = await resolveFileBase64();
    if (!base64 && !resource.extractedText && resource.fileUrl !== '#') {
        setSummary("⚠️ **Content Access Error**");
        setIsSummarizing(false);
        return;
    }
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}\nType: ${resource.type}\n`;
    if (!base64 && !resource.extractedText && resource.fileUrl === '#') textContext += `\n[Mock Content]:\n${resource.contentForAI}`;
    const result = await summarizeContent(textContext, base64, resource.mimeType, resource.extractedText);
    setSummary(result); setIsSummarizing(false);
  };

  const handleGeneratePreview = async () => {
    if (!isAISupported) return;
    setIsGeneratingPreview(true);
    let base64;
    if (!resource.extractedText) base64 = await resolveFileBase64();
    if (!base64 && !resource.extractedText && resource.fileUrl !== '#') {
        setAiGeneratedPreview("⚠️ **Content Access Error**");
        setIsGeneratingPreview(false);
        return;
    }
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}\nType: ${resource.type}\n`;
    if (!base64 && !resource.extractedText && resource.fileUrl === '#') textContext += `\n[Mock Content]:\n${resource.contentForAI}`;
    const result = await summarizeContent(textContext, base64, resource.mimeType, resource.extractedText);
    setAiGeneratedPreview(result); setIsGeneratingPreview(false);
  };

  const handleGenerateStudySet = async (type: 'flashcards' | 'quiz') => {
    setIsGeneratingStudySet(true); setStudySet(null); setStudySetType(type);
    let base64;
    if (!resource.extractedText) base64 = await resolveFileBase64();
    if (!base64 && !resource.extractedText && resource.fileUrl !== '#') {
        setStudySet([]); setIsGeneratingStudySet(false);
        return;
    }
    let textContext = `Title: ${resource.title}\nCourse: ${resource.courseCode}\nType: ${resource.type}\n`;
    if (!base64 && !resource.extractedText && resource.fileUrl === '#') textContext += `\n[Mock Content]:\n${resource.contentForAI}`;
    const result = await generateStudySet(textContext, type, base64, resource.mimeType, resource.extractedText);
    setStudySet(result); setIsGeneratingStudySet(false);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && user) {
      addCommentToResource(resource.id, newComment, null);
      setNewComment('');
    }
  };

  const handleSubmitReport = async () => {
    if (reportReason.trim() !== "") {
      await addDoc(collection(db, "reports"), {
          resourceId: resource.id,
          resourceTitle: resource.title,
          uploaderId: resource.author.id,
          uploaderName: resource.author.name,
          reporterId: user?.id || 'anonymous',
          reporterName: user?.name || 'Anonymous',
          reason: reportReason,
          timestamp: new Date().toISOString(),
          status: 'pending'
      });
      setIsReporting(false); setReportReason(''); setHasReported(true);
    }
  };

  const getBadgeStyle = (type: ResourceType) => {
    switch (type) {
        case ResourceType.PastPaper: return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
        case ResourceType.Notes: return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
        case ResourceType.Assignment: return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300';
        case ResourceType.Other: return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
        default: return 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-300';
    }
  };

  const getBadgeIcon = (type: ResourceType) => {
      switch (type) {
          case ResourceType.PastPaper: return <FileText size={16}/>;
          case ResourceType.Notes: return <Notebook size={16}/>;
          case ResourceType.Assignment: return <ClipboardList size={16}/>;
          default: return <Archive size={16}/>;
      }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition mb-6">
        <ArrowLeft size={20} /> Back to all resources
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-transparent dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${getBadgeStyle(resource.type)}`}>
                {getBadgeIcon(resource.type)} {resource.type}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{resource.courseCode}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{resource.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">{resource.courseName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-200 mt-4">{resource.description}</p>
            <div className="mt-6 flex flex-wrap gap-4">
                <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg"><p className="text-xs text-slate-500">Year</p><p className="font-bold">{resource.year}</p></div>
                <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg"><p className="text-xs text-slate-500">Semester</p><p className="font-bold">{resource.semester}</p></div>
                {resource.lecturer && <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg"><p className="text-xs text-slate-500">Lecturer</p><p className="font-bold">{resource.lecturer}</p></div>}
            </div>
            <div className="mt-6 pt-6 border-t dark:border-zinc-700 flex flex-col gap-3">
                <button onClick={() => setIsPreviewOpen(true)} className="w-full flex items-center justify-center gap-2 font-bold py-3 bg-slate-100 dark:bg-zinc-800 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition"><Eye size={18} /> Preview File</button>
                <a href={resource.fileUrl} download={resource.fileName} className="w-full flex items-center justify-center gap-2 font-bold py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition shadow-md"><Download size={18} /> Download</a>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">AI Summary</h3>
            {!summary && !isSummarizing && (
              <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg p-6 text-center">
                  <BrainCircuit className="mx-auto h-12 w-12 text-slate-400" />
                  <button onClick={handleGenerateSummary} disabled={!isAISupported} className="mt-4 bg-primary-600 text-white py-2 px-6 rounded-lg font-bold">Generate with Gemini</button>
              </div>
            )}
            {isSummarizing && <div className="p-6 text-center"><Loader2 className="animate-spin mx-auto text-primary-500" size={32} /></div>}
            {summary && <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg"><MarkdownRenderer content={summary} /></div>}
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Discussion</h3>
            <form onSubmit={handlePostComment} className="flex gap-4 mb-6">
              <Avatar src={user?.avatarUrl} alt={user?.name} className="w-10 h-10 shrink-0" />
              <div className="flex-grow">
                <MarkdownToolbar textareaRef={commentTextareaRef} value={newComment} onValueChange={setNewComment} />
                <textarea ref={commentTextareaRef} value={newComment} onChange={e => setNewComment(e.target.value)} rows={3} className="w-full bg-slate-100 dark:bg-zinc-800 p-3 rounded-b-lg focus:outline-none" placeholder="Add a comment..." />
                <button type="submit" className="mt-2 bg-primary-600 text-white px-4 py-2 rounded-lg font-bold float-right">Post</button>
              </div>
            </form>
            <div className="clear-both">
                {groupComments(resource.comments)['root']?.map(c => <CommentComponent key={c.id} comment={c} resourceId={resource.id} children={null} />)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md sticky top-24 border border-transparent dark:border-zinc-700">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-80 object-cover rounded-lg mb-6 shadow-sm" />
                <div className="flex gap-2">
                    <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 ${isUpvoted ? 'bg-green-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}><ThumbsUp size={18} /> {resource.upvotes}</button>
                    <button onClick={() => handleVote(resource.id, 'down')} className={`flex-1 py-3 rounded-lg flex items-center justify-center gap-2 ${isDownvoted ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600'}`}><ThumbsDown size={18} /> {resource.downvotes}</button>
                </div>
                <div className="mt-6 flex flex-col gap-2">
                    <button onClick={() => toggleSaveResource(resource.id)} className={`w-full py-3 rounded-lg flex items-center justify-center gap-2 ${isSaved ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-zinc-800'}`}>{isSaved ? <BookmarkCheck size={18}/> : <Bookmark size={18}/>} {isSaved ? 'Saved' : 'Save for later'}</button>
                    {(isAuthor || isAdmin) && (
                        <button onClick={() => setIsDeleteConfirmOpen(true)} className="w-full py-3 bg-red-50 text-red-600 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition">
                            <Trash2 size={18} /> 
                            {isAdmin && !isAuthor ? "Admin Delete" : "Delete Resource"}
                        </button>
                    )}
                </div>
                <div className="mt-6 pt-6 border-t dark:border-zinc-700 flex items-center gap-3">
                    <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-12 h-12" />
                    <div><p className="font-bold">{resource.author.name}</p><p className="text-xs text-slate-500">{resource.author.course}</p></div>
                </div>
            </div>
        </div>
      </div>

      {isDeleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-xl max-w-sm w-full text-center">
                <Trash2 size={48} className="text-red-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold mb-2">Delete Resource?</h3>
                <p className="text-slate-500 mb-6 text-sm">Are you sure? This action is irreversible.{isAdmin && !isAuthor && " You are deleting this as an admin."}</p>
                <div className="flex gap-4">
                    <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 rounded-lg">Cancel</button>
                    <button onClick={() => deleteResource(resource.id, resource.fileUrl, resource.previewImageUrl)} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

function groupComments(comments: Comment[]) {
    const g: Record<string, Comment[]> = { root: [] };
    comments.forEach(c => {
        const pid = c.parentId || 'root';
        if (!g[pid]) g[pid] = [];
        g[pid].push(c);
    });
    return g;
}

export default ResourceDetailPage;
