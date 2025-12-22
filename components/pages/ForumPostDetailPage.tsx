
import React, { useContext, useState, useMemo, useRef } from 'react';
import type { ForumPost, ForumReply, Attachment } from '../../types';
import { AppContext } from '../../App';
import { ArrowLeft, ThumbsUp, ThumbsDown, CheckCircle, Trash2, X, Eye, Loader2 } from 'lucide-react';
import MarkdownRenderer from '../MarkdownRenderer';
import UserRankBadge from '../UserRankBadge';
// Added missing Avatar import
import Avatar from '../Avatar';

const ReplyComponent: React.FC<{
    reply: ForumReply;
    post: ForumPost;
    children: React.ReactNode;
}> = ({ reply, post, children }) => {
    const { user, userRanks, setView, handleReplyVote, toggleVerifiedAnswer, deleteReplyFromPost } = useContext(AppContext);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);

    const authorRank = userRanks.get(reply.author.id);
    const isUpvoted = reply.upvotedBy?.includes(user?.id || '');
    const isOwnReply = user?.id === reply.author.id;
    const canDelete = isOwnReply || user?.isAdmin;

    const handleUserClick = (userId: string) => {
        if (userId === user?.id) setView('profile');
        else setView('publicProfile', userId);
    };

    return (
        <div id={reply.id} className="mt-6 scroll-mt-24 p-2 rounded-lg">
            <div className="flex gap-4 items-start">
                <button onClick={() => handleUserClick(reply.author.id)} className="shrink-0">
                    <img src={reply.author.avatarUrl} alt={reply.author.name} className="w-10 h-10 rounded-full" />
                </button>
                <div className="flex-grow bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border dark:border-zinc-700">
                    <div className="flex justify-between items-start">
                        <div>
                            <button onClick={() => handleUserClick(reply.author.id)} className="font-semibold dark:text-white hover:text-primary-600 transition-colors">{reply.author.name}</button>
                            <UserRankBadge rank={authorRank} size={16} />
                            <p className="text-xs text-slate-500 mt-1">{new Date(reply.timestamp).toLocaleString()}</p>
                        </div>
                        {reply.isVerified && <div className="text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1"><CheckCircle size={14}/> Verified</div>}
                    </div>
                    <div className="mt-2 prose-sm dark:prose-invert"><MarkdownRenderer content={reply.text} /></div>
                    <div className="flex items-center gap-3 mt-3">
                        <button onClick={() => handleReplyVote(post.id, reply.id)} className={`p-2 rounded-lg flex items-center gap-1 text-sm transition-colors ${isUpvoted ? 'bg-primary-600 text-white' : 'bg-white dark:bg-zinc-800 hover:bg-slate-100 dark:hover:bg-zinc-700 dark:text-white'}`}><ThumbsUp size={14}/> {reply.upvotes}</button>
                        {user?.id === post.author.id && !isOwnReply && <button onClick={() => toggleVerifiedAnswer(post.id, reply.id)} className="text-xs font-bold px-2 py-1 bg-slate-100 dark:bg-zinc-700 dark:text-white rounded hover:bg-slate-200 dark:hover:bg-zinc-600 transition">Toggle Verified</button>}
                        {canDelete && (
                            <button 
                                onClick={() => setIsDeleteConfirmOpen(true)} 
                                className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                                title={user?.isAdmin && !isOwnReply ? "Delete (Admin Override)" : "Delete Reply"}
                            >
                                <Trash2 size={14}/>
                            </button>
                        )}
                    </div>
                </div>
            </div>
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl text-center max-w-xs w-full shadow-2xl border dark:border-zinc-700">
                        <h3 className="font-bold mb-4 dark:text-white">Delete Reply?</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{user?.isAdmin && !isOwnReply ? "As an administrator, you are removing this reply." : "This cannot be undone."}</p>
                        <div className="flex gap-2">
                            <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 dark:text-white rounded">Cancel</button>
                            <button onClick={() => deleteReplyFromPost(post.id, reply)} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Delete</button>
                        </div>
                    </div>
                </div>
            )}
            <div className="pl-8 border-l-2 border-slate-100 dark:border-zinc-800 ml-5">{children}</div>
        </div>
    );
};

const ForumPostDetailPage: React.FC<{ post: ForumPost }> = ({ post }) => {
    const { user, setView, handlePostVote, addReplyToPost, goBack, deleteForumPost } = useContext(AppContext);
    const [newReplyText, setNewReplyText] = useState('');
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isUpvoted = post.upvotedBy?.includes(user?.id || '');
    const isDownvoted = post.downvotedBy?.includes(user?.id || '');
    const isAuthor = user?.id === post.author.id;
    const canDelete = isAuthor || user?.isAdmin;

    const repliesByParentId = useMemo(() => {
        const group: Record<string, ForumReply[]> = {};
        for (const r of post.replies) {
            const pId = r.parentId || 'root';
            if (!group[pId]) group[pId] = [];
            group[pId].push(r);
        }
        return group;
    }, [post.replies]);

    const handleReplySubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newReplyText.trim()) {
            addReplyToPost(post.id, newReplyText, null);
            setNewReplyText('');
        }
    };

    const renderReplies = (parentId: string | null) => {
        const list = repliesByParentId[parentId || 'root'] || [];
        return list.map(r => <ReplyComponent key={r.id} reply={r} post={post}>{renderReplies(r.id)}</ReplyComponent>);
    };

    return (
        <div>
            <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold mb-6 hover:underline transition"><ArrowLeft size={20}/> Back</button>
            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border dark:border-zinc-700">
                <div className="border-b dark:border-zinc-700 pb-6 mb-6">
                    <div className="flex justify-between items-start">
                        <span className="text-xs font-bold px-3 py-1 bg-slate-100 dark:bg-zinc-800 dark:text-white rounded-full">{post.courseCode}</span>
                        {user?.isAdmin && !isAuthor && (
                            <span className="px-2 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[9px] font-black uppercase rounded">Moderator Access</span>
                        )}
                    </div>
                    <h1 className="text-3xl font-bold mt-4 dark:text-white">{post.title}</h1>
                    <div className="flex items-center gap-4 mt-4 text-sm text-slate-500">
                        <Avatar src={post.author.avatarUrl} alt={post.author.name} className="w-8 h-8 cursor-pointer" onClick={() => setView('publicProfile', post.author.id)}/>
                        <span className="dark:text-slate-400">{post.author.name} • {new Date(post.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
                <div className="prose-sm dark:prose-invert mb-8"><MarkdownRenderer content={post.body} /></div>
                <div className="flex gap-2 border-t dark:border-zinc-700 pt-6">
                    <button onClick={() => handlePostVote(post.id, 'up')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold ${isUpvoted ? 'bg-primary-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}><ThumbsUp size={18}/> {post.upvotes || 0}</button>
                    <button onClick={() => handlePostVote(post.id, 'down')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition font-bold ${isDownvoted ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-zinc-800 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700'}`}><ThumbsDown size={18}/> {post.downvotes || 0}</button>
                    {canDelete && (
                        <button 
                            onClick={() => setIsDeleteConfirmOpen(true)} 
                            className="ml-auto p-2 text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition"
                            title={user?.isAdmin && !isAuthor ? "Delete (Admin Override)" : "Delete Post"}
                        >
                            <Trash2 size={20}/>
                        </button>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md mt-8 border dark:border-zinc-700">
                <h3 className="text-xl font-bold mb-6 dark:text-white">Replies</h3>
                <form onSubmit={handleReplySubmit} className="mb-8 border-b dark:border-zinc-700 pb-8">
                    <textarea ref={textareaRef} value={newReplyText} onChange={(e)=>setNewReplyText(e.target.value)} placeholder="Add your reply..." className="w-full bg-slate-50 dark:bg-zinc-800 dark:text-white p-4 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 outline-none transition" rows={3}/>
                    <div className="mt-2 flex justify-end"><button type="submit" className="bg-primary-600 text-white font-bold py-2 px-6 rounded-lg hover:bg-primary-700 transition shadow-sm">Post Reply</button></div>
                </form>
                <div>{renderReplies(null)}</div>
            </div>

            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl max-sm:w-full max-w-sm text-center shadow-2xl border dark:border-zinc-700">
                        <Trash2 size={48} className="mx-auto text-red-500 mb-4" />
                        <h3 className="text-xl font-bold mb-2 dark:text-white">Delete Discussion?</h3>
                        <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">{user?.isAdmin && !isAuthor ? "You are removing this post as a moderator. This will delete all replies." : "This will remove the post and all replies permanently."}</p>
                        <div className="flex gap-3">
                            <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 dark:text-white rounded-lg">Cancel</button>
                            <button onClick={() => deleteForumPost(post.id)} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ForumPostDetailPage;
