
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
  const { user, userRanks, setView, handleVote, addCommentToResource, goBack, toggleUserSubscription, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, resources, deleteResource, scrollTargetId, setScrollTargetId } = useContext(AppContext);
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
    setIsReporting(false);
    setReportReason('');
    setHasReported(false);
    setIsPreviewOpen(false);
    setRelatedStartIndex(0);
    setAiGeneratedPreview('');
    setIsGeneratingPreview(false);
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
    // Filter out the current resource
    const candidates = resources.filter(r => r.id !== resource.id);
    
    // 1. Priority: Same Course Code
    let matches = candidates.filter(r => r.courseCode === resource.courseCode);
    
    // 2. Fallback: Same Subject Area
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

    // 3. Fallback: Same Resource Type
    if (matches.length < 8) {
        const typeMatches = candidates.filter(r => 
            r.type === resource.type && !matches.includes(r)
        );
        matches = [...matches, ...typeMatches];
    }
    
    // 4. Fallback: Any other resources
    if (matches.length < 8) {
        const otherMatches = candidates.filter(r => !matches.includes(r));
        matches = [...matches, ...otherMatches];
    }

    return matches.slice(0, 8);
  }, [resources, resource]);

  const handleUserClick = (userId: string) => {
    if (userId === user?.id) {
        setView('profile');
    } else {
        setView('publicProfile', userId);
    }
  };
  
  const handleAuthorClick = (authorId: string) => {
    if (authorId === user?.id) {
        setView('profile');
    } else {
        setView('publicProfile', authorId);
    }
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    setSummary('');
    // Pass the base64 content and mimeType if available
    const result = await summarizeContent(resource.contentForAI, resource.fileBase64, resource.mimeType);
    setSummary(result);
    setIsSummarizing(false);
  };
  
  const handleGeneratePreview = async () => {
    if (!resource.fileBase64) return;
    setIsGeneratingPreview(true);
    const result = await summarizeContent(resource.contentForAI, resource.fileBase64, resource.mimeType);
    setAiGeneratedPreview(result);
    setIsGeneratingPreview(false);
  };
  
  const handleGenerateStudySet = async (type: 'flashcards' | 'quiz') => {
    setIsGeneratingStudySet(true);
    setStudySet(null);
    setStudySetType(type);
    const result = await generateStudySet(resource.contentForAI, type, resource.fileBase64, resource.mimeType);
    setStudySet(result);
    setIsGeneratingStudySet(false);
  };

  const resetStudySet = () => {
      setStudySet(null);
      setStudySetType(null);
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.trim() && user) {
      addCommentToResource(resource.id, newComment, null);
      setNewComment('');
    }
  };

  const handleUpvoteClick = () => {
    if (!user) return;
    handleVote(resource.id, 'up');
  };

  const handleDownvoteClick = () => {
    if (!user) return;
    handleVote(resource.id, 'down');
  };
  
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
      } catch (error) {
        console.error("Error submitting report:", error);
        alert("Failed to submit report. Please try again.");
      }
    } else {
      alert("A reason is required to submit a report.");
    }
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

  const InfoTag: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{value}</p>
    </div>
  );

  const renderPreviewContent = () => {
    const isMock = resource.fileUrl === '#';
    const ext = resource.fileName.split('.').pop()?.toLowerCase();
    const isPdf = ext === 'pdf';
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
    const isOfficeDoc = ['ppt', 'pptx', 'doc', 'docx', 'xls', 'xlsx'].includes(ext || '');

    if (isMock) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                <AlertCircle size={64} className="text-amber-400 mb-4" />
                <h3 className="text-xl font-bold text-slate-800 mb-2">Preview Simulated</h3>
                <p className="text-slate-600 mb-6 max-w-md">
                    This is a mock resource entry. In a real application, the file would be displayed here.
                    Below is the extracted text content associated with this resource.
                </p>
                <div className="w-full max-w-3xl bg-white rounded-lg border border-slate-200 p-6 text-left h-96 overflow-y-auto shadow-inner">
                    <MarkdownRenderer content={resource.contentForAI} />
                </div>
            </div>
        );
    }

    if (isImage) {
        return <img src={resource.fileUrl} alt="Preview" className="max-w-full max-h-full object-contain" />;
    }

    if (isPdf) {
        return <iframe src={resource.fileUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>;
    }

    if (isOfficeDoc) {
        return (
            <iframe 
                src={`https://docs.google.com/gview?url=${encodeURIComponent(resource.fileUrl)}&embedded=true`} 
                className="w-full h-full border-none" 
                title="Office Document Preview" 
            />
        );
    }

    // Fallback for unsupported types
    const isPlaceholderContent = resource.contentForAI === "Content is in the file..." || !resource.contentForAI;
    const contentToDisplay = aiGeneratedPreview || (isPlaceholderContent ? null : resource.contentForAI);

    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <FileType size={64} className="text-slate-400 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Preview Unavailable</h3>
            <p className="text-slate-600 mb-6 max-w-md">
                This file type (<strong>.{ext}</strong>) cannot be displayed directly in the browser. 
                You can download it to view it locally, or use AI to generate a content summary below.
            </p>
            
            <div className="w-full max-w-3xl bg-white rounded-lg border border-slate-200 p-6 text-left h-96 overflow-y-auto shadow-inner relative flex flex-col">
                <div className="mb-4 pb-2 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-500">Content Overview</span>
                    </div>
                     {!contentToDisplay && resource.fileBase64 && !isGeneratingPreview && (
                        <button 
                            onClick={handleGeneratePreview}
                            className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded hover:bg-primary-100 font-semibold transition flex items-center gap-1"
                        >
                            <BrainCircuit size={12} />
                            Generate with AI
                        </button>
                    )}
                </div>
                
                <div className="flex-grow overflow-y-auto">
                    {isGeneratingPreview ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400">
                            <Loader2 size={32} className="animate-spin mb-2 text-primary-500" />
                            <p className="text-sm">Analyzing document...</p>
                        </div>
                    ) : contentToDisplay ? (
                        <MarkdownRenderer content={contentToDisplay} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                            <p className="italic mb-4">No text preview available.</p>
                            {resource.fileBase64 ? (
                                 <button 
                                    onClick={handleGeneratePreview}
                                    className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition font-semibold text-sm shadow-sm"
                                >
                                    <BrainCircuit size={16} />
                                    Generate AI Summary
                                </button>
                            ) : (
                                <p className="text-xs text-slate-400">Upload a file with content to enable AI features.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
  };

  return (
    <div>
      <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition mb-6">
        <ArrowLeft size={20} />
        Back to all resources
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <span className={`flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full ${resource.type === ResourceType.PastPaper ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'}`}>
                {resource.type === ResourceType.PastPaper && <FileText size={16}/>}
                {resource.type === ResourceType.Notes && <Notebook size={16}/>}
                {resource.type === ResourceType.Assignment && <ClipboardList size={16}/>}
                {resource.type === ResourceType.Other && <Archive size={16}/>}
                {resource.type}
              </span>
              <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{resource.courseCode}</span>
            </div>
            
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{resource.title}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mt-1">{resource.courseName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-200 mt-4">{resource.description}</p>
            
            <div className="mt-6 grid grid-cols-2 md:grid-cols-5 gap-4">
                <InfoTag label="Year" value={resource.year} />
                <InfoTag label="Semester" value={resource.semester} />
                {resource.lecturer && <InfoTag label="Lecturer" value={resource.lecturer} />}
                {resource.examType && <InfoTag label="Paper Type" value={resource.examType} />}
                {fileType && <InfoTag label="File Type" value={fileType} />}
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border space-y-4">
                <div>
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Stay Updated</h4>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => toggleCourseCodeSubscription(resource.courseCode)}
                            className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg transition ${isFollowingCourse ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                        >
                            {isFollowingCourse ? <BellOff size={16} /> : <Bell size={16} />}
                            <span>{isFollowingCourse ? 'Unfollow Course' : 'Follow Course'}</span>
                        </button>
                        {resource.lecturer && (
                             <button 
                                onClick={() => toggleLecturerSubscription(resource.lecturer!)}
                                className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg transition ${isFollowingLecturer ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                             >
                                {isFollowingLecturer ? <BellOff size={16} /> : <Bell size={16} />}
                                <span>{isFollowingLecturer ? 'Unfollow Lecturer' : 'Follow Lecturer'}</span>
                            </button>
                        )}
                    </div>
                </div>
                
                <div className="flex flex-col gap-3 !mt-6">
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
                
                {hasReported ? (
                     <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center flex flex-col items-center gap-2">
                        <CheckCircle className="text-green-600 dark:text-green-400" size={24}/>
                        <div>
                            <h4 className="font-bold text-green-800 dark:text-green-200">Report Submitted</h4>
                            <p className="text-sm text-green-700 dark:text-green-300 mt-1">Thank you. Our moderators will review this shortly.</p>
                        </div>
                    </div>
                ) : !isReporting ? (
                    <div className="flex flex-col gap-2">
                         <button
                            onClick={() => setIsReporting(true)}
                            className="w-full flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 font-semibold py-2 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-slate-200 transition text-sm"
                        >
                            <Flag size={16} className="text-red-500"/>
                            Report this resource
                        </button>
                    </div>
                ) : (
                    <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700">
                        <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Report Resource</h4>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Please provide a reason for reporting this content. Your report is anonymous.</p>
                        <textarea
                            value={reportReason}
                            onChange={(e) => setReportReason(e.target.value)}
                            placeholder="e.g., Incorrect information, offensive content, spam..."
                            className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none"
                            rows={3}
                            autoFocus
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button 
                                onClick={() => setIsReporting(false)}
                                className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={handleSubmitReport}
                                className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition"
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                )}
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">AI Summary</h3>
            {!summary && !isSummarizing && (
              <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg p-6 text-center">
                  <BrainCircuit className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                  <p className="mt-2 text-slate-600 dark:text-slate-400">Get a quick overview of this document.</p>
                  <button onClick={handleGenerateSummary} className="mt-4 inline-flex items-center gap-2 bg-primary-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-primary-700 transition">
                      <BrainCircuit size={18} />
                      Generate with Gemini
                  </button>
              </div>
            )}
            {isSummarizing && (
               <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-6 text-center">
                  <Loader2 className="mx-auto h-12 w-12 text-primary-500 animate-spin" />
                  <p className="mt-4 text-slate-600 dark:text-slate-300 font-medium">Gemini is thinking...</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Analyzing document structure and content...</p>
               </div>
            )}
            {summary && (
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-6 rounded-lg border border-slate-200 dark:border-zinc-700">
                    <MarkdownRenderer content={summary} />
                </div>
            )}
          </div>

          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
             <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Interactive Study Tools</h3>
             </div>
             
             {!studySet && !isGeneratingStudySet && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button 
                        onClick={() => handleGenerateStudySet('flashcards')}
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition group"
                    >
                        <BookCopy className="w-8 h-8 text-slate-400 group-hover:text-primary-500 mb-2 transition-colors" />
                        <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">Generate Flashcards</span>
                        <span className="text-xs text-slate-500 dark:text-slate-500 mt-1">Create study cards from content</span>
                    </button>
                    <button 
                        onClick={() => handleGenerateStudySet('quiz')}
                        className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition group"
                    >
                        <HelpCircle className="w-8 h-8 text-slate-400 group-hover:text-primary-500 mb-2 transition-colors" />
                        <span className="font-bold text-slate-700 dark:text-slate-300 group-hover:text-primary-600 dark:group-hover:text-primary-400">Generate Quiz</span>
                        <span className="text-xs text-slate-500 dark:text-slate-500 mt-1">Test your knowledge</span>
                    </button>
                </div>
             )}

             {isGeneratingStudySet && (
                <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-8 text-center">
                    <Loader2 className="mx-auto h-12 w-12 text-primary-500 animate-spin" />
                    <p className="mt-4 text-slate-600 dark:text-slate-300 font-medium">Creating {studySetType}...</p>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">This may take a moment.</p>
                </div>
             )}

             {studySet && studySetType === 'flashcards' && (
                <FlashcardViewer flashcards={studySet as Flashcard[]} onReset={resetStudySet} />
             )}
             
             {studySet && studySetType === 'quiz' && (
                <QuizComponent questions={studySet as QuizQuestion[]} onReset={resetStudySet} />
             )}

          </div>

          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Comments ({resource.comments.length})</h3>
            
            <form onSubmit={handlePostComment} className="flex gap-4 items-start mb-8">
                <Avatar src={user?.avatarUrl} alt={user?.name || 'User'} className="w-10 h-10" />
                <div className="flex-grow">
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
                        className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-b-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none"
                        rows={3}
                    />
                    <div className="flex justify-end mt-2">
                        <button type="submit" className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition">
                            Post Comment
                        </button>
                    </div>
                </div>
            </form>

            <div className="space-y-6">
                {renderComments(null)}
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-transparent dark:border-zinc-700">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">About the Author</h3>
                <div 
                    onClick={() => handleAuthorClick(resource.author.id)}
                    className="flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 -mx-2 rounded-lg transition"
                >
                    <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-14 h-14" />
                    <div>
                        <div className="flex items-center gap-2">
                             <p className="font-bold text-slate-900 dark:text-white text-lg">{resource.author.name}</p>
                             <UserRankBadge rank={authorRank} />
                        </div>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">{resource.author.course}</p>
                    </div>
                </div>
                
                <div className="flex gap-2 mt-4">
                     <button 
                        onClick={() => toggleUserSubscription(resource.author.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-semibold text-sm transition ${user?.subscriptions.users.includes(resource.author.id) ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                    >
                         {user?.subscriptions.users.includes(resource.author.id) ? <UserMinus size={16}/> : <UserPlus size={16}/>}
                         {user?.subscriptions.users.includes(resource.author.id) ? 'Unfollow' : 'Follow'}
                     </button>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-transparent dark:border-zinc-700">
                 <h3 className="font-bold text-slate-800 dark:text-white mb-4">Resource Stats</h3>
                 <div className="flex items-center justify-around py-2">
                     <div className="text-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full mx-auto mb-1 text-slate-600 dark:text-slate-400">
                            <ThumbsUp size={20} />
                        </div>
                        <span className="block font-bold text-slate-800 dark:text-white text-lg">{resource.upvotes}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Upvotes</span>
                     </div>
                     <div className="text-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full mx-auto mb-1 text-slate-600 dark:text-slate-400">
                            <MessageSquare size={20} />
                        </div>
                         <span className="block font-bold text-slate-800 dark:text-white text-lg">{resource.comments.length}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Comments</span>
                     </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center w-10 h-10 bg-slate-100 dark:bg-zinc-800 rounded-full mx-auto mb-1 text-slate-600 dark:text-slate-400">
                             <Clock size={20} />
                        </div>
                         <span className="block font-bold text-slate-800 dark:text-white text-lg">{new Date(resource.uploadDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                        <span className="text-xs text-slate-500 dark:text-slate-400">Uploaded</span>
                     </div>
                 </div>

                 <div className="flex flex-col gap-2 mt-6">
                    <button 
                         onClick={handleUpvoteClick}
                         className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition ${isUpvoted ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                    >
                        <ThumbsUp size={18} />
                        {isUpvoted ? 'Upvoted' : 'Upvote Resource'}
                    </button>
                    <button 
                        onClick={handleDownvoteClick}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition ${isDownvoted ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                    >
                        <ThumbsDown size={18} />
                        Downvote
                    </button>
                    <button
                        onClick={() => toggleSaveResource(resource.id)}
                        className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition ${isSaved ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                    >
                        {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                        {isSaved ? 'Saved' : 'Save for later'}
                    </button>
                    <button 
                        onClick={() => setIsShareModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                    >
                        <Share2 size={18} />
                        Share
                    </button>
                    {isAuthor && (
                         <button 
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg font-semibold bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition mt-2"
                        >
                            <Trash2 size={18} />
                            Delete Resource
                        </button>
                    )}
                 </div>
            </div>

            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-transparent dark:border-zinc-700">
                <h3 className="font-bold text-slate-800 dark:text-white mb-4">Related Resources</h3>
                <div className="space-y-4">
                     {relatedResources.slice(relatedStartIndex, relatedStartIndex + 4).map(rel => (
                         <div key={rel.id} className="cursor-pointer group" onClick={() => setView('resourceDetail', rel.id)}>
                             <div className="flex gap-3">
                                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-200 dark:bg-zinc-800">
                                    <img src={rel.previewImageUrl} alt={rel.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-0.5">{rel.courseCode}</p>
                                    <h4 className="text-sm font-bold text-slate-800 dark:text-white line-clamp-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">{rel.title}</h4>
                                </div>
                             </div>
                         </div>
                     ))}
                     {relatedResources.length === 0 && (
                         <p className="text-sm text-slate-500 dark:text-slate-400">No related resources found.</p>
                     )}
                </div>
                 {relatedResources.length > 4 && (
                    <div className="flex justify-between mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
                         <button 
                            disabled={relatedStartIndex === 0}
                            onClick={() => setRelatedStartIndex(prev => Math.max(0, prev - 4))}
                            className="text-sm font-semibold text-primary-600 dark:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
                        >
                             Previous
                         </button>
                         <button 
                            disabled={relatedStartIndex + 4 >= relatedResources.length}
                            onClick={() => setRelatedStartIndex(prev => Math.min(relatedResources.length - 1, prev + 4))}
                            className="text-sm font-semibold text-primary-600 dark:text-primary-400 disabled:opacity-50 disabled:cursor-not-allowed hover:underline"
                        >
                             Next
                         </button>
                    </div>
                 )}
            </div>
        </div>
      </div>
      
      {/* File Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white dark:bg-dark-surface w-full max-w-5xl h-[85vh] rounded-xl overflow-hidden flex flex-col relative">
                <div className="p-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center bg-white dark:bg-zinc-800">
                    <div>
                        <h3 className="font-bold text-slate-800 dark:text-white">{resource.fileName}</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Preview Mode</p>
                    </div>
                    <div className="flex gap-2">
                        <a 
                            href={resource.fileUrl} 
                            download={resource.fileName}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full transition"
                            title="Download"
                        >
                            <Download size={20} className="text-slate-600 dark:text-slate-300" />
                        </a>
                        <button onClick={() => setIsPreviewOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-full transition">
                            <X size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>
                </div>
                <div className="flex-grow bg-slate-100 dark:bg-zinc-900 overflow-auto">
                    {renderPreviewContent()}
                </div>
            </div>
        </div>
      )}

      {/* Share Modal */}
      <ShareModal 
        isOpen={isShareModalOpen} 
        onClose={() => setIsShareModalOpen(false)} 
        resource={resource} 
      />
      
      {/* Delete Confirmation Modal */}
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

    </div>
  );
};

export default ResourceDetailPage;
