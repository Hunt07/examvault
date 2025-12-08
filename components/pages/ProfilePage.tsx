
import React, { useMemo, useContext, useState } from 'react';
import type { User, Resource } from '../../types';
import { ResourceRequestStatus } from '../../types';
import { AppContext } from '../../App';
import ResourceCard from '../ResourceCard';
import { Award, UploadCloud, Calendar, MessageSquare as MessageSquareIcon, Edit, X, Save, ArrowLeft, UserPlus, UserMinus, ThumbsUp, MessageSquare, Clock, Loader2 } from 'lucide-react';
import UserRankBadge from '../UserRankBadge';
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import Avatar from '../Avatar';

interface ProfilePageProps {
  user: User;
  allResources: Resource[];
  isCurrentUser: boolean;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
    <div className="bg-white dark:bg-dark-surface p-4 rounded-xl shadow-md flex items-center gap-4 transition-colors duration-300 border border-transparent dark:border-zinc-700">
        <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 p-3 rounded-full">
            {icon}
        </div>
        <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        </div>
    </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ user, allResources, isCurrentUser }) => {
    const { userRanks, setView, forumPosts, updateUserProfile, user: loggedInUser, goBack, toggleUserSubscription, startConversation, resourceRequests } = useContext(AppContext);

    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(user.name);
    const [editedBio, setEditedBio] = useState(user.bio);
    const [editedAvatarUrl, setEditedAvatarUrl] = useState(user.avatarUrl);
    const [editedCourse, setEditedCourse] = useState(user.course);
    const [editedYear, setEditedYear] = useState(user.currentYear);
    const [editedSemester, setEditedSemester] = useState(user.currentSemester);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    
    const userResources = useMemo(() => {
        return allResources.filter(resource => resource.author.id === user.id);
    }, [allResources, user.id]);

    const userForumPosts = useMemo(() => {
        return forumPosts.filter(post => post.author.id === user.id);
    }, [forumPosts, user.id]);

    const userOpenRequests = useMemo(() => {
        if (!isCurrentUser) return [];
        return resourceRequests.filter(req => req.requester.id === user.id && req.status === ResourceRequestStatus.Open);
    }, [resourceRequests, user.id, isCurrentUser]);

    const userRank = userRanks.get(user.id);

    const isFollowing = useMemo(() => {
        return loggedInUser?.subscriptions.users.includes(user.id) ?? false;
    }, [loggedInUser, user.id]);

    const formattedJoinDate = useMemo(() => {
        if (!user.joinDate) return 'N/A';
        const date = new Date(user.joinDate);
        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    }, [user.joinDate]);

    const courseOptions = [
        "BCS (Hons)",
        "BSE (Hons)",
        "BCE (Hons)",
        "BGD (Hons)",
        "BMM (Hons)",
        "BIT (Hons)",
        "DIT",
        "DDM",
        "DRA",
        "DGD",
        "DIDM",
        "DSE",
        "DFT"
    ];

    const handleSave = () => {
        if (editedName.trim() === '') {
            alert('Name cannot be empty.');
            return;
        }
        updateUserProfile({
            name: editedName,
            bio: editedBio,
            avatarUrl: editedAvatarUrl,
            course: editedCourse,
            currentYear: editedYear,
            currentSemester: editedSemester
        });
        setIsEditing(false);
    };

    const handleCancel = () => {
        setEditedName(user.name);
        setEditedBio(user.bio);
        setEditedAvatarUrl(user.avatarUrl);
        setEditedCourse(user.course);
        setEditedYear(user.currentYear);
        setEditedSemester(user.currentSemester);
        setIsEditing(false);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && loggedInUser) {
            setIsUploadingAvatar(true);
            try {
                // Upload to Firebase Storage
                const storageRef = ref(storage, `avatars/${loggedInUser.id}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                const downloadURL = await getDownloadURL(storageRef);
                setEditedAvatarUrl(downloadURL);
            } catch (error) {
                console.error("Failed to upload avatar", error);
                alert("Failed to upload image. Please try again.");
            } finally {
                setIsUploadingAvatar(false);
            }
        }
    };
    
    const handleAuthorClick = (authorId: string) => {
        if (authorId === loggedInUser?.id) {
            setView('profile');
        } else {
            setView('publicProfile', authorId);
        }
    };


    return (
        <div>
            {!isCurrentUser && (
                <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition mb-6">
                    <ArrowLeft size={20} />
                    Back
                </button>
            )}

            {/* Profile Header Section */}
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md mb-8 overflow-hidden transition-colors duration-300 border border-transparent dark:border-zinc-700">
                 {!isEditing ? (
                    <div className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-6">
                        <Avatar 
                            src={user.avatarUrl} 
                            name={user.name} 
                            className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-100 dark:border-zinc-700 shadow-md bg-white text-5xl md:text-6xl" 
                        />
                        
                        <div className="flex-grow text-center md:text-left">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                                     <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{user.name}</h1>
                                     <div className="flex justify-center md:justify-start">
                                        <UserRankBadge rank={userRank} size={28}/>
                                     </div>
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 font-medium mb-3 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 items-center">
                                <span>{user.course}</span>
                                <span className="hidden md:inline">•</span>
                                <span>Year {user.currentYear}, Sem {user.currentSemester}</span>
                                <span className="hidden md:inline">•</span>
                                <span className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                                    <Clock size={14} className="inline"/> Joined {formattedJoinDate}
                                </span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base max-w-2xl">{user.bio}</p>
                        </div>

                        <div className="shrink-0 w-full md:w-auto flex flex-col gap-3 pt-4 md:pt-0">
                            {isCurrentUser ? (
                                <button onClick={() => setIsEditing(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition shadow-sm">
                                    <Edit size={18} />
                                    Edit Profile
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                                    <button 
                                        onClick={() => toggleUserSubscription(user.id)}
                                        className={`w-full sm:w-auto flex items-center justify-center gap-2 font-semibold py-2.5 px-6 rounded-lg transition shadow-sm ${isFollowing ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-600'}`}
                                    >
                                        {isFollowing ? <UserMinus size={18} /> : <UserPlus size={18} />}
                                        {isFollowing ? 'Unfollow' : 'Follow'}
                                    </button>
                                    <button 
                                        onClick={() => startConversation(user.id)}
                                        className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition shadow-sm"
                                    >
                                        <MessageSquareIcon size={18} />
                                        Message
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                             <div className="relative">
                                <Avatar src={editedAvatarUrl || 'https://via.placeholder.com/128'} name={editedName} className="w-32 h-32 rounded-full border-4 border-primary-300 text-5xl" />
                                <div className="absolute bottom-0 right-0 bg-primary-600 p-2 rounded-full text-white cursor-pointer hover:bg-primary-700">
                                     <label htmlFor="edit-avatar" className="cursor-pointer">
                                        {isUploadingAvatar ? <Loader2 className="animate-spin" size={16}/> : <UploadCloud size={16}/>}
                                        <input 
                                            id="edit-avatar" 
                                            type="file" 
                                            accept="image/png,image/jpeg" 
                                            onChange={handleAvatarChange} 
                                            className="hidden"
                                            disabled={isUploadingAvatar}
                                        />
                                    </label>
                                </div>
                             </div>
                             <div className="flex-grow space-y-4 w-full">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1" htmlFor="edit-name">Full Name</label>
                                    <input id="edit-name" type="text" value={editedName} onChange={e => setEditedName(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 dark:border-dark-border dark:text-white text-slate-900 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition" required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1" htmlFor="edit-course">Course</label>
                                        <select 
                                            id="edit-course" 
                                            value={editedCourse} 
                                            onChange={e => setEditedCourse(e.target.value)} 
                                            className="w-full bg-slate-50 dark:bg-zinc-900 dark:border-dark-border dark:text-white text-slate-900 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                                        >
                                            {courseOptions.map(option => (
                                                <option key={option} value={option}>{option}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1" htmlFor="edit-year">Year</label>
                                        <select id="edit-year" value={editedYear} onChange={e => setEditedYear(parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-900 dark:border-dark-border dark:text-white text-slate-900 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition">
                                            {[1, 2, 3, 4].map(y => (
                                                <option key={y} value={y}>{y}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1" htmlFor="edit-sem">Semester</label>
                                        <select id="edit-sem" value={editedSemester} onChange={e => setEditedSemester(parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-900 dark:border-dark-border dark:text-white text-slate-900 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition">
                                            {[1, 2, 3].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                             </div>
                        </div>
                         <div className="mt-6">
                            <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1" htmlFor="edit-bio">Bio</label>
                            <textarea id="edit-bio" value={editedBio} onChange={e => setEditedBio(e.target.value)} rows={4} className="w-full bg-slate-50 dark:bg-zinc-900 dark:border-dark-border dark:text-white text-slate-900 px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition" />
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-dark-border flex flex-col sm:flex-row justify-end gap-4">
                            <button onClick={handleCancel} className="bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-bold py-2.5 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition flex items-center justify-center gap-2">
                                <X size={18} />
                                Cancel
                            </button>
                            <button onClick={handleSave} disabled={isUploadingAvatar} className="bg-primary-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-primary-700 transition flex items-center justify-center gap-2 shadow-md disabled:opacity-70">
                                <Save size={18} />
                                {isUploadingAvatar ? 'Uploading...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <StatCard icon={<Award size={24}/>} label="Reputation Points" value={user.points.toLocaleString()} />
                <StatCard icon={<UploadCloud size={24}/>} label="Total Uploads" value={userResources.length} />
            </div>

            <div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{isCurrentUser ? "My Uploads" : `${user.name}'s Uploads`}</h2>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {userResources.length > 0 ? (
                        userResources.map(resource => (
                            <ResourceCard 
                                key={resource.id} 
                                resource={resource} 
                                onSelect={() => setView('resourceDetail', resource.id)} 
                                onAuthorClick={handleAuthorClick}
                            />
                        ))
                    ) : (
                        <div className="col-span-full text-center py-16 bg-white dark:bg-dark-surface rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
                            <p className="text-slate-500 dark:text-slate-400">{isCurrentUser ? "You haven't" : `${user.name} hasn't`} uploaded any resources yet.</p>
                        </div>
                    )}
                </div>
            </div>
            
            <div className="mt-8">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{isCurrentUser ? "My Forum Posts" : `${user.name}'s Forum Posts`}</h2>
                {userForumPosts.length > 0 ? (
                    <div className="space-y-4">
                        {userForumPosts.map(post => (
                            <div 
                                key={post.id} 
                                onClick={() => setView('forumDetail', post.id)}
                                className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group border border-transparent dark:border-zinc-700"
                            >
                                <div className="flex justify-between items-center">
                                    <div className="min-w-0">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{post.courseCode}</span>
                                        <h3 title={post.title} className="text-lg font-bold text-slate-800 dark:text-white mt-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 truncate">{post.title}</h3>
                                        <div className="flex items-center gap-2 mt-2">
                                            {post.tags.map(tag => (
                                                <span key={tag} className="text-xs font-medium text-primary-700 dark:text-primary-300 bg-primary-100 dark:bg-primary-900/30 px-2 py-1 rounded-full">{tag}</span>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6 text-slate-500 dark:text-slate-400 text-sm font-medium shrink-0 ml-4">
                                        <span className="flex items-center">
                                            <ThumbsUp size={16} />
                                            {post.upvotes > 0 && <span className="ml-1.5">{post.upvotes}</span>}
                                        </span>
                                        <span className="flex items-center">
                                            <MessageSquare size={16} />
                                            {post.replies.length > 0 && <span className="ml-1.5">{post.replies.length}</span>}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="col-span-full text-center py-16 bg-white dark:bg-dark-surface rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
                        <p className="text-slate-500 dark:text-slate-400">{isCurrentUser ? "You haven't" : `${user.name} hasn't`} created any forum posts yet.</p>
                    </div>
                )}
            </div>

            {isCurrentUser && (
                <div className="mt-8">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">My Open Requests</h2>
                    {userOpenRequests.length > 0 ? (
                        <div className="space-y-4">
                            {userOpenRequests.map(request => (
                                <div 
                                    key={request.id} 
                                    onClick={() => setView('requests')}
                                    className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 cursor-pointer group border border-transparent dark:border-zinc-700"
                                >
                                    <div className="flex justify-between items-center">
                                        <div className="min-w-0">
                                            <span className="text-sm font-bold text-slate-800 dark:text-white px-3 py-1 bg-slate-100 dark:bg-zinc-800 rounded-full">{request.courseCode}</span>
                                            <h3 title={request.title} className="text-lg font-bold text-slate-800 dark:text-white mt-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 truncate">{request.title}</h3>
                                        </div>
                                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 shrink-0 ml-4">
                                            <Clock size={16} />
                                            <span>{new Date(request.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="col-span-full text-center py-16 bg-white dark:bg-dark-surface rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
                            <p className="text-slate-500 dark:text-slate-400">You have no open resource requests.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
