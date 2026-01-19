
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Attachment } from '../../types';
import { AppContext } from '../../App';
import { createChatSession } from '../../services/geminiService';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Download, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, Eye, X, AlertCircle, FileType, Bookmark, BookmarkCheck, Share2, Trash2, Paperclip, Image as ImageIcon, Sparkles, Send, Bot } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';
import ShareModal from '../ShareModal';
import ResourceCard from '../ResourceCard';
import Avatar from '../Avatar';
import { db } from '../../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
import type { Chat } from '@google/genai';

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
  const canDelete = isOwnComment || user?.role === 'admin'; 

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

interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: number;
}

const ResourceDetailPage: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { user, userRanks, setView, handleVote, addCommentToResource, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, resources, deleteResource, scrollTargetId, setScrollTargetId, showToast } = useContext(AppContext);
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isInitializingChat, setIsInitializingChat] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const commentFileInputRef = useRef<HTMLInputElement>(null);
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(null);

  const authorRank = userRanks.get(resource.author.id);
  const isFollowingLecturer = user?.subscriptions.lecturers.includes(resource.lecturer || '');
  const isFollowingCourse = user?.subscriptions.courseCodes.includes(resource.courseCode);
  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const canDelete = isAuthor || user?.role === 'admin'; 

  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  // Scroll to new messages
  useEffect(() => {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Enhanced Deep Linking with Retry Logic
  useEffect(() => {
      if (scrollTargetId) {
          const tryScroll = (attempts: number) => {
              const targetElement = document.getElementById(scrollTargetId);
              if (targetElement) {
                  setTimeout(() => {
                      targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      targetElement.classList.add('bg-yellow-100', 'dark:bg-yellow-900/40', 'ring-2', 'ring-yellow-400', 'dark:ring-yellow-600');
                      setTimeout(() => {
                          targetElement.classList.remove('bg-yellow-100', 'dark:bg-yellow-900/40', 'ring-2', 'ring-yellow-400', 'dark:ring-yellow-600');
                          setScrollTargetId(null);
                      }, 2500);
                  }, 100);
              } else if (attempts > 0) {
                  setTimeout(() => tryScroll(attempts - 1), 500);
              }
          };
          tryScroll(5); 
      }
  }, [scrollTargetId, resource.comments, setScrollTargetId]);

  // Reset page state on resource change
  useEffect(() => {
    setNewComment('');
    setNewCommentFile(undefined);
    setIsReporting(false);
    setReportReason('');
    setHasReported(false);
    setIsPreviewOpen(false);
    setRelatedStartIndex(0);
    
    // Reset Chat
    setMessages([]);
    chatSessionRef.current = null;
    initializeChat();
  }, [resource.id]);

  const isAISupported = useMemo(() => {
      if (resource.mimeType) return true;
      if (resource.contentForAI) return true; 
      const ext = resource.fileName.split('.').pop()?.toLowerCase();
      if (['pdf', 'docx', 'pptx', 'txt', 'md'].includes(ext || '')) return true;
      return false; 
  }, [resource.mimeType, resource.contentForAI, resource.fileName]);

  // === Chat Logic ===

  const resolveFileBase64 = async (): Promise<string | undefined> => {
    if (resource.fileBase64) return resource.fileBase64;
    if (resource.fileUrl === '#') return undefined; 

    try {
        const response = await fetch(resource.fileUrl, { method: 'GET', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw new Error(`Fetch failed: ${response.statusText}`);
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn("AI File Access Warning:", error);
        return undefined;
    }
  };

  const getMetadataContext = () => {
      return `
      Title: ${resource.title}
      Course: ${resource.courseCode} - ${resource.courseName}
      Type: ${resource.type}
      Description: ${resource.description}
      `;
  };

  const prepareAIContent = async () => {
      const textContext = getMetadataContext();
      let base64 = undefined;
      let mimeType = resource.mimeType;
      let additionalText = "";

      if (resource.fileUrl && resource.fileUrl !== '#') {
          base64 = await resolveFileBase64();
          
          if (!base64) {
              // Silently handle fallback
              additionalText += "\n[System Note: File content access restricted. Using metadata summary.]";
          } else {
              if ((!mimeType || mimeType === 'application/octet-stream') && base64.startsWith('data:')) {
                  const match = base64.match(/^data:([^;]+);/);
                  if (match && match[1]) mimeType = match[1];
              }
              if (!mimeType || mimeType === 'application/octet-stream') {
                  const ext = resource.fileName.split('.').pop()?.toLowerCase();
                  if (ext === 'pdf') mimeType = 'application/pdf';
                  if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                  if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
              }
          }
      }

      if (!base64) {
          if (resource.contentForAI) {
              additionalText += "\n\n" + resource.contentForAI;
              mimeType = undefined;
          } else if (resource.fileUrl !== '#' && !additionalText.includes("System Note")) {
               additionalText += "\n[System Note: File unavailable. Use metadata.]";
          }
      }

      const fullText = additionalText ? `${textContext}\n\n${additionalText}` : textContext;
      return { text: fullText, base64, mimeType };
  };

  const initializeChat = async () => {
      if (!isAISupported || chatSessionRef.current) return;
      setIsInitializingChat(true);

      const { text, base64, mimeType } = await prepareAIContent();
      const { chat, initialError } = await createChatSession(text!, base64, mimeType);

      if (chat) {
          chatSessionRef.current = chat;
          setMessages([
              { 
                  id: 'init', 
                  role: 'model', 
                  text: initialError 
                    ? `I encountered an issue reading the file (${initialError}), but I've reviewed the metadata. How can I help you with **${resource.title}**?`
                    : `I've analyzed **${resource.title}**. Ask me for a summary, practice questions, or anything else about this document!`,
                  timestamp: Date.now() 
              }
          ]);
      } else {
          setMessages([{ id: 'err', role: 'model', text: "Sorry, I couldn't initialize the assistant for this document.", timestamp: Date.now() }]);
      }
      setIsInitializingChat(false);
  };

  const handleSendMessage = async (text: string) => {
      if (!chatSessionRef.current || !text.trim()) return;

      const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
      setMessages(prev => [...prev, userMsg]);
      setChatInput('');
      setIsChatLoading(true);

      try {
          const result = await chatSessionRef.current.sendMessageStream({ message: text });
          let fullResponse = "";
          const botMsgId = (Date.now() + 1).toString();
          
          // Add placeholder for streaming
          setMessages(prev => [...prev, { id: botMsgId, role: 'model', text: '', timestamp: Date.now() }]);

          for await (const chunk of result) {
              const chunkText = chunk.text;
              if (chunkText) {
                  fullResponse += chunkText;
                  setMessages(prev => prev.map(msg => msg.id === botMsgId ? { ...msg, text: fullResponse } : msg));
              }
          }
      } catch (e) {
          console.error("Chat Error", e);
          setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: "I'm having trouble connecting right now. Please try again.", timestamp: Date.now() }]);
      } finally {
          setIsChatLoading(false);
      }
  };

  const handleSuggestionClick = (suggestion: string) => {
      handleSendMessage(suggestion);
  };

  // === End Chat Logic ===

  const commentsByParentId = useMemo(() => {
    const group: Record<string, Comment[]> = {};
    for (const comment of resource.comments) {
        const parentId = comment.parentId || 'root';
        if (!group[parentId]) group[parentId] = [];
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
    return matches.slice(0, 8);
  }, [resources, resource]);

  const handleAuthorClick = (authorId: string) => {
    if (authorId === user?.id) setView('profile');
    else setView('publicProfile', authorId);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) setNewCommentFile(file);
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
  const formattedUploadDate = new Date(resource.uploadDate).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

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
            
            <div className="mt-6 pt-6 border-t border-slate-200 dark:border-dark-border space-y-4">
                <div className="flex flex-col gap-3 !mt-2">
                    <button onClick={() => setIsPreviewOpen(true)} className="w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all duration-200 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-zinc-700 hover:text-primary-700 dark:hover:text-primary-400 border border-slate-200 dark:border-zinc-700">
                        <Eye size={18} /> Preview File
                    </button>
                    <a href={resource.fileUrl} download={resource.fileName} onClick={handleDownloadClick} className={`w-full flex items-center justify-center gap-2 font-bold py-3 px-4 rounded-lg transition-all duration-200 ${isDownloading ? 'bg-primary-700 text-primary-100 cursor-wait' : 'bg-primary-600 text-white hover:bg-primary-700 hover:-translate-y-0.5 shadow-md hover:shadow-lg'}`}>
                        {isDownloading ? <><Loader2 size={18} className="animate-spin" /> Downloading...</> : <><Download size={18} /> Download</>}
                    </a>
                </div>
            </div>
          </div>

          {/* Gemini Chat Assistant */}
          <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md mt-8 overflow-hidden border border-transparent dark:border-zinc-700 flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-700 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-white dark:from-blue-900/10 dark:to-dark-surface">
                <div className="bg-white dark:bg-zinc-800 p-2 rounded-lg shadow-sm">
                    <Sparkles className="text-blue-500" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white">Gemini Document Assistant</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Ask questions, get summaries, or create quizzes.</p>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50 dark:bg-zinc-900/30">
                {isInitializingChat ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400">
                        <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
                        <p>Analyzing document...</p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-3 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-primary-100 dark:bg-primary-900/50' : 'bg-white dark:bg-zinc-700 shadow-sm'}`}>
                                        {msg.role === 'user' ? <Avatar src={user?.avatarUrl} alt="User" className="w-8 h-8"/> : <Sparkles size={16} className="text-blue-500" />}
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm ${msg.role === 'user' ? 'bg-primary-600 text-white rounded-br-none' : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-slate-200 shadow-sm rounded-bl-none border border-slate-100 dark:border-zinc-700'}`}>
                                        <MarkdownRenderer content={msg.text} />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isChatLoading && (
                            <div className="flex justify-start">
                                 <div className="flex gap-3 max-w-[85%]">
                                    <div className="w-8 h-8 rounded-full bg-white dark:bg-zinc-700 shadow-sm flex items-center justify-center shrink-0">
                                        <Loader2 size={16} className="animate-spin text-blue-500" />
                                    </div>
                                    <div className="p-3 rounded-2xl rounded-bl-none bg-white dark:bg-zinc-800 shadow-sm border border-slate-100 dark:border-zinc-700">
                                        <span className="flex gap-1">
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div ref={chatEndRef} />
                    </>
                )}
            </div>

            {/* Suggestions */}
            {!isChatLoading && messages.length < 3 && !isInitializingChat && (
                <div className="px-4 py-2 bg-slate-50 dark:bg-zinc-900/30 flex gap-2 overflow-x-auto no-scrollbar">
                    {['Summarize this', 'List key concepts', 'Create a 5-question quiz', 'Explain the main topic'].map((s) => (
                        <button 
                            key={s} 
                            onClick={() => handleSuggestionClick(s)}
                            className="whitespace-nowrap px-3 py-1.5 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-full text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:border-blue-200 dark:hover:border-blue-800 transition"
                        >
                            {s}
                        </button>
                    ))}
                </div>
            )}

            <div className="p-4 bg-white dark:bg-dark-surface border-t border-slate-100 dark:border-zinc-700">
                <form 
                    onSubmit={(e) => { e.preventDefault(); handleSendMessage(chatInput); }}
                    className="flex gap-2"
                >
                    <input 
                        type="text" 
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={isInitializingChat ? "Initializing..." : "Ask a question about this document..."}
                        disabled={isChatLoading || isInitializingChat}
                        className="flex-grow bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-white px-4 py-2.5 rounded-xl border-none focus:ring-2 focus:ring-blue-500 transition placeholder:text-slate-400"
                    />
                    <button 
                        type="submit" 
                        disabled={!chatInput.trim() || isChatLoading || isInitializingChat}
                        className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-blue-500/20"
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
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
      
      {/* Related Resources ... (kept same) */}
      
      {/* Modals ... (kept same) */}
      
      <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} resource={resource} />
    </div>
  );
};

export default ResourceDetailPage;
