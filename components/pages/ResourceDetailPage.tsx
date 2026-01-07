
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion, type Attachment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, AlertCircle, FileType, Bookmark, BookmarkCheck, Share2, Trash2, UserPlus, UserMinus, Clock, Paperclip, Image as ImageIcon } from 'lucide-react';
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
  onPreview: (attachment: Attachment) => void;
}> = ({ comment, resourceId, children, onPreview }) => {
  const { user, userRanks, setView, handleCommentVote, addCommentToResource, deleteCommentFromResource } = useContext(AppContext);
  const [isReplying, setIsReplying] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyFile, setReplyFile] = useState<File | undefined>(undefined);
  const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  
  const authorRank = userRanks.get(comment.author.id);
  const isUpvoted = comment.upvotedBy?.includes(user?.id || '');
  const isOwnComment = user?.id === comment.author.id;
  const canDelete = isOwnComment || user?.role === 'admin'; // Allow Admin to delete

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setReplyFile(file);
      }
  };

  const removeAttachment = () => {
      setReplyFile(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((replyText.trim() || replyFile) && user) {
      addCommentToResource(resourceId, replyText, comment.id, replyFile);
      setReplyText('');
      setReplyFile(undefined);
      setIsReplying(false);
    }
  };

  const handleDelete = () => {
      deleteCommentFromResource(resourceId, comment);
      setIsDeleteConfirmOpen(false);
  };

  return (
    <div id={comment.id} className="mt-4 scroll-mt-24 transition-colors duration-[2000ms] p-2 rounded-lg">
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

          {/* Comment Attachment */}
          {comment.attachment && (
              <div className="mt-3">
                  {comment.attachment.type === 'image' ? (
                      <button onClick={() => onPreview(comment.attachment!)} className="block cursor-zoom-in">
                          <img src={comment.attachment.url} alt="Attachment" className="max-h-40 rounded-lg border border-slate-200 dark:border-zinc-700 hover:opacity-90 transition" />
                      </button>
                  ) : (
                      <div className="flex items-center gap-2">
                          <button 
                              onClick={() => onPreview(comment.attachment!)}
                              className="flex items-center gap-3 p-2 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition w-fit group text-left"
                          >
                              <div className="p-1.5 bg-white dark:bg-zinc-900 rounded-md">
                                  <FileText size={20} className="text-primary-500" />
                              </div>
                              <div className="flex flex-col">
                                  <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">{comment.attachment.name}</span>
                                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{comment.attachment.size || 'File'}</span>
                              </div>
                              <Eye size={14} className="text-slate-400 group-hover:text-primary-500 ml-2" />
                          </button>
                          <a 
                              href={comment.attachment.url} 
                              download={comment.attachment.name}
                              className="p-2.5 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                              title="Download"
                          >
                              <Download size={18} />
                          </a>
                      </div>
                  )}
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
            {canDelete && (
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
              {replyFile && (
                  <div className="bg-slate-100 dark:bg-zinc-900 border-x border-slate-300 dark:border-zinc-700 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                          {replyFile.type.startsWith('image/') ? <ImageIcon size={16}/> : <FileText size={16}/>}
                          <span className="truncate max-w-xs">{replyFile.name}</span>
                        </div>
                        <button type="button" onClick={removeAttachment} className="text-slate-500 hover:text-red-500">
                          <X size={16} />
                        </button>
                  </div>
              )}
              <textarea
                ref={replyTextareaRef}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder={`Replying to ${comment.author.name}...`}
                className={`w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 ${replyFile ? 'border-t-0' : ''} rounded-b-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none`}
                rows={2}
                autoFocus
              />
              <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  onChange={handleFileSelect}
              />
              <div className="flex gap-2 mt-2 items-center">
                <button type="submit" className="bg-primary-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-primary-700 transition text-sm">
                  Post Reply
                </button>
                <button type="button" onClick={() => fileInputRef.current?.click()} className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 p-1.5 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition" title="Attach file">
                    <Paperclip size={16} />
                </button>
                <button type="button" onClick={() => setIsReplying(false)} className="ml-auto bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 font-semibold py-1 px-3 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition text-sm">
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
  const { user, userRanks, setView, handleVote, addCommentToResource, goBack, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, resources, deleteResource, scrollTargetId, setScrollTargetId } = useContext(AppContext);
  // ... state ...
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [newCommentFile, setNewCommentFile] = useState<File | undefined>(undefined);
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
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const authorRank = userRanks.get(resource.author.id);
  const isFollowingLecturer = user?.subscriptions.lecturers.includes(resource.lecturer || '');
  const isFollowingCourse = user?.subscriptions.courseCodes.includes(resource.courseCode);
  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const canDelete = isAuthor || user?.role === 'admin'; // Allow Admin to delete

  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  // Enhanced Deep Linking with Retry Logic
  useEffect(() => {
      if (scrollTargetId) {
          const tryScroll = (attempts: number) => {
              const targetElement = document.getElementById(scrollTargetId);
              if (targetElement) {
                  // Element found, wait a tick for layout stability
                  setTimeout(() => {
                      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      
                      // Add highlight class immediately
                      targetElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/40', 'ring-2', 'ring-yellow-400', 'dark:ring-yellow-600');
                      
                      // Trigger fade out after 2.5 seconds
                      setTimeout(() => {
                          targetElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/40', 'ring-2', 'ring-yellow-400', 'dark:ring-yellow-600');
                          setScrollTargetId(null);
                      }, 2500);
                  }, 100);
              } else if (attempts > 0) {
                  // Retry if element not found (e.g. comments loading)
                  setTimeout(() => tryScroll(attempts - 1), 500);
              }
          };
          
          tryScroll(5); // Try 5 times over ~2.5 seconds
      }
  }, [scrollTargetId, resource.comments, setScrollTargetId]);

  useEffect(() => {
    setSummary('');
    setIsSummarizing(false);
    setStudySet(null);
    setStudySetType(null);
    setIsGeneratingStudySet(false);
    setNewComment('');
    setNewCommentFile(undefined);
    setIsReporting(false);
    setReportReason('');
    setHasReported(false);
    setIsPreviewOpen(false);
    setRelatedStartIndex(0);
    setAiGeneratedPreview('');
    setIsGeneratingPreview(false);
  }, [resource.id]);

  const isAISupported = useMemo(() => {
      if (resource.mimeType) return true;
      if (resource.contentForAI) return true; // Support mock resources
      return false; 
  }, [resource.mimeType, resource.contentForAI]);

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

  const resolveFileBase64 = async (): Promise<string | undefined> => {
    if (resource.fileBase64) return resource.fileBase64;
    // Mock resources use #
    if (resource.fileUrl === '#') return undefined; 

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

  const getMetadataContext = () => {
      return `
      Title: ${resource.title}
      Course: ${resource.courseCode}
      Type: ${resource.type}
      `;
  };

  const prepareAIContent = async () => {
      const textContext = getMetadataContext();
      let base64 = undefined;
      let mimeType = resource.mimeType;
      let additionalText = "";

      // Try to fetch file if not mock
      if (resource.fileUrl && resource.fileUrl !== '#') {
          base64 = await resolveFileBase64();
          if (!base64) {
              return { error: "⚠️ **Connection Error**: Could not download the file for AI analysis. This is often due to browser security settings (CORS) when accessing storage directly." };
          }
      }

      // If mock or no file content found, use contentForAI fallback
      if (!base64) {
          if (resource.contentForAI) {
              additionalText = resource.contentForAI;
              mimeType = undefined; // Force text mode
          } else if (resource.fileUrl !== '#') {
              // Real file failed to load
              return { error: "⚠️ **Error**: Could not read file content." };
          }
      }

      const fullText = additionalText ? `${textContext}\n\nFull Content:\n${additionalText}` : textContext;
      return { text: fullText, base64, mimeType };
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    setSummary('');
    
    const { text, base64, mimeType, error } = await prepareAIContent();
    
    if (error) {
        setSummary(error);
        setIsSummarizing(false);
        return;
    }

    const result = await summarizeContent(text!, base64, mimeType);
    setSummary(result);
    setIsSummarizing(false);
  };
  
  const handleGeneratePreview = async () => {
    if (!isAISupported) return;
    setIsGeneratingPreview(true);
    
    const { text, base64, mimeType, error } = await prepareAIContent();
    
    if (error) {
        setAiGeneratedPreview(error);
        setIsGeneratingPreview(false);
        return;
    }

    const result = await summarizeContent(text!, base64, mimeType);
    setAiGeneratedPreview(result);
    setIsGeneratingPreview(false);
  };
  
  const handleGenerateStudySet = async (type: 'flashcards' | 'quiz') => {
    setIsGeneratingStudySet(true);
    setStudySet(null);
    setStudySetType(type);
    
    const { text, base64, mimeType, error } = await prepareAIContent();
    
    if (error) {
        // Since we can't show text error in study set view easily without changing UI structure, 
        // we'll just log and stop loading. 
        // Ideally UI would handle error state.
        console.error(error);
        setIsGeneratingStudySet(false);
        return;
    }

    const result = await generateStudySet(text!, type, base64, mimeType);
    setStudySet(result);
    setIsGeneratingStudySet(false);
  };

  const resetStudySet = () => {
      setStudySet(null);
      setStudySetType(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setNewCommentFile(file);
      }
  };

  const removeAttachment = () => {
      setNewCommentFile(undefined);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if ((newComment.trim() || newCommentFile) && user) {
      addCommentToResource(resource.id, newComment, null, newCommentFile);
      setNewComment('');
      setNewCommentFile(undefined);
      if (commentFileInputRef.current) commentFileInputRef.current.value = '';
    }
  };

  const handleUpvoteClick = () => { if (!user || isAuthor) return; handleVote(resource.id, 'up'); };
  const handleDownvoteClick = () => { if (!user || isAuthor) return; handleVote(resource.id, 'down'); };
  
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
        <CommentComponent key={comment.id} comment={comment} resourceId={resource.id} onPreview={setPreviewAttachment}>
            {renderComments(comment.id)}
        </CommentComponent>
    ));
  };

  const fileType = resource.fileName.split('.').pop()?.toUpperCase();
  const formattedUploadDate = new Date(resource.uploadDate).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const InfoTag: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
    <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className="text-sm text-slate-800 dark:text-slate-200 font-semibold">{value}</p>
    </div>
  );

  const renderPreviewContent = (source: Resource | Attachment, isAttachment: boolean = false) => {
    // If it's an attachment, use attachment structure, otherwise resource structure
    const fileName = 'fileName' in source ? source.fileName : source.name;
    const fileUrl = 'fileUrl' in source ? source.fileUrl : source.url;
    
    // For mocked resources
    const isMock = !isAttachment && fileUrl === '#';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
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
                    <MarkdownRenderer content={(source as Resource).contentForAI} />
                </div>
            </div>
        );
    }
    if (isImage) return <img src={fileUrl} alt="Preview" className="max-w-full max-h-full object-contain" />;
    if (isPdf) return <iframe src={fileUrl} className="w-full h-full border-none" title="PDF Preview"></iframe>;
    if (isOfficeDoc) return (<iframe src={`https://docs.google.com/gview?url=${encodeURIComponent(fileUrl)}&embedded=true`} className="w-full h-full border-none" title="Office Document Preview" />);

    // Fallback for non-previewable files (if not mock resource)
    if (isAttachment) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400">
                <FileText size={48} className="mb-4 text-slate-400" />
                <p>Preview not available for this file type.</p>
                <a href={fileUrl} download={fileName} className="mt-4 text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-2">
                    <Download size={16} /> Download File
                </a>
            </div>
        );
    }

    const contentToDisplay = aiGeneratedPreview || null;
    return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <FileType size={64} className="text-slate-400 mb-4" />
            <h3 className="text-xl font-bold text-slate-800 mb-2">Preview Unavailable</h3>
            <p className="text-slate-600 mb-6 max-w-md">This file type (<strong>.{ext}</strong>) cannot be displayed directly.</p>
            <div className="w-full max-w-3xl bg-white rounded-lg border border-slate-200 p-6 text-left h-96 overflow-y-auto shadow-inner relative flex flex-col">
                <div className="mb-4 pb-2 border-b border-slate-100 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText size={16} className="text-slate-400" />
                        <span className="text-sm font-semibold text-slate-500">Content Overview</span>
                    </div>
                     {!contentToDisplay && !isGeneratingPreview && isAISupported && (
                        <button onClick={handleGeneratePreview} className="text-xs bg-primary-50 text-primary-600 px-2 py-1 rounded hover:bg-primary-100 font-semibold transition flex items-center gap-1">
                            <BrainCircuit size={12} /> Generate with AI
                        </button>
                    )}
                </div>
                <div className="flex-grow overflow-y-auto">
                    {isGeneratingPreview ? (
                         <div className="flex flex-col items-center justify-center h-full text-slate-400"><Loader2 size={32} className="animate-spin mb-2 text-primary-500" /><p className="text-sm">Analyzing document...</p></div>
                    ) : contentToDisplay ? (
                        <MarkdownRenderer content={contentToDisplay} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                            <p className="italic mb-4">No text preview available.</p>
                            {isAISupported ? (
                                 <button onClick={handleGeneratePreview} className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition font-semibold text-sm shadow-sm">
                                    <BrainCircuit size={16} /> Generate AI Summary
                                </button>
                            ) : (
                                <p className="text-xs text-slate-400">AI features are not supported for this file type.</p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
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
          {/* Main Content Card */}
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
            {/* Actions */}
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border space-y-4">
                <div>
                    <h4 className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-2">Stay Updated</h4>
                    <div className="flex gap-2">
                        <button onClick={() => toggleCourseCodeSubscription(resource.courseCode)} className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg transition ${isFollowingCourse ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                            {isFollowingCourse ? <BellOff size={16} /> : <Bell size={16} />}
                            <span>{isFollowingCourse ? 'Unfollow Course' : 'Follow Course'}</span>
                        </button>
                        {resource.lecturer && (
                             <button onClick={() => toggleLecturerSubscription(resource.lecturer!)} className={`flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-lg transition ${isFollowingLecturer ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                                {isFollowingLecturer ? <BellOff size={16} /> : <Bell size={16} />}
                                <span>{isFollowingLecturer ? 'Unfollow Lecturer' : 'Follow Lecturer'}</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex flex-col gap-3 !mt-6">
                    <button onClick={() => setIsPreviewOpen(true)} className="w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-primary-700 dark:hover:text-primary-400 border border-slate-200 dark:border-zinc-700">
                        <Eye size={18} /> Preview File
                    </button>
                    <a href={resource.fileUrl} download={resource.fileName} onClick={handleDownloadClick} className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all duration-200 ${isDownloading ? 'bg-primary-700 text-primary-100 cursor-wait' : 'bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-md hover:shadow-lg'}`}>
                        {isDownloading ? <><Loader2 size={18} className="animate-spin" /> Downloading...</> : <><Download size={18} /> Download</>}
                    </a>
                </div>
                {/* Reporting */}
                {!isAuthor && (
                    hasReported ? (
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 text-center flex flex-col items-center gap-2">
                            <CheckCircle className="text-green-600 dark:text-green-400" size={24}/>
                            <div><h4 className="font-bold text-green-800 dark:text-green-200">Report Submitted</h4><p className="text-sm text-green-700 dark:text-green-300 mt-1">Thank you. Our moderators will review this shortly.</p></div>
                        </div>
                    ) : !isReporting ? (
                        <div className="flex flex-col gap-2">
                            <button onClick={() => setIsReporting(true)} className="w-full flex items-center justify-center gap-2 text-slate-500 dark:text-slate-400 font-semibold py-2 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-700 dark:hover:text-slate-200 transition text-sm">
                                <Flag size={16} className="text-red-500"/> Report this resource
                            </button>
                        </div>
                    ) : (
                        <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700">
                            <h4 className="font-bold text-slate-700 dark:text-slate-200 mb-2">Report Resource</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Please provide a reason for reporting this content. Your report is anonymous.</p>
                            <textarea value={reportReason} onChange={(e) => setReportReason(e.target.value)} placeholder="e.g., Incorrect information, offensive content, spam..." className="w-full bg-white dark:bg-zinc-900 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none" rows={3} autoFocus />
                            <div className="flex justify-end gap-2 mt-4">
                                <button onClick={() => setIsReporting(false)} className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 font-semibold py-2 px-4 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition">Cancel</button>
                                <button onClick={handleSubmitReport} className="bg-red-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-700 transition">Submit Report</button>
                            </div>
                        </div>
                    )
                )}
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">AI Summary</h3>
            {!isAISupported && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4 flex items-start gap-3">
                    <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" size={20} />
                    <div><h4 className="font-bold text-amber-800 dark:text-amber-200 text-sm">File Type Not Fully Supported</h4><p className="text-amber-700 dark:text-amber-300 text-xs mt-1">AI summarization works best with PDF and Image files. For Word and PowerPoint, reliability may vary.</p></div>
                </div>
            )}
            {!summary && !isSummarizing && (
              <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg p-6 text-center">
                  <BrainCircuit className="mx-auto h-12 w-12 text-slate-400 dark:text-slate-500" />
                  <p className="mt-2 text-slate-600 dark:text-slate-400">Get a quick overview of this document.</p>
                  <button onClick={handleGenerateSummary} disabled={!isAISupported} className={`mt-4 inline-flex items-center gap-2 font-bold py-2 px-4 rounded-lg transition ${isAISupported ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-200 dark:bg-zinc-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'}`}>
                      <BrainCircuit size={18} /> Generate with Gemini
                  </button>
              </div>
            )}
            {isSummarizing && <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-6 text-center"><Loader2 className="mx-auto h-12 w-12 text-primary-500 animate-spin" /><p className="mt-4 text-slate-600 dark:text-slate-300 font-medium">Gemini is thinking...</p><p className="text-sm text-slate-500 dark:text-slate-400">Generating a summary for you.</p></div>}
            {summary && <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg p-4 sm:p-6 dark:text-slate-200"><MarkdownRenderer content={summary} /></div>}
          </div>
          
          {/* AI Study Tools */}
          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">AI Study Tools</h3>
            {!isAISupported && <div className="bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg text-center mb-4"><p className="text-sm text-slate-500 dark:text-slate-400">Study tools may be limited for this file type.</p></div>}
            {isGeneratingStudySet && <div className="border border-slate-200 dark:border-zinc-700 rounded-lg p-6 text-center"><Loader2 className="mx-auto h-12 w-12 text-primary-500 animate-spin" /><p className="mt-4 text-slate-600 dark:text-slate-300 font-medium">Gemini is thinking...</p><p className="text-sm text-slate-500 dark:text-slate-400">Generating {studySetType === 'flashcards' ? 'flashcards' : 'a quiz'} for you.</p></div>}
            {!isGeneratingStudySet && !studySet && (
                <div className={`border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-lg p-6 text-center ${!isAISupported ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="flex justify-center gap-4">
                        <button onClick={() => handleGenerateStudySet('flashcards')} disabled={!isAISupported} className="flex-1 inline-flex flex-col items-center gap-2 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold py-4 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition border border-slate-200 dark:border-zinc-700"><BookCopy size={24} /> Generate Flashcards</button>
                        <button onClick={() => handleGenerateStudySet('quiz')} disabled={!isAISupported} className="flex-1 inline-flex flex-col items-center gap-2 bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold py-4 px-4 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition border border-slate-200 dark:border-zinc-700"><HelpCircle size={24} /> Generate Practice Quiz</button>
                    </div>
                </div>
            )}
            {!isGeneratingStudySet && studySet && studySet.length > 0 && (
                <div className="bg-slate-50 dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700 rounded-lg p-4 sm:p-6">
                    {studySetType === 'flashcards' && <FlashcardViewer flashcards={studySet as Flashcard[]} onReset={resetStudySet} />}
                    {studySetType === 'quiz' && <QuizComponent questions={studySet as QuizQuestion[]} onReset={resetStudySet} />}
                </div>
            )}
            {!isGeneratingStudySet && studySet && studySet.length === 0 && (
                 <div className="p-4 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"><p className="text-red-700 dark:text-red-300 font-semibold">Could not generate study set.</p><p className="text-red-600 dark:text-red-400 text-sm">Please try again later or check if the file format is supported.</p><button onClick={resetStudySet} className="mt-2 text-sm text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300">Try again</button></div>
            )}
          </div>

          {/* Discussion */}
          <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><MessageSquare size={22}/> Discussion ({resource.comments.length})</h3>
            
            {/* Top-Level Comment Form */}
            <form onSubmit={handlePostComment} className="flex gap-4 items-start pb-6 mb-6 border-b border-slate-200 dark:border-zinc-700">
              <Avatar src={user?.avatarUrl} alt={user?.name} className="w-10 h-10 rounded-full shrink-0" />
              <div className="w-full">
                <MarkdownToolbar textareaRef={commentTextareaRef} value={newComment} onValueChange={setNewComment} />
                {newCommentFile && (
                    <div className="bg-slate-100 dark:bg-zinc-900 border-x border-slate-300 dark:border-zinc-700 px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                            {newCommentFile.type.startsWith('image/') ? <ImageIcon size={16}/> : <FileText size={16}/>}
                            <span className="truncate max-w-xs">{newCommentFile.name}</span>
                        </div>
                        <button type="button" onClick={removeAttachment} className="text-slate-500 hover:text-red-500">
                            <X size={16} />
                        </button>
                    </div>
                )}
                <textarea 
                    ref={commentTextareaRef} 
                    value={newComment} 
                    onChange={(e) => setNewComment(e.target.value)} 
                    placeholder="Add a comment..." 
                    className={`w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 ${newCommentFile ? 'border-t-0' : ''} rounded-b-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none`} 
                    rows={3} 
                />
                <input 
                    type="file" 
                    ref={commentFileInputRef} 
                    className="hidden" 
                    onChange={handleFileSelect}
                />
                 <div className="flex justify-between items-center mt-2">
                    <button 
                        type="button" 
                        onClick={() => commentFileInputRef.current?.click()}
                        className="bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 p-2 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition"
                        title="Attach file"
                    >
                        <Paperclip size={18} />
                    </button>
                    <button type="submit" className="bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition">Post</button>
                 </div>
              </div>
            </form>
            <div className="mt-6">{renderComments(null)}</div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md lg:sticky top-24 transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full h-80 object-cover rounded-lg mb-6" />
                <div className="flex items-center gap-2">
                    <button 
                        onClick={handleUpvoteClick} 
                        disabled={isAuthor}
                        className={`flex items-center gap-2 p-3 rounded-lg transition font-medium ${
                            isUpvoted 
                                ? 'bg-green-600 text-white' 
                                : isAuthor
                                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                        }`}
                    >
                        <ThumbsUp size={18} /> {resource.upvotes > 0 && <span>{resource.upvotes}</span>}
                    </button>
                    <button 
                        onClick={handleDownvoteClick} 
                        disabled={isAuthor}
                        className={`flex items-center gap-2 p-3 rounded-lg transition font-medium ${
                            isDownvoted 
                                ? 'bg-red-600 text-white' 
                                : isAuthor
                                    ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                    >
                        <ThumbsDown size={18} /> {resource.downvotes > 0 && <span>{resource.downvotes}</span>}
                    </button>
                    <button onClick={() => toggleSaveResource(resource.id)} title={isSaved ? "Unsave" : "Save for later"} className={`p-3 rounded-lg transition font-medium ${isSaved ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}>
                        {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                    </button>
                     <button onClick={() => setIsShareModalOpen(true)} title="Share" className="p-3 rounded-lg transition font-medium bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-zinc-700"><Share2 size={18} /></button>
                    {canDelete && (
                        <button onClick={() => setIsDeleteConfirmOpen(true)} title="Delete Resource" className="p-3 rounded-lg transition font-medium bg-slate-100 dark:bg-zinc-800 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30">
                            <Trash2 size={18} />
                        </button>
                    )}
                </div>
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border">
                    <p className="text-sm font-semibold text-slate-800 dark:text-white mb-3">Uploaded by</p>
                    <button onClick={() => handleAuthorClick(resource.author.id)} className="flex items-center gap-3 w-full text-left hover:bg-slate-50 dark:hover:bg-zinc-800 p-2 rounded-lg transition-colors">
                        <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-12 h-12 rounded-full" />
                        <div>
                            <div className="flex items-center"><p className="font-bold text-slate-900 dark:text-slate-100">{resource.author.name}</p><UserRankBadge rank={authorRank} /></div>
                            <p className="text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold">{resource.author.course}</span> • Joined on {new Date(resource.author.joinDate).toLocaleDateString()}</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {relatedResources.length > 0 && (
        <div className="mt-12 border-t border-slate-200 dark:border-zinc-700 pt-8">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6">Related Resources</h2>
            <div className="relative group px-4">
                {relatedStartIndex > 0 && (
                    <button onClick={() => setRelatedStartIndex(prev => Math.max(0, prev - 1))} className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 z-20 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 p-3 rounded-full shadow-lg border border-slate-100 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-primary-600 hover:scale-110 transition-all duration-200 flex items-center justify-center" aria-label="Previous"><ArrowLeft size={24} /></button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                    {relatedResources.slice(relatedStartIndex, relatedStartIndex + 4).map(related => (
                        <ResourceCard key={related.id} resource={related} onSelect={() => setView('resourceDetail', related.id)} onAuthorClick={handleAuthorClick} compact={true} />
                    ))}
                </div>
                {relatedStartIndex < relatedResources.length - 4 && (
                    <button onClick={() => setRelatedStartIndex(prev => Math.min(Math.max(0, relatedResources.length - 4), prev + 1))} className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-20 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 p-3 rounded-full shadow-lg border border-slate-100 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 hover:text-primary-600 hover:scale-110 transition-all duration-200 flex items-center justify-center" aria-label="Next"><ArrowRight size={24} /></button>
                )}
            </div>
        </div>
      )}

      {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                    <div className="flex flex-col items-center text-center">
                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4"><Trash2 size={32} /></div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Resource?</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to delete <strong>{resource.title}</strong>? This action cannot be undone.</p>
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
                         <div className={`p-2 rounded-lg ${getBadgeStyle(resource.type)}`}>{getBadgeIcon(resource.type)}</div>
                        <div className="overflow-hidden"><h3 className="font-bold text-slate-800 truncate text-lg leading-tight">{resource.title}</h3><p className="text-xs text-slate-500 truncate">{resource.fileName}</p></div>
                    </div>
                     <div className="flex items-center gap-2 shrink-0">
                        <a href={resource.fileUrl} download={resource.fileName} className="p-2 rounded-full hover:bg-slate-200 text-slate-600 transition" title="Download"><Download size={20} /></a>
                        <button onClick={() => setIsPreviewOpen(false)} className="p-2 rounded-full hover:bg-red-100 text-slate-500 hover:text-red-600 transition"><X size={24} /></button>
                    </div>
                </div>
                <div className="flex-grow bg-slate-200 overflow-hidden flex items-center justify-center rounded-b-xl relative">{renderPreviewContent(resource)}</div>
            </div>
        </div>
    )}

    {previewAttachment && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
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
                    {renderPreviewContent(previewAttachment, true)}
                </div>
            </div>
        </div>
    )}

    <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} resource={resource} />
    </div>
  );
};

export default ResourceDetailPage;
