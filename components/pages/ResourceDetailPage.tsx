
import React, { useState, useContext, useRef, useMemo, useEffect } from 'react';
import type { Resource, Comment, Flashcard, QuizQuestion } from '../../types';
import { AppContext } from '../../App';
import { summarizeContent, generateStudySet } from '../../services/geminiService';
import { ArrowLeft, ArrowRight, ThumbsUp, ThumbsDown, MessageSquare, Download, BrainCircuit, Loader2, FileText, Notebook, Bell, BellOff, Flag, CheckCircle, MessageCircle, BookCopy, HelpCircle, Eye, X, AlertCircle, FileType, Bookmark, BookmarkCheck, Share2, Trash2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';
import FlashcardViewer from '../FlashcardViewer';
import QuizComponent from '../QuizComponent';
import ShareModal from '../ShareModal';
import ResourceCard from '../ResourceCard';
import { db } from '../../services/firebase';
import { collection, addDoc } from 'firebase/firestore';
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
          <Avatar src={comment.author.avatarUrl} name={comment.author.name} className="w-10 h-10 rounded-full" />
        </button>
        <div className="flex-grow bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-transparent dark:border-zinc-700">
           <div className="flex justify-between items-start">
                <div className="flex items-center">
                    <button onClick={() => handleUserClick(comment.author.id)} className="font-semibold text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">{comment.author.name}</button>
                    <UserRankBadge rank={authorRank} size={16} />
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">{new Date(comment.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </div>
            </div>
            <div className="mt-2 text-slate-700 dark:text-slate-200">
                {comment.text}
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
                            className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
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
                <Avatar src={user?.avatarUrl || ''} name={user?.name || ''} className="w-8 h-8 rounded-full" />
                <div className="flex-grow">
                    <textarea
                        ref={replyTextareaRef}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder={`Replying to ${comment.author.name}...`}
                        className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none"
                        rows={2}
                        autoFocus
                    />
                    <div className="flex gap-2 mt-2 items-center justify-end">
                        <button type="button" onClick={() => setIsReplying(false)} className="bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 font-semibold py-1 px-3 rounded-lg hover:bg-slate-300 dark:hover:bg-zinc-600 transition text-sm">
                            Cancel
                        </button>
                        <button type="submit" className="bg-primary-600 text-white font-semibold py-1 px-3 rounded-lg hover:bg-primary-700 transition text-sm">
                            Post Reply
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
    const { user, userRanks, setView, toggleSaveResource, handleVote, addCommentToResource, goBack, deleteResource, savedResourceIds, scrollTargetId, setScrollTargetId } = useContext(AppContext);
    
    const [summary, setSummary] = useState<string | null>(null);
    const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
    
    const [flashcards, setFlashcards] = useState<Flashcard[] | null>(null);
    const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
    
    const [quiz, setQuiz] = useState<QuizQuestion[] | null>(null);
    const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
    
    const [commentText, setCommentText] = useState('');
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isDeleteResourceConfirmOpen, setIsDeleteResourceConfirmOpen] = useState(false);

    const isSaved = savedResourceIds.includes(resource.id);
    const isUpvoted = resource.upvotedBy?.includes(user?.id || '');
    const isDownvoted = resource.downvotedBy?.includes(user?.id || '');
    const isOwner = user?.id === resource.author.id;
    const authorRank = userRanks.get(resource.author.id);

    // Deep linking scroll
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

    const handleGenerateSummary = async () => {
        setIsGeneratingSummary(true);
        const result = await summarizeContent(resource.contentForAI, resource.fileBase64, resource.mimeType);
        setSummary(result);
        setIsGeneratingSummary(false);
    };

    const handleGenerateFlashcards = async () => {
        setIsGeneratingFlashcards(true);
        const result = await generateStudySet(resource.contentForAI, 'flashcards', resource.fileBase64, resource.mimeType);
        setFlashcards(result);
        setIsGeneratingFlashcards(false);
    };

    const handleGenerateQuiz = async () => {
        setIsGeneratingQuiz(true);
        const result = await generateStudySet(resource.contentForAI, 'quiz', resource.fileBase64, resource.mimeType);
        setQuiz(result);
        setIsGeneratingQuiz(false);
    };
    
    const handleCommentSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (commentText.trim()) {
            addCommentToResource(resource.id, commentText, null);
            setCommentText('');
        }
    };

    const handleDeleteResource = async () => {
        await deleteResource(resource.id, resource.fileUrl, resource.previewImageUrl);
    };

    // Organize comments hierarchically
    const commentsByParentId = useMemo(() => {
        const group: Record<string, Comment[]> = {};
        if (resource.comments) {
            for (const comment of resource.comments) {
                const parentId = comment.parentId || 'root';
                if (!group[parentId]) {
                    group[parentId] = [];
                }
                group[parentId].push(comment);
            }
        }
        // Sort by timestamp
        for (const key in group) {
            group[key].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
        return group;
    }, [resource.comments]);

    const renderComments = (parentId: string | null) => {
        const comments = commentsByParentId[parentId || 'root'] || [];
        return comments.map(comment => (
            <CommentComponent key={comment.id} comment={comment} resourceId={resource.id}>
                {renderComments(comment.id)}
            </CommentComponent>
        ));
    };

    return (
        <div className="max-w-6xl mx-auto animate-in fade-in duration-300">
            <div className="flex justify-between items-center mb-6">
                <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition">
                    <ArrowLeft size={20} />
                    Back
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Resource Info & Preview */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden border border-transparent dark:border-zinc-700">
                        <div className="relative h-64 md:h-80 bg-slate-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden group">
                             <div className="absolute inset-0 bg-cover bg-center blur-sm opacity-50" style={{ backgroundImage: `url(${resource.previewImageUrl})` }}></div>
                             <img 
                                src={resource.previewImageUrl} 
                                alt={resource.title} 
                                className="relative z-10 h-full w-auto object-contain shadow-lg transition-transform duration-300 group-hover:scale-105" 
                             />
                        </div>
                        
                        <div className="p-6 md:p-8">
                            <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${resource.type === 'Past Paper' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300'}`}>
                                            {resource.type}
                                        </span>
                                        <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 text-xs font-bold uppercase tracking-wider">
                                            {resource.courseCode}
                                        </span>
                                    </div>
                                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">{resource.title}</h1>
                                    <p className="text-lg text-slate-600 dark:text-slate-300">{resource.courseName}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <button 
                                        onClick={() => toggleSaveResource(resource.id)} 
                                        className={`p-3 rounded-lg transition border ${isSaved ? 'bg-primary-600 text-white border-primary-600' : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
                                        title={isSaved ? "Unsave" : "Save"}
                                    >
                                        {isSaved ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
                                    </button>
                                    <button 
                                        onClick={() => setIsShareModalOpen(true)}
                                        className="p-3 rounded-lg bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 transition"
                                        title="Share"
                                    >
                                        <Share2 size={20} />
                                    </button>
                                    {isOwner && (
                                        <button 
                                            onClick={() => setIsDeleteResourceConfirmOpen(true)}
                                            className="p-3 rounded-lg bg-white dark:bg-zinc-800 text-red-600 dark:text-red-400 border border-slate-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
                                            title="Delete"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>

                             {isDeleteResourceConfirmOpen && (
                                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                                    <div className="flex items-center gap-3 text-red-800 dark:text-red-200">
                                        <AlertCircle size={24} />
                                        <p className="font-semibold">Are you sure you want to delete this resource?</p>
                                    </div>
                                    <div className="flex gap-3">
                                        <button onClick={() => setIsDeleteResourceConfirmOpen(false)} className="px-4 py-2 bg-white dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-700 transition">Cancel</button>
                                        <button onClick={handleDeleteResource} className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">Delete</button>
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                                <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Year</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{resource.year}</p>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                                    <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Semester</p>
                                    <p className="font-semibold text-slate-800 dark:text-white">{resource.semester}</p>
                                </div>
                                {resource.lecturer && (
                                    <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg col-span-2 md:col-span-1">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Lecturer</p>
                                        <p className="font-semibold text-slate-800 dark:text-white truncate" title={resource.lecturer}>{resource.lecturer}</p>
                                    </div>
                                )}
                                {resource.examType && (
                                    <div className="p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg col-span-2 md:col-span-1">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-1">Exam Type</p>
                                        <p className="font-semibold text-slate-800 dark:text-white">{resource.examType}</p>
                                    </div>
                                )}
                            </div>
                            
                            <div className="prose dark:prose-invert max-w-none mb-8">
                                <h3 className="text-lg font-bold mb-2 text-slate-800 dark:text-white">Description</h3>
                                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{resource.description}</p>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center gap-4 pt-6 border-t border-slate-100 dark:border-zinc-700">
                                <a 
                                    href={resource.fileUrl} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full sm:w-auto bg-primary-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                                >
                                    <Download size={20} />
                                    Download File
                                </a>
                                <div className="flex items-center gap-4 w-full sm:w-auto justify-center">
                                    <button 
                                        onClick={() => handleVote(resource.id, 'up')}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition ${isUpvoted ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                                    >
                                        <ThumbsUp size={20} className={isUpvoted ? 'fill-current' : ''} />
                                        <span>{resource.upvotes}</span>
                                    </button>
                                    <button 
                                        onClick={() => handleVote(resource.id, 'down')}
                                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-semibold transition ${isDownvoted ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'}`}
                                    >
                                        <ThumbsDown size={20} className={isDownvoted ? 'fill-current' : ''} />
                                        {resource.downvotes > 0 && <span>{resource.downvotes}</span>}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Comments Section */}
                    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md p-6 md:p-8 border border-transparent dark:border-zinc-700">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <MessageSquare size={24} className="text-primary-600 dark:text-primary-400" />
                            Discussion ({resource.comments?.length || 0})
                        </h3>
                        
                        <form onSubmit={handleCommentSubmit} className="mb-8">
                            <div className="flex gap-4">
                                <Avatar src={user?.avatarUrl || ''} name={user?.name || ''} className="w-10 h-10 rounded-full" />
                                <div className="flex-grow">
                                    <textarea
                                        value={commentText}
                                        onChange={(e) => setCommentText(e.target.value)}
                                        placeholder="Add a comment or ask a question..."
                                        className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-3 border border-slate-300 dark:border-zinc-700 rounded-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none"
                                        rows={3}
                                    />
                                    <div className="flex justify-end mt-2">
                                        <button 
                                            type="submit" 
                                            disabled={!commentText.trim()}
                                            className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Post Comment
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                        <div className="space-y-6">
                            {renderComments(null)}
                            {(!resource.comments || resource.comments.length === 0) && (
                                <div className="text-center py-8 text-slate-500 dark:text-slate-400 italic">
                                    No comments yet. Be the first to start the discussion!
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: AI Tools & Author */}
                <div className="space-y-6">
                    {/* Author Card */}
                    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md p-6 border border-transparent dark:border-zinc-700">
                        <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Uploaded By</h3>
                        <div className="flex items-center gap-4">
                            <button onClick={() => setView(user?.id === resource.author.id ? 'profile' : 'publicProfile', resource.author.id)}>
                                <Avatar src={resource.author.avatarUrl} name={resource.author.name} className="w-14 h-14 rounded-full border-2 border-slate-100 dark:border-zinc-700" />
                            </button>
                            <div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setView(user?.id === resource.author.id ? 'profile' : 'publicProfile', resource.author.id)} className="font-bold text-slate-900 dark:text-white hover:underline">
                                        {resource.author.name}
                                    </button>
                                    <UserRankBadge rank={authorRank} size={18} />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{resource.author.course}</p>
                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                    Joined {new Date(resource.author.joinDate).toLocaleDateString()}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* AI Tools */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <BrainCircuit size={100} />
                        </div>
                        <div className="relative z-10">
                            <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                <BrainCircuit size={24} />
                                AI Study Companion
                            </h3>
                            <p className="text-indigo-100 text-sm mb-6">Enhance your learning with AI-generated summaries and quizzes based on this resource.</p>
                            
                            <div className="space-y-3">
                                <button 
                                    onClick={handleGenerateSummary}
                                    disabled={isGeneratingSummary}
                                    className="w-full bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    {isGeneratingSummary ? <Loader2 className="animate-spin" size={20} /> : <FileText size={20} />}
                                    {summary ? "Regenerate Summary" : "Generate Summary"}
                                </button>
                                
                                <button 
                                    onClick={handleGenerateFlashcards}
                                    disabled={isGeneratingFlashcards}
                                    className="w-full bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    {isGeneratingFlashcards ? <Loader2 className="animate-spin" size={20} /> : <BookCopy size={20} />}
                                    {flashcards ? "Regenerate Flashcards" : "Create Flashcards"}
                                </button>

                                <button 
                                    onClick={handleGenerateQuiz}
                                    disabled={isGeneratingQuiz}
                                    className="w-full bg-white/20 hover:bg-white/30 border border-white/30 backdrop-blur-sm text-white font-semibold py-3 px-4 rounded-lg transition flex items-center justify-center gap-2"
                                >
                                    {isGeneratingQuiz ? <Loader2 className="animate-spin" size={20} /> : <HelpCircle size={20} />}
                                    {quiz ? "Regenerate Quiz" : "Generate Quiz"}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* AI Output Area */}
                    {(summary || flashcards || quiz) && (
                        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md p-6 border border-transparent dark:border-zinc-700 animate-in slide-in-from-bottom-4 duration-500">
                             {summary && (
                                <div className="mb-8">
                                    <div className="flex justify-between items-center mb-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                            <FileText size={20} className="text-indigo-600 dark:text-indigo-400" />
                                            Key Takeaways
                                        </h4>
                                    </div>
                                    <div className="prose dark:prose-invert prose-sm max-w-none bg-slate-50 dark:bg-zinc-800/50 p-4 rounded-lg">
                                        <MarkdownRenderer content={summary} />
                                    </div>
                                </div>
                            )}

                            {flashcards && (
                                <div className="mb-8 border-t border-slate-100 dark:border-zinc-700 pt-6">
                                    <FlashcardViewer flashcards={flashcards} onReset={handleGenerateFlashcards} />
                                </div>
                            )}

                            {quiz && (
                                <div className="border-t border-slate-100 dark:border-zinc-700 pt-6">
                                    <QuizComponent questions={quiz} onReset={handleGenerateQuiz} />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <ShareModal 
                isOpen={isShareModalOpen} 
                onClose={() => setIsShareModalOpen(false)} 
                resource={resource}
            />
        </div>
    );
};

export default ResourceDetailPage;
