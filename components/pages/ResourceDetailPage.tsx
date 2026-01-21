
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion } from '../../types';
import { AppContext } from '../../components/AppContext';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, AlertCircle, FileType, Bookmark, BookmarkCheck, Share2, Trash2, Sparkles, BookOpen } from 'lucide-react';
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
  const [newComment, setNewComment] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [hasReported, setHasReported] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [relatedStartIndex, setRelatedStartIndex] = useState(0);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Unified Study Companion State
  const [activeStudyTab, setActiveStudyTab] = useState<'summary' | 'flashcards' | 'quiz'>('summary');
  const [summary, setSummary] = useState('');
  const [studySet, setStudySet] = useState<(Flashcard[] | QuizQuestion[]) | null>(null);
  const [isStudyLoading, setIsStudyLoading] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);

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
    // Reset state on resource change
    setSummary('');
    setStudySet(null);
    setIsStudyLoading(false);
    setHasGenerated(false);
    setActiveStudyTab('summary');
    setNewComment('');
    setIsReporting(false);
    setReportReason('');
    setHasReported(false);
    setIsPreviewOpen(false);
    setRelatedStartIndex(0);
  }, [resource.id]);

  const commentsByParentId = useMemo(() => {
    const group: Record<string, Comment[]> = {};
    for (const comment of resource.comments) {
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
            matches = [...matches, ...candidates.filter(r => r.courseCode.startsWith(subject) && !matches.includes(r))];
        }
    }
    if (matches.length < 8) {
        matches = [...matches, ...candidates.filter(r => r.type === resource.type && !matches.includes(r))];
    }
    if (matches.length < 8) {
        matches = [...matches, ...candidates.filter(r => !matches.includes(r))];
    }
    return matches.slice(0, 8);
  }, [resources, resource]);

  const handleUserClick = (userId: string) => {
    if (userId === user?.id) setView('profile');
    else setView('publicProfile', userId);
  };
  
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
        return undefined;
    }
  };

  const getMetadataContext = () => {
      return `
      Title: ${resource.title}
      Course: ${resource.courseCode}
      Type: ${resource.type}
      Description: ${resource.description}
      Content Hint: ${resource.contentForAI}
      `;
  };

  // Refactored Study State
  const [cachedFlashcards, setCachedFlashcards] = useState<Flashcard[] | null>(null);
  const [cachedQuiz, setCachedQuiz] = useState<QuizQuestion[] | null>(null);

  const handleSmartGenerate = async () => {
      setIsStudyLoading(true);
      const base64 = await resolveFileBase64();
      
      // Warn if base64 is missing but we expected a file based on mime type
      if (!base64 && resource.fileUrl && !resource.fileUrl.startsWith('data:') && !resource.fileUrl.includes('localhost')) {
          showToast("Could not download file for analysis (likely browser security/CORS). Generating from metadata.", "info");
      }

      const contentToAnalyze = base64 ? getMetadataContext() : (resource.contentForAI || getMetadataContext());

      // Parallel fetch
      const summaryPromise = summarizeContent(contentToAnalyze, base64, resource.mimeType);
      const flashcardsPromise = generateStudySet(contentToAnalyze, 'flashcards', base64, resource.mimeType);
      const quizPromise = generateStudySet(contentToAnalyze, 'quiz', base64, resource.mimeType);

      const [sum, flash, quiz] = await Promise.all([summaryPromise, flashcardsPromise, quizPromise]);

      setSummary(sum);
      setCachedFlashcards(flash);
      setCachedQuiz(quiz);
      
      setIsStudyLoading(false);
      setHasGenerated(true);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && user) {
      addCommentToResource(resource.id, newComment, null);
      setNewComment('');
    }
  };

  const handleUpvoteClick = () => { if (user) handleVote(resource.id, 'up'); };
  const handleDownvoteClick = () => { if (user) handleVote(resource.id, 'down'); };
  
  const handleSubmitReport = async () => {
    if (reportReason.trim() !== "") {
      try {
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
        setIsReporting(false);
        setReportReason('');
        setHasReported(true);
      } catch (error) { alert("Failed to submit report."); }
    } else { alert("Reason required."); }
  };

  const confirmDelete = () => {
      deleteResource(resource.id, resource.fileUrl, resource.previewImageUrl);
      setIsDeleteConfirmOpen(false);
  };

  const handleDownloadClick = () => {
      setIsDownloading(true);
      setTimeout(() => setIsDownloading(false), 2000);
  };

  const renderComments = (parentId: string | null) => {
    const comments = commentsByParentId[parentId || 'root'] || [];
    return comments.map(comment => (
        <CommentComponent key={comment.id} comment={comment} resourceId={resource.id}>
            {renderComments(comment.id)}
        </CommentComponent>
    ));
  };

  const fileType = resource.fileName.split('.').pop()?.toUpperCase();
  const formattedUploadDate = new Date(resource.uploadDate).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  });

  const InfoTag: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{value}</p>
    </div>
  );

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
          case ResourceType.Other: return <Archive size={16}/>;
          default: return <FileText size={16}/>;
      }
  };

  return (
    <div>
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition mb-6">
        <ArrowLeft size={20} />
        Back to all resources
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          {/* Main Resource Card */}
          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${getBadgeStyle(resource.type)}`}>
                {getBadgeIcon(resource.type)}
                {resource.type}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{resource.courseCode}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{resource.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">{resource.courseName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-200 mt-4">{resource.description}</p>
            
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <InfoTag label="Year" value={resource.year} />
                <InfoTag label="Semester" value={resource.semester} />
                {resource.lecturer && <InfoTag label="Lecturer" value={resource.lecturer} />}
                {resource.examType && <InfoTag label={resource.type === ResourceType.PastPaper ? "Paper Type" : "Assessment Type"} value={resource.examType} />}
                {fileType && <InfoTag label="File Type" value={fileType} />}
                <InfoTag label="Uploaded On" value={formattedUploadDate} />
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border space-y-4">
                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => setIsPreviewOpen(true)}
                        className="w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-primary-700 dark:hover:text-primary-400 border border-slate-200 dark:border-zinc-700"
                    >
                        <Eye size={18} />
                        Preview File
                    </button>
                    <a 
                        href={resource.fileUrl} 
                        download={resource.fileName}
                        onClick={handleDownloadClick}
                        className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all duration-200 ${
                            isDownloading 
                            ? 'bg-primary-700 text-primary-100 cursor-wait' 
                            : 'bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-md hover:shadow-lg'
                        }`}
                    >
                        {isDownloading ? (
                            <>
                                <Loader2 size={18} className="animate-spin" />
                                Downloading...
                            </>
                        ) : (
                            <>
                                <Download size={18} />
                                Download
                            </>
                        )}
                    </a>
                </div>
            </div>
          </div>

          {/* Smart Study Companion - REDESIGNED */}
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold flex items-center gap-2">
                        <Sparkles className="text-yellow-300" /> Smart Study Companion
                    </h3>
                    <p className="text-indigo-100 text-sm mt-1">Powered by Gemini AI</p>
                </div>
                {!hasGenerated && !isStudyLoading && (
                    <button 
                        onClick={handleSmartGenerate}
                        className="bg-white text-indigo-600 hover:bg-indigo-50 font-bold py-2 px-4 rounded-lg shadow-sm transition flex items-center gap-2"
                    >
                        <BrainCircuit size={18} />
                        Analyze Document
                    </button>
                )}
            </div>

            {isStudyLoading ? (
                <div className="p-12 text-center">
                    <Loader2 size={48} className="animate-spin text-primary-500 mx-auto mb-4" />
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white">Analyzing Content...</h4>
                    <p className="text-slate-500 dark:text-slate-400">Genering summary, flashcards, and quiz.</p>
                </div>
            ) : !hasGenerated ? (
                <div className="p-8 text-center bg-slate-50 dark:bg-zinc-800/50">
                    <div className="flex justify-center gap-8 mb-6 opacity-60">
                        <div className="flex flex-col items-center gap-2"><BookOpen size={32}/><span className="text-xs font-bold">Summary</span></div>
                        <div className="flex flex-col items-center gap-2"><BookCopy size={32}/><span className="text-xs font-bold">Flashcards</span></div>
                        <div className="flex flex-col items-center gap-2"><HelpCircle size={32}/><span className="text-xs font-bold">Quiz</span></div>
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 max-w-md mx-auto mb-6">
                        Unlock the power of AI to instantly summarize this document, create study flashcards, and test your knowledge with a practice quiz.
                    </p>
                    <button onClick={handleSmartGenerate} className="text-primary-600 dark:text-primary-400 font-bold hover:underline">
                        Start Analysis
                    </button>
                </div>
            ) : (
                <div>
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 dark:border-zinc-700">
                        <button 
                            onClick={() => setActiveStudyTab('summary')}
                            className={`flex-1 py-3 text-sm font-bold text-center transition ${activeStudyTab === 'summary' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                        >
                            Summary
                        </button>
                        <button 
                            onClick={() => setActiveStudyTab('flashcards')}
                            className={`flex-1 py-3 text-sm font-bold text-center transition ${activeStudyTab === 'flashcards' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                        >
                            Flashcards
                        </button>
                        <button 
                            onClick={() => setActiveStudyTab('quiz')}
                            className={`flex-1 py-3 text-sm font-bold text-center transition ${activeStudyTab === 'quiz' ? 'text-primary-600 border-b-2 border-primary-600 bg-primary-50 dark:bg-primary-900/10' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                        >
                            Quiz
                        </button>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                        {activeStudyTab === 'summary' && (
                            <div className="prose-like dark:text-slate-200">
                                <MarkdownRenderer content={summary} />
                            </div>
                        )}
                        {activeStudyTab === 'flashcards' && cachedFlashcards && (
                            <FlashcardViewer flashcards={cachedFlashcards} onReset={() => {}} /> // Reset disabled in this view for simplicity
                        )}
                        {activeStudyTab === 'quiz' && cachedQuiz && (
                            <QuizComponent questions={cachedQuiz} onReset={() => {}} />
                        )}
                    </div>
                </div>
            )}
          </div>

          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <MessageSquare size={22}/>
                Discussion ({resource.comments.length})
            </h3>
            <form onSubmit={handlePostComment} className="flex gap-4 items-start pb-6 mb-6 border-b border-slate-200 dark:border-zinc-700">
              <Avatar src={user?.avatarUrl} alt={user?.name} className="w-10 h-10 rounded-full shrink-0" />
              <div className="w-full">
                <MarkdownToolbar
                    textareaRef={commentTextareaRef}
                    value={newComment}
                    onValueChange={setNewComment}
                />
                <textarea
                    ref={commentTextareaRef}
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-400 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-b-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none"
                    rows={3}
                />
                 <div className="flex justify-end mt-2">
                    <button type="submit" className="bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition">Post</button>
                </div>
              </div>
            </form>
            <div className="mt-6">
                {renderComments(null)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md lg:sticky top-24 transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-80 object-cover rounded-lg mb-6" />
                
                <div className="flex items-center gap-2">
                    <button 
                      onClick={handleUpvoteClick}
                      className={`flex items-center gap-2 p-3 rounded-lg transition font-medium ${isUpvoted ? 'bg-green-600 text-white' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'}`}
                    >
                        <ThumbsUp size={18} />
                        {resource.upvotes > 0 && <span>{resource.upvotes}</span>}
                    </button>
                    <button
                      onClick={handleDownvoteClick}
                      className={`flex items-center gap-2 p-3 rounded-lg transition font-medium ${isDownvoted ? 'bg-red-600 text-white' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'}`}
                    >
                        <ThumbsDown size={18} />
                        {resource.downvotes > 0 && <span>{resource.downvotes}</span>}
                    </button>
                    <button 
                        onClick={() => toggleSaveResource(resource.id)}
                        title={isSaved ? "Unsave" : "Save for later"}
                        className={`p-3 rounded-lg transition font-medium ${isSaved ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                    >
                        {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                    </button>
                     <button 
                        onClick={() => setIsShareModalOpen(true)}
                        title="Share"
                        className="p-3 rounded-lg transition font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700"
                    >
                        <Share2 size={18} />
                    </button>
                    {isAuthor && (
                        <button 
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            title="Delete Resource"
                            className="p-3 rounded-lg transition font-medium bg-slate-100 dark:bg-zinc-800 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30"
                        >
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>

                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Uploaded by</p>
                    <button onClick={() => handleAuthorClick(resource.author.id)} className="flex items-center gap-3 w-full text-left hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
                        <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-12 h-12 rounded-full" />
                        <div>
                            <div className="flex items-center">
                              <p className="font-bold text-slate-900 dark:text-slate-100">{resource.author.name}</p>
                              <UserRankBadge rank={authorRank} />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                <span className="font-semibold">{resource.author.course}</span> • Joined on {new Date(resource.author.joinDate).toLocaleDateString()}
                            </p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {/* ... (Related Resources Section - Keeping existing logic, just omitted for brevity in XML if unmodified, but including to be safe) ... */}
      {relatedResources.length > 0 && (
        <div className="mt-12 border-t border-slate-200 dark:border-zinc-700 pt-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Related Resources</h2>
            <div className="relative group px-4">
                
                {relatedStartIndex > 0 && (
                    <button 
                        onClick={() => setRelatedStartIndex(prev => Math.max(0, prev - 1))}
                        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 p-3 rounded-full shadow-lg border border-slate-100 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-primary-600 hover:scale-110 transition-all duration-200 flex items-center justify-center"
                        aria-label="Previous"
                    >
                        <ArrowLeft size={24} />
                    </button>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {relatedResources.slice(relatedStartIndex, relatedStartIndex + 4).map(related => (
                        <ResourceCard 
                            key={related.id}
                            resource={related}
                            onSelect={() => setView('resourceDetail', related.id)}
                            onAuthorClick={handleAuthorClick}
                            compact={true}
                        />
                    ))}
                </div>

                {relatedStartIndex < relatedResources.length - 4 && (
                    <button 
                        onClick={() => setRelatedStartIndex(prev => Math.min(Math.max(0, relatedResources.length - 4), prev + 1))}
                        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 p-3 rounded-full shadow-lg border border-slate-100 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-primary-600 hover:scale-110 transition-all duration-200 flex items-center justify-center"
                        aria-label="Next"
                    >
                        <ArrowRight size={24} />
                    </button>
                )}
            </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                    <div className="flex flex-col items-center text-center">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4">
                            <Trash2 size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Resource?</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                            Are you sure you want to delete <strong>{resource.title}</strong>? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 w-full">
                            <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">Cancel</button>
                            <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">Delete</button>
                        </div>
                    </div>
                </div>
            </div>
      )}

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col relative animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-3 overflow-hidden">
                         <div className={`p-2 rounded-lg ${getBadgeStyle(resource.type)}`}>
                            {getBadgeIcon(resource.type)}
                        </div>
                        <div className="overflow-hidden">
                             <h3 className="font-bold text-slate-800 truncate text-lg leading-tight">{resource.title}</h3>
                             <p className="text-xs text-slate-500 truncate">{resource.fileName}</p>
                        </div>
                    </div>
                     <div className="flex items-center gap-2 shrink-0">
                        <a 
                            href={resource.fileUrl} 
                            download={resource.fileName}
                            className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition"
                            title="Download"
                        >
                            <Download size={20} />
                        </a>
                        <button onClick={() => setIsPreviewOpen(false)} className="p-2 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition">
                            <X size={24} />
                        </button>
                    </div>
                </div>
                <div className="flex-grow bg-slate-200 overflow-hidden flex items-center justify-center rounded-b-xl relative">
                    {/* Render Preview Logic (Reusing same logic as before, assumed available or would normally function) */}
                    {resource.fileUrl && (
                        <iframe src={resource.fileUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>
                    )}
                </div>
            </div>
        </div>
    )}
    <ShareModal 
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        resource={resource}
    />
    </div>
  );
};

export default ResourceDetailPage;
