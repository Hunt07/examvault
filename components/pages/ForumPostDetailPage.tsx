
import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import type { ForumPost, ForumReply, Attachment } from '../../types';
import { AppContext } from '../../App';
import { ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle, MessageCircle, Paperclip, Image as ImageIcon, X, FileText, Download, Trash2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import MarkdownToolbar from '../MarkdownToolbar';
import UserRankBadge from '../UserRankBadge';

const ReplyComponent: React.FC<{
    reply: ForumReply;
    post: ForumPost;
    children: React.ReactNode;
}> = ({ reply, post, children }) => {
    const { user, userRanks, setView, handleReplyVote, toggleVerifiedAnswer, addReplyToPost, deleteReplyFromPost } = useContext(AppContext);
    const [isReplying, setIsReplying] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [replyFile, setReplyFile] = useState<File | undefined>(undefined);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const replyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const authorRank = userRanks.get(reply.author.id);
    const isPostAuthor = user?.id === post.author.id;
    const isUpvoted = reply.upvotedBy?.includes(user?.id || '');
    const isOwnReply = user?.id === reply.author.id;

    const handleUserClick = (userId: string) => {
        if (userId === user?.id) {
            setView('profile');
        } else {
            setView('publicProfile', userId);
        }
    };

    const handleVoteForReply = () => {
        if (isOwnReply || !user) return;
        handleReplyVote(post.id, reply.id);
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
            addReplyToPost(post.id, replyText, reply.id, replyFile);
            setReplyText('');
            setReplyFile(undefined);
            setIsReplying(false);
        }
    };

    const handleDelete = () => {
        deleteReplyFromPost(post.id, reply);
        setIsDeleteConfirmOpen(false);
    };

    return (
        <div id={reply.id} className="mt-6 scroll-mt-24 transition-colors duration-1000 p-2 rounded-lg">
            <div className={`flex gap-4 items-start`}>
                <button onClick={() => handleUserClick(reply.author.id)} className="shrink-0">
                    <img src={reply.author.avatarUrl} alt={reply.author.name} className="w-10 h-10 rounded-full" />
                </button>
                <div className="flex-grow bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-transparent dark:border-zinc-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="flex items-center">
                                <button onClick={() => handleUserClick(reply.author.id)} className="font-semibold text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">{reply.author.name}</button>
                                <UserRankBadge rank={authorRank} size={16} />
                            </div>
                            <span className="ml-1 text-sm font-normal text-slate-500 dark:text-slate-300">({reply.author.course})</span>
                            <p className="text-xs text-slate-500 dark:text-slate-300">{new Date(reply.timestamp).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        </div>
                        {reply.isVerified && (
                             <div className="inline-flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-300 bg-green-200 dark:bg-green-900/50 px-3 py-1 rounded-full">
                                <CheckCircle size={16} />
                                Verified Answer
                            </div>
                        )}
                    </div>
                    <div className="mt-2 dark:text-slate-200">
                        <MarkdownRenderer content={reply.text} />
                    </div>

                    {/* Render Attachments for existing reply */}
                    {reply.attachment && (
                        <div className="mt-3">
                            {reply.attachment.type === 'image' ? (
                                <img src={reply.attachment.url} alt="Attachment" className="max-h-60 rounded-lg border border-slate-200 dark:border-zinc-700" />
                            ) : (
                                <a href={reply.attachment.url} download={reply.attachment.name} className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-zinc-800 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-700 transition w-fit group">
                                    <div className="p-2 bg-white dark:bg-zinc-900 rounded-md">
                                        <FileText size={24} className="text-primary-500" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{reply.attachment.name}</span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400">{reply.attachment.size || 'File'}</span>
                                    </div>
                                    <Download size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-2" />
                                </a>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                        <button
                            onClick={handleVoteForReply}
                            disabled={isOwnReply}
                            className={`flex items-center p-2 text-sm font-semibold rounded-lg transition-colors ${
                                isUpvoted
                                    ? 'bg-primary-600 text-white'
                                    : isOwnReply
                                    ? 'bg-slate-100 dark:bg-zinc-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                    : 'bg-white dark:bg-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-600'
                            }`}
                        >
                            <ThumbsUp size={14} />
                            {reply.upvotes > 0 && <span className="ml-1.5">{reply.upvotes}</span>}
                        </button>
                        {user && user.id !== reply.author.id && (
                            <button
                                onClick={() => setIsReplying(!isReplying)}
                                className="flex items-center gap-1.5 p-2 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-zinc-700 hover:bg-slate-200 dark:hover:bg-zinc-600 rounded-lg transition-colors"
                            >
                                <MessageCircle size={14} /> Reply
                            </button>
                        )}
                        {isPostAuthor && user && user.id !== reply.author.id && (
                            <button
                                onClick={() => toggleVerifiedAnswer(post.id, reply.id)}
                                className={`text-xs font-bold py-1 px-2 rounded-md transition ${reply.isVerified ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-200 dark:bg-zinc-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-zinc-600'}`}
                            >
                                {reply.isVerified ? 'Unverify' : 'Mark as Verified'}
                            </button>
                        )}
                        {isOwnReply && (
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
                                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Reply?</h3>
                                            <p className="text-slate-500 dark:text-slate-400 mb-6">Are you sure you want to delete this reply?</p>
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
                        <img src={user?.avatarUrl} alt={user?.name} className="w-8 h-8 rounded-full" />
                        <div className="flex-grow">
                             <MarkdownToolbar
                                textareaRef={replyTextareaRef}
                                value={replyText}
                                onValueChange={setReplyText}
                            />
                            {replyFile && (
                                <div className="bg-slate-50 dark:bg-zinc-900 border-x border-slate-300 dark:border-zinc-700 px-4 py-2 flex items-center justify-between">
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
                                placeholder={`Replying to ${reply.author.name}...`}
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


const ForumPostDetailPage: React.FC<{ post: ForumPost }> = ({ post }) => {
    const { user, userRanks, setView, handlePostVote, addReplyToPost, goBack, deleteForumPost, scrollTargetId, setScrollTargetId } = useContext(AppContext);
    
    const [newReplyText, setNewReplyText] = useState('');
    const [newReplyFile, setNewReplyFile] = useState<File | undefined>(undefined);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    
    const mainReplyTextareaRef = useRef<HTMLTextAreaElement>(null);
    const mainFileInputRef = useRef<HTMLInputElement>(null);
    
    const isOwnPost = user?.id === post.author.id;
    const isUpvoted = post.upvotedBy?.includes(user?.id || '');
    const isDownvoted = post.downvotedBy?.includes(user?.id || '');
    
    const authorRank = userRanks.get(post.author.id);
    const repliesByParentId = useMemo(() => {
        const group: Record<string, ForumReply[]> = {};
        for (const reply of post.replies) {
            const parentId = reply.parentId || 'root';
            if (!group[parentId]) {
                group[parentId] = [];
            }
            group[parentId].push(reply);
        }
        for (const parentId in group) {
            if (parentId !== 'root') {
                 group[parentId].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            }
        }
        if (group['root']) {
            group['root'].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        }
        return group;
    }, [post.replies]);

    // Handle Deep Linking / Scrolling for Replies
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
    }, [scrollTargetId, post.id]);

    const handleUpvote = () => {
        if (isOwnPost || !user) return;
        handlePostVote(post.id, 'up');
    };

    const handleDownvote = () => {
        if (isOwnPost || !user) return;
        handlePostVote(post.id, 'down');
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setNewReplyFile(file);
        }
    };

    const removeAttachment = () => {
        setNewReplyFile(undefined);
        if (mainFileInputRef.current) mainFileInputRef.current.value = '';
    };
    
    const handlePostReply = (e: React.FormEvent) => {
        e.preventDefault();
        if ((newReplyText.trim() || newReplyFile) && user) {
            addReplyToPost(post.id, newReplyText, null, newReplyFile);
            setNewReplyText('');
            setNewReplyFile(undefined);
            if (mainFileInputRef.current) mainFileInputRef.current.value = '';
        }
    };

    const confirmDelete = () => {
        deleteForumPost(post.id);
        setIsDeleteConfirmOpen(false);
    };

    const renderReplies = (parentId: string | null) => {
        const replies = repliesByParentId[parentId || 'root'] || [];
        return replies.map(reply => (
            <ReplyComponent key={reply.id} reply={reply} post={post}>
                {renderReplies(reply.id)}
            </ReplyComponent>
        ));
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition">
                    <ArrowLeft size={20} />
                    Back to all posts
                </button>
                {isOwnPost && (
                    <>
                        <button 
                            onClick={() => setIsDeleteConfirmOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition font-semibold text-sm"
                        >
                            <Trash2 size={16} />
                            Delete Post
                        </button>
                        {isDeleteConfirmOpen && (
                            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
                                <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                                    <div className="flex flex-col items-center text-center">
                                        <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4">
                                            <Trash2 size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Delete Discussion?</h3>
                                        <p className="text-slate-500 dark:text-slate-400 mb-6">
                                            Are you sure you want to delete this post? This action cannot be undone.
                                        </p>
                                        <div className="flex gap-3 w-full">
                                            <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2.5 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">Cancel</button>
                                            <button onClick={confirmDelete} className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">Delete</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 md:p-8 rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <div className="pb-6 border-b border-slate-200 dark:border-zinc-700">
                    <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{post.courseCode}</span>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-4">{post.title}</h1>
                    <div className="flex items-center gap-4 mt-4 text-sm text-slate-500 dark:text-slate-400">
                        <button onClick={() => setView(user?.id === post.author.id ? 'profile' : 'publicProfile', post.author.id)} className="flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800 p-1 rounded-md transition">
                            <img src={post.author.avatarUrl} alt={post.author.name} className="w-10 h-10 rounded-full" />
                            <div className="text-left">
                                <div className="flex items-center">
                                    <p className="font-semibold text-slate-800 dark:text-slate-200">{post.author.name}</p>
                                    <UserRankBadge rank={authorRank} />
                                </div>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{post.author.course}</p>
                            </div>
                        </button>
                        <span>•</span>
                        <span>Posted on {new Date(post.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>

                <div className="py-6 max-w-none dark:text-slate-200">
                    <MarkdownRenderer content={post.body} />
                </div>

                {/* Post Attachment */}
                {post.attachment && (
                    <div className="mb-6">
                        {post.attachment.type === 'image' ? (
                            <img src={post.attachment.url} alt="Attachment" className="max-h-96 rounded-lg border border-slate-200 dark:border-zinc-700 shadow-sm" />
                        ) : (
                            <a href={post.attachment.url} download={post.attachment.name} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-lg border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition w-fit group">
                                <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg shadow-sm group-hover:scale-105 transition-transform">
                                    <FileText size={28} className="text-primary-500" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="font-semibold text-slate-800 dark:text-slate-200 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition">{post.attachment.name}</span>
                                    <span className="text-xs text-slate-500 dark:text-slate-400">{post.attachment.size || 'File attachment'}</span>
                                </div>
                                <Download size={20} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 ml-4" />
                            </a>
                        )}
                    </div>
                )}

                <div className="pt-6 border-t border-slate-200 dark:border-zinc-700 flex items-center gap-4">
                     <button
                        onClick={handleUpvote}
                        disabled={isOwnPost}
                        className={`flex items-center gap-2 p-3 rounded-lg transition font-semibold ${
                            isUpvoted
                                ? 'bg-primary-600 text-white'
                                : isOwnPost
                                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                        }`}
                     >
                        <ThumbsUp size={18} />
                        <span>Upvote{post.upvotes > 0 ? ` (${post.upvotes})` : ''}</span>
                    </button>
                    <button
                        onClick={handleDownvote}
                        disabled={isOwnPost}
                        className={`flex items-center gap-2 p-3 rounded-lg transition font-semibold ${
                            isDownvoted
                                ? 'bg-red-600 text-white'
                                : isOwnPost
                                ? 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50'
                        }`}
                    >
                        <ThumbsDown size={18} />
                        {post.downvotes > 0 && <span>{post.downvotes}</span>}
                    </button>
                    <div className="flex items-center gap-2 ml-auto">
                        {post.tags.map(tag => (
                            <span key={tag} className="text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded-full">{tag}</span>
                        ))}
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 md:p-8 rounded-xl shadow-md mt-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <h3 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">Replies ({post.replies.length})</h3>
                
                <form onSubmit={handlePostReply}>
                    <div className="flex gap-4 items-start pb-6 mb-6 border-b border-slate-200 dark:border-zinc-700">
                        <img src={user?.avatarUrl} alt={user?.name} className="w-10 h-10 rounded-full" />
                        <div className="flex-grow">
                             <MarkdownToolbar
                                textareaRef={mainReplyTextareaRef}
                                value={newReplyText}
                                onValueChange={setNewReplyText}
                            />
                            {newReplyFile && (
                                <div className="bg-slate-50 dark:bg-zinc-900 border-x border-slate-300 dark:border-zinc-700 px-4 py-2 flex items-center justify-between">
                                     <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                                        {newReplyFile.type.startsWith('image/') ? <ImageIcon size={16}/> : <FileText size={16}/>}
                                        <span className="truncate max-w-xs">{newReplyFile.name}</span>
                                     </div>
                                     <button type="button" onClick={removeAttachment} className="text-slate-500 hover:text-red-500">
                                        <X size={16} />
                                     </button>
                                </div>
                            )}
                            <textarea
                                ref={mainReplyTextareaRef}
                                value={newReplyText}
                                onChange={(e) => setNewReplyText(e.target.value)}
                                placeholder="Add your reply..."
                                className={`w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-2 border border-slate-300 dark:border-zinc-700 ${newReplyFile ? 'border-t-0' : ''} rounded-b-lg focus:ring-primary-500 focus:border-primary-500 transition focus:outline-none`}
                                rows={3}
                            />
                            <input 
                                type="file" 
                                ref={mainFileInputRef} 
                                className="hidden" 
                                onChange={handleFileSelect}
                            />
                            <div className="flex items-center gap-2 mt-2">
                                <button type="submit" className="bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition">
                                    Post Reply
                                </button>
                                <button 
                                    type="button" 
                                    onClick={() => mainFileInputRef.current?.click()}
                                    className="bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-300 font-semibold py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition flex items-center gap-2"
                                >
                                    <Paperclip size={18} />
                                    Attach File
                                </button>
                            </div>
                        </div>
                    </div>
                </form>

                <div>
                    {renderReplies(null)}
                </div>

            </div>
        </div>
    );
};

export default ForumPostDetailPage;
