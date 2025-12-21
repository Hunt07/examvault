
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import { ResourceType, type Resource, type Comment, type Flashcard, type QuizQuestion, type Attachment } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, ClipboardList, Archive, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, Paperclip, ImageIcon, Bookmark, BookmarkCheck, Share2, Trash2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';
import FlashcardViewer from '../FlashcardViewer';
import QuizComponent from '../QuizComponent';
import ShareModal from '../ShareModal';
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
    if (userId === user?.id) setView('profile');
    else setView('publicProfile', userId);
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
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{new Date(comment.timestamp).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="mt-2 dark:text-slate-200"><MarkdownRenderer content={comment.text} /></div>
          {comment.attachment && (
            <div className="mt-4">
                <a href={comment.attachment.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-3 p-3 bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition shadow-sm group">
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
            <button onClick={handleVoteForComment} disabled={isOwnComment} className={`flex items-center p-2 text-sm font-semibold rounded-lg transition-colors ${isUpvoted ? 'bg-primary-600 text-white' : 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'}`}>
              <ThumbsUp size={14} />
              {comment.upvotes > 0 && <span className="ml-1.5">{comment.upvotes}</span>}
            </button>
            <button onClick={() => setIsReplying(!isReplying)} className="flex items-center gap-1.5 p-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 rounded-lg transition-colors">
                <MessageCircle size={14} /> Reply
            </button>
            {isOwnComment && (
                <button onClick={() => setIsDeleteConfirmOpen(true)} className="flex items-center gap-1.5 p-2 text-sm font-semibold text-red-500 bg-white dark:bg-zinc-700 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={14} />
                </button>
            )}
          </div>
        </div>
      </div>
      {isReplying && (
        <div className="ml-14 mt-4">
          <form onSubmit={handleReplySubmit} className="flex gap-4 items-start">
            <Avatar src={user?.avatarUrl} alt={user?.name || "User"} className="w-8 h-8" />
            <div className="flex-grow">
              <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder={`Replying to ${comment.author.name}...`} className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 px-4 py-2 border rounded-lg focus:ring-primary-500 outline-none" rows={2} autoFocus />
              <div className="flex gap-2 mt-2">
                <button type="submit" className="bg-primary-600 text-white font-semibold py-1 px-3 rounded-lg text-sm">Post Reply</button>
                <button type="button" onClick={() => setIsReplying(false)} className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 font-semibold py-1 px-3 rounded-lg text-sm">Cancel</button>
              </div>
            </div>
          </form>
        </div>
      )}
      <div className="pl-8 border-l-2 border-slate-200 dark:border-zinc-700 ml-5">{children}</div>
      {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                    <h3 className="text-lg font-bold dark:text-white mb-2">Delete Comment?</h3>
                    <div className="flex gap-3 mt-4">
                        <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 rounded-lg">Cancel</button>
                        <button onClick={() => { deleteCommentFromResource(resourceId, comment); setIsDeleteConfirmOpen(false); }} className="flex-1 py-2 bg-red-600 text-white rounded-lg">Delete</button>
                    </div>
                </div>
            </div>
      )}
    </div>
  );
};

const ResourceDetailPage: React.FC<{ resource: Resource }> = ({ resource }) => {
  const { user, userRanks, setView, handleVote, addCommentToResource, toggleLecturerSubscription, toggleCourseCodeSubscription, savedResourceIds, toggleSaveResource, resources, deleteResource, showToast } = useContext(AppContext);
  const [summary, setSummary] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [commentFile, setCommentFile] = useState<File | null>(null);
  const [isUploadingCommentFile, setIsUploadingCommentFile] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [hasReported, setHasReported] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [studySet, setStudySet] = useState<(Flashcard[] | QuizQuestion[]) | null>(null);
  const [studySetType, setStudySetType] = useState<'flashcards' | 'quiz' | null>(null);
  const [isGeneratingStudySet, setIsGeneratingStudySet] = useState(false);
  const commentFileInputRef = useRef<HTMLInputElement>(null);

  const authorRank = userRanks.get(resource.author.id);
  const isFollowingLecturer = user?.subscriptions.lecturers.includes(resource.lecturer || '');
  const isFollowingCourse = user?.subscriptions.courseCodes.includes(resource.courseCode);
  const isSaved = savedResourceIds.includes(resource.id);
  const isAuthor = user?.id === resource.author.id;
  const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
  const isDownvoted = resource.downvotedBy?.includes(user?.id || '');

  const isAISupported = useMemo(() => !!resource.mimeType || resource.fileUrl === '#', [resource.mimeType, resource.fileUrl]);

  const resolveFileBase64 = async (): Promise<string | undefined> => {
    if (resource.fileBase64) return resource.fileBase64;
    if (resource.fileUrl === '#') return undefined;
    try {
        const response = await fetch(resource.fileUrl, { mode: 'cors' });
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error("AI Access Error:", error);
        return undefined;
    }
  };

  const handleGenerateSummary = async () => {
    setIsSummarizing(true);
    setSummary('');
    const base64 = await resolveFileBase64();
    if (!base64 && resource.fileUrl !== '#') {
        setSummary("⚠️ **Content Access Error**\n\nAccess to file content blocked. Try using a direct PDF or Image upload for AI features.");
        setIsSummarizing(false);
        return;
    }
    const result = await summarizeContent(`Title: ${resource.title}\nCourse: ${resource.courseCode}`, base64, resource.mimeType);
    setSummary(result);
    setIsSummarizing(false);
  };
  
  const handleGenerateStudySet = async (type: 'flashcards' | 'quiz') => {
    setIsGeneratingStudySet(true);
    setStudySet(null);
    setStudySetType(type);
    const base64 = await resolveFileBase64();
    if (!base64 && resource.fileUrl !== '#') {
        showToast("Access error for study tools.", "error");
        setIsGeneratingStudySet(false);
        return;
    }
    const result = await generateStudySet(`Title: ${resource.title}\nCourse: ${resource.courseCode}`, type, base64, resource.mimeType);
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
                attachment = { url, name: commentFile.name, type: commentFile.type.startsWith('image/') ? 'image' : 'file', size: `${(commentFile.size / 1024).toFixed(0)} KB` };
            } catch (err) {
                showToast("Upload failed", "error");
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

  const renderComments = (parentId: string | null) => {
    return resource.comments
        .filter(c => (parentId === null ? !c.parentId : c.parentId === parentId))
        .map(comment => (
            <CommentComponent key={comment.id} comment={comment} resourceId={resource.id}>
                {renderComments(comment.id)}
            </CommentComponent>
        ));
  };

  return (
    <div className="max-w-7xl mx-auto">
      <button onClick={() => setView('dashboard')} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold hover:underline mb-6">
        <ArrowLeft size={20} /> Back to Library
      </button>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{resource.type}</span>
              <span className="text-xs font-black text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{resource.courseCode}</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{resource.title}</h1>
            <p className="text-lg text-slate-500 dark:text-slate-400 mt-1">{resource.courseName}</p>
            <p className="mt-4 text-slate-700 dark:text-slate-300 leading-relaxed">{resource.description}</p>
            
            <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border dark:border-zinc-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Academic Year</p>
                    <p className="font-bold dark:text-white">{resource.year}</p>
                </div>
                <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border dark:border-zinc-700">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Intake</p>
                    <p className="font-bold dark:text-white">{resource.semester}</p>
                </div>
                {resource.lecturer && (
                    <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border dark:border-zinc-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Lecturer</p>
                        <p className="font-bold dark:text-white truncate">{resource.lecturer}</p>
                    </div>
                )}
                {resource.examType && (
                    <div className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-xl border dark:border-zinc-700">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Category</p>
                        <p className="font-bold dark:text-white">{resource.examType}</p>
                    </div>
                )}
            </div>

            <div className="mt-8 pt-6 border-t dark:border-zinc-700 flex flex-wrap gap-3">
                <button onClick={() => toggleCourseCodeSubscription(resource.courseCode)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${isFollowingCourse ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white'}`}>
                    {isFollowingCourse ? <BellOff size={16}/> : <Bell size={16}/>} {isFollowingCourse ? 'Unfollow Course' : 'Follow Course'}
                </button>
                <button onClick={() => setIsPreviewOpen(true)} className="px-6 py-2 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-xl text-sm font-bold flex items-center gap-2"><Eye size={18}/> View File</button>
                <a href={resource.fileUrl} download={resource.fileName} className="px-6 py-2 bg-primary-600 text-white rounded-xl text-sm font-bold flex items-center gap-2"><Download size={18}/> Download</a>
            </div>
          </div>

          {/* AI Center */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700 flex flex-col">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><BrainCircuit size={22} className="text-primary-500" /> AI Summary</h3>
                <div className="flex-grow">
                    {!summary && !isSummarizing ? (
                        <div className="h-full border-2 border-dashed border-slate-200 dark:border-zinc-700 rounded-xl flex flex-col items-center justify-center p-6 text-center">
                            <p className="text-slate-400 text-sm mb-4">Get a high-level overview of this resource instantly.</p>
                            <button onClick={handleGenerateSummary} disabled={!isAISupported} className="bg-primary-600 text-white font-bold py-2 px-6 rounded-xl hover:bg-primary-700 transition disabled:opacity-50">Generate with Gemini</button>
                        </div>
                    ) : isSummarizing ? (
                        <div className="flex flex-col items-center justify-center py-12"><Loader2 className="animate-spin text-primary-500 mb-2" size={32}/><p className="text-sm font-bold text-slate-500">Gemini is analyzing...</p></div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-xl prose-sm dark:prose-invert"><MarkdownRenderer content={summary} /></div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700 flex flex-col">
                <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center gap-2"><BookCopy size={22} className="text-amber-500" /> Study Center</h3>
                <div className="flex-grow">
                    {isGeneratingStudySet ? (
                        <div className="flex flex-col items-center justify-center py-12"><Loader2 className="animate-spin text-amber-500 mb-2" size={32}/><p className="text-sm font-bold text-slate-500">Creating study set...</p></div>
                    ) : !studySet ? (
                        <div className="space-y-4">
                            <button onClick={() => handleGenerateStudySet('flashcards')} disabled={!isAISupported} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl hover:bg-slate-100 transition border dark:border-zinc-700 group disabled:opacity-50">
                                <div className="text-left">
                                    <p className="font-bold dark:text-white">Flashcards</p>
                                    <p className="text-xs text-slate-500">Test your memory on key terms.</p>
                                </div>
                                <BookCopy size={20} className="text-slate-400 group-hover:text-amber-500" />
                            </button>
                            <button onClick={() => handleGenerateStudySet('quiz')} disabled={!isAISupported} className="w-full flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl hover:bg-slate-100 transition border dark:border-zinc-700 group disabled:opacity-50">
                                <div className="text-left">
                                    <p className="font-bold dark:text-white">Practice Quiz</p>
                                    <p className="text-xs text-slate-500">MCQ based on this content.</p>
                                </div>
                                <HelpCircle size={20} className="text-slate-400 group-hover:text-primary-500" />
                            </button>
                        </div>
                    ) : (
                        <div className="bg-slate-50 dark:bg-zinc-900/50 p-2 rounded-xl">
                            {studySetType === 'flashcards' ? <FlashcardViewer flashcards={studySet as Flashcard[]} onReset={() => setStudySet(null)} /> : <QuizComponent questions={studySet as QuizQuestion[]} onReset={() => setStudySet(null)} />}
                        </div>
                    )}
                </div>
            </div>
          </div>

          <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2"><MessageSquare size={22}/> Community Discussion</h3>
            <form onSubmit={handlePostComment} className="mb-8">
              <div className="flex gap-4">
                  <Avatar src={user?.avatarUrl} alt={user?.name} className="w-10 h-10 rounded-full shrink-0" />
                  <div className="flex-grow space-y-3">
                    <textarea value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Share your thoughts or ask a question..." className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-4 border rounded-xl focus:ring-2 focus:ring-primary-500 outline-none transition" rows={3} />
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2">
                             <button type="button" onClick={() => commentFileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-primary-600 transition"><Paperclip size={20} /></button>
                             <input type="file" ref={commentFileInputRef} className="hidden" onChange={(e) => setCommentFile(e.target.files?.[0] || null)} />
                             {commentFile && <span className="text-xs font-bold text-primary-600 py-2">{commentFile.name}</span>}
                        </div>
                        <button type="submit" disabled={(!newComment.trim() && !commentFile) || isUploadingCommentFile} className="bg-primary-600 text-white font-bold py-2 px-8 rounded-xl hover:bg-primary-700 transition disabled:opacity-50">Post Comment</button>
                    </div>
                  </div>
              </div>
            </form>
            <div className="space-y-6">{renderComments(null)}</div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-8">
            <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md sticky top-24 border dark:border-zinc-700">
                <img src={resource.previewImageUrl} alt={resource.title} className="w-full aspect-[3/4] object-cover rounded-xl mb-6 shadow-inner bg-slate-100" />
                <div className="flex items-center gap-2 mb-8">
                    <button onClick={() => handleVote(resource.id, 'up')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition font-bold ${isUpvoted ? 'bg-green-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white'}`}>
                        <ThumbsUp size={18} /> {resource.upvotes}
                    </button>
                    <button onClick={() => handleVote(resource.id, 'down')} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition font-bold ${isDownvoted ? 'bg-red-600 text-white shadow-lg' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white'}`}>
                        <ThumbsDown size={18} /> {resource.downvotes}
                    </button>
                </div>
                <div className="space-y-3">
                    <button onClick={() => toggleSaveResource(resource.id)} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition border ${isSaved ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-white dark:bg-zinc-900 dark:text-white dark:border-zinc-700'}`}>
                        {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />} {isSaved ? 'Saved to Collection' : 'Save for Later'}
                    </button>
                    <button onClick={() => setIsShareModalOpen(true)} className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 bg-white dark:bg-zinc-900 dark:text-white border dark:border-zinc-700 transition hover:bg-slate-50"><Share2 size={20} /> Share Resource</button>
                    {isAuthor && <button onClick={() => setIsDeleteConfirmOpen(true)} className="w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 transition border border-transparent"><Trash2 size={20} /> Delete Resource</button>}
                </div>

                <div className="mt-8 pt-8 border-t dark:border-zinc-700">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Uploader</p>
                    <button onClick={() => setView('publicProfile', resource.author.id)} className="flex items-center gap-4 w-full text-left group">
                        <Avatar src={resource.author.avatarUrl} alt={resource.author.name} className="w-14 h-14 border-2 border-slate-100 dark:border-zinc-700" />
                        <div className="overflow-hidden">
                            <div className="flex items-center gap-1">
                              <p className="font-black text-slate-900 dark:text-white group-hover:text-primary-600 truncate">{resource.author.name}</p>
                              <UserRankBadge rank={authorRank} size={18} />
                            </div>
                            <p className="text-xs text-slate-500 truncate font-bold">{resource.author.course}</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
      </div>
      
      {isDeleteConfirmOpen && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-800 p-8 rounded-2xl shadow-2xl max-w-sm w-full border dark:border-zinc-700 text-center">
                    <Trash2 size={48} className="text-red-500 mb-4 mx-auto" />
                    <h3 className="text-xl font-bold dark:text-white mb-2">Delete Permanently?</h3>
                    <p className="text-slate-500 mb-6 text-sm">This action will remove the file and all associated discussions forever.</p>
                    <div className="flex gap-3">
                        <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-3 bg-slate-100 dark:bg-zinc-700 font-bold rounded-xl">Cancel</button>
                        <button onClick={() => deleteResource(resource.id, resource.fileUrl)} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl">Delete</button>
                    </div>
                </div>
            </div>
      )}

      {isPreviewOpen && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 md:p-10">
             <div className="bg-white dark:bg-dark-surface rounded-2xl w-full max-w-6xl h-full flex flex-col relative overflow-hidden animate-in zoom-in-95">
                <div className="p-4 border-b dark:border-zinc-700 flex justify-between items-center bg-slate-50 dark:bg-zinc-800">
                    <h3 className="font-bold dark:text-white truncate pr-10">{resource.title}</h3>
                    <button onClick={() => setIsPreviewOpen(false)} className="p-2 rounded-full hover:bg-red-50 text-slate-500 transition absolute right-4"><X size={24} /></button>
                </div>
                <div className="flex-grow bg-slate-200 dark:bg-zinc-900 flex items-center justify-center relative overflow-auto">
                    {resource.fileUrl === '#' ? <div className="p-10 w-full"><MarkdownRenderer content={resource.contentForAI} /></div> : (
                        resource.mimeType?.startsWith('image/') ? <img src={resource.fileUrl} className="max-w-full max-h-full object-contain" /> :
                        <iframe src={resource.fileUrl} className="w-full h-full border-none" />
                    )}
                </div>
            </div>
        </div>
    )}
    <ShareModal isOpen={isShareModalOpen} onClose={() => setIsShareModalOpen(false)} resource={resource} />
    </div>
  );
};

export default ResourceDetailPage;
