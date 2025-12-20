
import React, { useMemo, useContext, useState } from 'react';
import type { User, Resource } from '../../types';
import { ResourceRequestStatus } from '../../types';
import { AppContext } from '../../App';
import ResourceCard from '../ResourceCard';
import { Award, UploadCloud, Calendar, MessageSquare as MessageSquareIcon, Edit, X, Save, ArrowLeft, UserPlus, UserMinus, ThumbsUp, MessageSquare, Clock, Loader2, Trash2, AlertTriangle, LogOut, Power, UserX } from 'lucide-react';
import UserRankBadge from '../UserRankBadge';
import Avatar from '../Avatar';
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
    const { userRanks, setView, forumPosts, updateUserProfile, deleteAccount, deactivateAccount, user: loggedInUser, goBack, toggleUserSubscription, startConversation, resourceRequests } = useContext(AppContext);

    const [isEditing, setIsEditing] = useState(false);
    const [editedName, setEditedName] = useState(user.name);
    const [editedBio, setEditedBio] = useState(user.bio);
    const [editedAvatarUrl, setEditedAvatarUrl] = useState(user.avatarUrl);
    const [editedCourse, setEditedCourse] = useState(user.course);
    const [editedYear, setEditedYear] = useState(user.currentYear);
    const [editedSemester, setEditedSemester] = useState(user.currentSemester);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeactivateModalOpen, setIsDeactivateModalOpen] = useState(false);
    const [isActionLoading, setIsActionLoading] = useState(false);
    
    const userResources = useMemo(() => allResources.filter(r => r.author.id === user.id), [allResources, user.id]);
    const userRank = userRanks.get(user.id);
    const isFollowing = useMemo(() => loggedInUser?.subscriptions.users.includes(user.id) ?? false, [loggedInUser, user.id]);

    const handleSave = () => {
        if (editedName.trim() === '') return;
        updateUserProfile({ name: editedName, bio: editedBio, avatarUrl: editedAvatarUrl, course: editedCourse, currentYear: editedYear, currentSemester: editedSemester });
        setIsEditing(false);
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file && loggedInUser) {
            setIsUploadingAvatar(true);
            try {
                const storageRef = ref(storage, `avatars/${loggedInUser.id}_${Date.now()}`);
                await uploadBytes(storageRef, file);
                setEditedAvatarUrl(await getDownloadURL(storageRef));
            } catch (error) { alert("Upload failed."); } finally { setIsUploadingAvatar(false); }
        }
    };

    const handleAction = async (action: () => Promise<void>) => {
        setIsActionLoading(true);
        try { await action(); } finally { setIsActionLoading(false); }
    };

    // New: If the profile belongs to another user and is deactivated
    if (user.status === 'deactivated' && !isCurrentUser) {
        return (
            <div className="max-w-2xl mx-auto py-20 text-center px-4">
                <div className="bg-white dark:bg-dark-surface p-12 rounded-2xl shadow-lg border dark:border-zinc-800 animate-in zoom-in-95">
                    <div className="w-20 h-20 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-400">
                        <UserX size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Account Deactivated</h2>
                    <p className="text-slate-600 dark:text-slate-400 mb-8 max-w-sm mx-auto">This user has chosen to temporarily hide their profile and contributions from the community.</p>
                    <button onClick={goBack} className="inline-flex items-center gap-2 bg-primary-600 text-white font-bold py-3 px-8 rounded-xl hover:bg-primary-700 transition shadow-md hover:shadow-lg transform hover:-translate-y-0.5">
                        <ArrowLeft size={20} /> Go Back
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-12">
            {!isCurrentUser && (
                <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300 transition mb-6">
                    <ArrowLeft size={20} /> Back
                </button>
            )}

            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md mb-8 overflow-hidden border dark:border-zinc-700">
                 {!isEditing ? (
                    <div className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-6">
                        <Avatar src={user.avatarUrl} alt={user.name} className="w-32 h-32 md:w-40 md:h-40 border-4 border-slate-100 dark:border-zinc-700 shadow-md bg-white" />
                        <div className="flex-grow text-center md:text-left">
                            <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                                <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{user.name}</h1>
                                <UserRankBadge rank={userRank} size={28}/>
                            </div>
                            <div className="text-slate-600 dark:text-slate-300 font-medium mb-3 flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1 items-center">
                                <span>{user.course}</span>
                                <span className="hidden md:inline">•</span>
                                <span>Year {user.currentYear}, Sem {user.currentSemester}</span>
                            </div>
                            <p className="text-slate-600 dark:text-slate-400 text-sm md:text-base max-w-2xl">{user.bio}</p>
                        </div>
                        <div className="shrink-0 w-full md:w-auto pt-4 md:pt-0">
                            {isCurrentUser ? (
                                <button onClick={() => setIsEditing(true)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition shadow-sm">
                                    <Edit size={18} /> Edit Profile
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
                                    <button onClick={() => toggleUserSubscription(user.id)} className={`w-full sm:w-auto flex items-center justify-center gap-2 font-semibold py-2.5 px-6 rounded-lg transition shadow-sm ${isFollowing ? 'bg-primary-600 text-white hover:bg-primary-700' : 'bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-600'}`}>
                                        {isFollowing ? <UserMinus size={18} /> : <UserPlus size={18} />} {isFollowing ? 'Unfollow' : 'Follow'}
                                    </button>
                                    <button onClick={() => startConversation(user.id)} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-semibold py-2.5 px-6 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition shadow-sm">
                                        <MessageSquareIcon size={18} /> Message
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="flex flex-col md:flex-row items-center gap-8">
                             <div className="relative">
                                <Avatar src={editedAvatarUrl || 'https://via.placeholder.com/128'} alt="Avatar Preview" className="w-32 h-32 border-4 border-primary-300" />
                                <div className="absolute bottom-0 right-0 bg-primary-600 p-2 rounded-full text-white cursor-pointer hover:bg-primary-700">
                                     <label htmlFor="edit-avatar" className="cursor-pointer">
                                        {isUploadingAvatar ? <Loader2 className="animate-spin" size={16}/> : <UploadCloud size={16}/>}
                                        <input id="edit-avatar" type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" disabled={isUploadingAvatar} />
                                    </label>
                                </div>
                             </div>
                             <div className="flex-grow space-y-4 w-full">
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">Full Name</label>
                                    <input type="text" value={editedName} onChange={e => setEditedName(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-2.5 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500" required />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">Course</label>
                                        <input type="text" value={editedCourse} onChange={e => setEditedCourse(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-2.5 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">Year</label>
                                        <select value={editedYear} onChange={e => setEditedYear(parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-2.5 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500">
                                            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">Semester</label>
                                        <select value={editedSemester} onChange={e => setEditedSemester(parseInt(e.target.value))} className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-2.5 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500">
                                            {[1, 2, 3].map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-slate-700 dark:text-white mb-1">Bio</label>
                                    <textarea value={editedBio} onChange={e => setEditedBio(e.target.value)} rows={3} className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-2.5 border dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500" />
                                </div>
                             </div>
                        </div>
                        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-4">
                            <button onClick={() => setIsEditing(false)} className="bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-bold py-2.5 px-6 rounded-lg hover:bg-slate-200 transition">Cancel</button>
                            <button onClick={handleSave} className="bg-primary-600 text-white font-bold py-2.5 px-6 rounded-lg hover:bg-primary-700 transition">Save Changes</button>
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <StatCard icon={<Award size={24}/>} label="Reputation Points" value={user.points.toLocaleString()} />
                <StatCard icon={<UploadCloud size={24}/>} label="Total Uploads" value={userResources.length} />
            </div>

            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6">{isCurrentUser ? "My Uploads" : `${user.name}'s Uploads`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                {userResources.length > 0 ? userResources.map(r => <ResourceCard key={r.id} resource={r} onSelect={() => setView('resourceDetail', r.id)} onAuthorClick={() => {}} />) : <div className="col-span-full py-12 text-center text-slate-500 bg-white dark:bg-dark-surface rounded-xl border dark:border-zinc-700">No uploads yet.</div>}
            </div>

            {isCurrentUser && (
                <div className="mt-16 border-t-2 border-slate-100 dark:border-zinc-800 pt-8">
                    <div className="flex items-center gap-2 mb-6">
                        <AlertTriangle className="text-red-500" size={24} />
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Danger Zone</h2>
                    </div>
                    
                    <div className="space-y-4">
                        <div className="bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Deactivate Account</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Temporarily hide your profile and uploads from the community. Everything will be restored when you log back in.</p>
                            </div>
                            <button onClick={() => setIsDeactivateModalOpen(true)} className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 font-bold py-2.5 px-6 rounded-lg hover:bg-amber-200 transition flex items-center justify-center gap-2">
                                <Power size={18} /> Deactivate
                            </button>
                        </div>

                        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Account (Purge)</h3>
                                <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Permanently remove your account and <strong>all your uploads, posts, and requests</strong> from the platform. This cannot be undone.</p>
                            </div>
                            <button onClick={() => setIsDeleteModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg transition shadow-md flex items-center justify-center gap-2">
                                <Trash2 size={18} /> Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isDeactivateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border dark:border-zinc-800 animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-amber-600">
                            <Power size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Deactivate Account?</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-8">Your uploads and profile will be hidden from everyone. Simply log back in to reactivate everything instantly.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => handleAction(deactivateAccount)} disabled={isActionLoading} className="w-full bg-amber-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-amber-700 transition flex items-center justify-center gap-2">
                                {isActionLoading ? <Loader2 className="animate-spin" size={20}/> : "Yes, Deactivate"}
                            </button>
                            <button onClick={() => setIsDeactivateModalOpen(false)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-200 transition">Keep Active</button>
                        </div>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border border-red-100 dark:border-red-900/30 animate-in zoom-in-95">
                        <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 text-red-600">
                            <AlertTriangle size={40} />
                        </div>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Permanent Purge</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-8">This will delete your profile <strong>AND</strong> every single resource you have uploaded. Your contributions will be gone forever.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={() => handleAction(deleteAccount)} disabled={isActionLoading} className="w-full bg-red-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-red-700 transition flex items-center justify-center gap-2">
                                {isActionLoading ? <Loader2 className="animate-spin" size={20}/> : "Delete Everything"}
                            </button>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="w-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-white font-bold py-3 px-6 rounded-xl hover:bg-slate-200 transition">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
