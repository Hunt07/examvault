
import React, { useMemo, useContext, useState } from 'react';
import type { User, Resource } from '../../types';
import { ResourceRequestStatus } from '../../types';
import { AppContext } from '../../App';
import ResourceCard from '../ResourceCard';
import { Award, UploadCloud, Calendar, MessageSquare as MessageSquareIcon, Edit, X, Save, ArrowLeft, UserPlus, UserMinus, ThumbsUp, MessageSquare, Clock, Loader2, GraduationCap, AlertTriangle, Power, Trash2, ShieldAlert } from 'lucide-react';
import UserRankBadge from '../UserRankBadge';
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
    const { userRanks, setView, forumPosts, updateUserProfile, user: loggedInUser, goBack, toggleUserSubscription, startConversation, resourceRequests, deactivateAccount, deleteAccount } = useContext(AppContext);

    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(user.name);
    const [editedBio, setEditedBio] = useState(user.bio);
    const [editedAvatarUrl, setEditedAvatarUrl] = useState(user.avatarUrl);
    const [editedCourse, setEditedCourse] = useState(user.course);
    const [editedYear, setEditedYear] = useState(user.currentYear);
    const [editedSemester, setEditedSemester] = useState(user.currentSemester);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    
    // New state for Danger Zone Modals
    const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

    const isLecturer = user.role === 'lecturer';

    const handleSave = () => {
        if (editedName.trim() === '') {
            alert('Name cannot be empty.');
            return;
        }
        updateUserProfile({
            name: editedName,
            bio: editedBio,
            avatarUrl: editedAvatarUrl,
            course: isLecturer ? 'Lecturer' : editedCourse,
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

    const confirmDeactivate = () => {
        deactivateAccount();
        setShowDeactivateConfirm(false);
    };

    const confirmDelete = () => {
        deleteAccount();
        setShowDeleteConfirm(false);
    };

    // If viewing another user and they are deactivated, block access
    if (!isCurrentUser && user.status === 'deactivated') {
        return (
            <div>
                <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition mb-6">
                    <ArrowLeft size={20} />
                    Back
                </button>
                <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md p-12 flex flex-col items-center justify-center text-center border border-slate-200 dark:border-zinc-700">
                    <div className="bg-slate-100 dark:bg-zinc-800 p-4 rounded-full mb-4">
                        <ShieldAlert size={48} className="text-slate-400" />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-2">Deactivated Account</h2>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md">
                        This user has deactivated their account. Their profile and contributions are currently hidden.
                    </p>
                </div>
            </div>
        );
    }

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
                        <img 
                            src={user.avatarUrl} 
                            alt={user.name} 
                            className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-100 dark:border-zinc-700 shadow-md object-cover bg-white" 
                        />
                        
                        <div className="flex-grow text-center md:text-left">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                                     <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white flex items-center gap-2 justify-center md:justify-start">
                                        {user.name}
                                        {isLecturer && (
                                            <span className="bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 text-xs px-2 py-1 rounded-full border border-purple-200 dark:border-purple-800 flex items-center gap-1 font-bold uppercase tracking-wider">
                                                <GraduationCap size={14} /> Lecturer
                                            </span>
                                        )}
                                     </h1>
                                     <div className="flex justify-center md:justify-start">
                                        {!isLecturer && <UserRankBadge rank={userRank} size={28}/>}
                                     </div>
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 font-medium mb-3 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 items-center">
                                <span>{isLecturer ? 'Lecturer' : user.course}</span>
                                {!isLecturer && (
                                    <>
                                        <span className="hidden md:inline">•</span>
                                        <span>Year {user.currentYear}, Sem {user.currentSemester}</span>
                                    </>
                                )}
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
                                <img src={editedAvatarUrl || 'https://via.placeholder.com/128'} alt="Avatar Preview" className="w-32 h-32 rounded-full border-4 border-primary-300 object-cover" />
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
                                {!isLecturer && (
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
                                )}
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

            {/* Danger Zone */}
            {isCurrentUser && (
                <div className="mt-12 border border-red-200 dark:border-red-900/50 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-red-50 dark:bg-red-900/10 p-4 border-b border-red-100 dark:border-red-900/30 flex items-center gap-2">
                        <AlertTriangle className="text-red-600 dark:text-red-500" size={20} />
                        <h3 className="font-bold text-red-800 dark:text-red-400">Danger Zone</h3>
                    </div>
                    <div className="bg-white dark:bg-dark-surface p-4 divide-y divide-slate-100 dark:divide-zinc-800">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Deactivate Account</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                                    Temporarily hide your profile and uploads from the community. Everything will be restored when you log back in.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowDeactivateConfirm(true)}
                                className="px-4 py-2 bg-amber-600/10 hover:bg-amber-600/20 text-amber-600 dark:text-amber-500 font-bold text-sm rounded-lg border border-amber-600/20 transition flex items-center justify-center gap-2 shrink-0"
                            >
                                <Power size={16} />
                                Deactivate
                            </button>
                        </div>
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 py-2 pt-4 mt-2">
                            <div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm">Delete Account (Purge)</h4>
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                                    Permanently remove your account and <strong>all your uploads, posts, and requests</strong> from the platform. This cannot be undone.
                                </p>
                            </div>
                            <button 
                                onClick={() => setShowDeleteConfirm(true)}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg transition flex items-center justify-center gap-2 shrink-0 shadow-sm"
                            >
                                <Trash2 size={16} />
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Deactivation Confirmation Modal */}
            {showDeactivateConfirm && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-2xl max-w-md w-full border border-slate-200 dark:border-zinc-700">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Deactivate Account?</h3>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            Are you sure you want to deactivate your account? You will be logged out immediately. 
                            <br/><br/>
                            Simply log in again to reactivate your account and restore your profile visibility.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowDeactivateConfirm(false)} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition">Cancel</button>
                            <button onClick={confirmDeactivate} className="px-4 py-2 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 transition">Yes, Deactivate</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal (Placeholder) */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white dark:bg-zinc-900 p-6 rounded-xl shadow-2xl max-w-md w-full border border-red-200 dark:border-red-900">
                        <div className="flex items-center gap-2 mb-2 text-red-600">
                            <AlertTriangle size={24} />
                            <h3 className="text-xl font-bold">Delete Account?</h3>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 mb-6">
                            This action is permanent and cannot be undone. All your data will be wiped. 
                            <br/><br/>
                            <span className="text-sm italic text-slate-500">You will be logged out immediately.</span>
                        </p>
                        <div className="flex gap-3 justify-end">
                            <button onClick={() => setShowDeleteConfirm(false)} className="px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-slate-200 font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition">Cancel</button>
                            <button onClick={confirmDelete} className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
