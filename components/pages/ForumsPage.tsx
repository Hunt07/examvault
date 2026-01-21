
import React, { useContext, useState } from 'react';
import { AppContext } from '../../App';
import type { ForumPost } from '../../types';
import { ThumbsUp, MessageSquare, PlusCircle, Paperclip, Bookmark, BookmarkCheck } from 'lucide-react';
import CreatePostModal from '../CreatePostModal';
import UserRankBadge from '../UserRankBadge';

const ForumPostCard: React.FC<{ post: ForumPost, onSelect: () => void, onAuthorClick: (authorId: string) => void }> = ({ post, onSelect, onAuthorClick }) => {
    const { userRanks, savedPostIds, toggleSavePost } = useContext(AppContext);
    const authorRank = userRanks.get(post.author.id);
    const isSaved = savedPostIds.includes(post.id);

    return (
        <div onClick={onSelect} className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer border border-transparent dark:border-zinc-700 relative group">
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <div className="flex-grow min-w-0 w-full pr-2">
                    <div className="flex items-center gap-2 mb-2">
                         <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{post.courseCode}</span>
                         {post.attachment && (
                             <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded-full border border-slate-200 dark:border-zinc-700">
                                 <Paperclip size={12} /> File
                             </span>
                         )}
                    </div>
                    <h3 title={post.title} className="text-xl font-bold text-slate-800 dark:text-white hover:text-primary-700 dark:hover:text-primary-400 truncate">{post.title}</h3>
                </div>
                 <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        onAuthorClick(post.author.id);
                    }}
                    className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400 shrink-0 self-end sm:self-auto rounded-md p-2 -mr-2 hover:bg-slate-100 dark:hover:bg-zinc-700"
                    aria-label={`View profile for ${post.author.name}`}
                >
                    <img src={post.author.avatarUrl} alt={post.author.name} className="w-10 h-10 rounded-full" />
                    <div className="text-left">
                        <div className="flex items-center">
                            <p className="font-semibold text-slate-700 dark:text-white">{post.author.name}</p>
                            <UserRankBadge rank={authorRank} size={16} />
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-300">{post.author.course}</p>
                    </div>
                </button>
            </div>
            <p title={post.body} className="text-slate-600 dark:text-slate-200 mt-2 line-clamp-2">{post.body}</p>
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100 dark:border-zinc-700">
                 <div className="flex items-center gap-2 flex-wrap">
                    {post.tags.map(tag => (
                        <span key={tag} className="text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded-full">{tag}</span>
                    ))}
                </div>
                <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm font-medium">
                    <span className="flex items-center">
                        <ThumbsUp size={16} />
                        {post.upvotes > 0 && <span className="ml-1.5">{post.upvotes}</span>}
                    </span>
                    <span className="flex items-center">
                        <MessageSquare size={16} />
                        {post.replies.length > 0 && <span className="ml-1.5">{post.replies.length}</span>}
                    </span>
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleSavePost(post.id);
                        }}
                        className={`flex items-center gap-1.5 transition-colors ${
                            isSaved 
                                ? 'text-amber-500 dark:text-amber-400' 
                                : 'hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                        title={isSaved ? "Unsave Post" : "Save Post"}
                    >
                        {isSaved ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
                    </button>
                </div>
            </div>
        </div>
    );
};


const DiscussionsPage: React.FC = () => {
    const { forumPosts, setView, addForumPost, user: loggedInUser } = useContext(AppContext);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    
    const handleAuthorClick = (authorId: string) => {
        if (authorId === loggedInUser?.id) {
            setView('profile');
        } else {
            setView('publicProfile', authorId);
        }
    };

    return (
        <div>
            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mb-8 flex flex-col md:flex-row gap-4 md:justify-between md:items-center transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <div className="text-center md:text-left">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">Discussions</h1>
                    <p className="text-slate-600 dark:text-slate-200 mt-2">Ask questions, share insights, and connect with your peers.</p>
                </div>
                <button 
                    onClick={() => setIsCreateModalOpen(true)}
                    className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-primary-700 transition"
                >
                    <PlusCircle size={20} />
                    Create Post
                </button>
            </div>
            <div className="space-y-6">
                {forumPosts.map(post => (
                    <ForumPostCard 
                        key={post.id} 
                        post={post} 
                        onSelect={() => setView('forumDetail', post.id)} 
                        onAuthorClick={handleAuthorClick}
                    />
                ))}
            </div>

            {isCreateModalOpen && (
                <CreatePostModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={addForumPost}
                />
            )}
        </div>
    );
};

export default DiscussionsPage;
        