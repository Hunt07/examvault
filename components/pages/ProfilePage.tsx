
import React, { useMemo, useContext, useState } from 'react';
import type { User, Resource } from '../../types';
import { ResourceRequestStatus } from '../../types';
import { AppContext } from '../../App';
import ResourceCard from '../ResourceCard';
import { Award, UploadCloud, Edit, X, Save, ArrowLeft, Trash2, AlertTriangle, LogOut, Loader2, Clock } from 'lucide-react';
import UserRankBadge from '../UserRankBadge';
import { storage } from '../../services/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

interface ProfilePageProps {
  user: User;
  allResources: Resource[];
  isCurrentUser: boolean;
}

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number }> = ({ icon, label, value }) => (
    <div className="bg-white dark:bg-dark-surface p-4 rounded-xl shadow-md flex items-center gap-4 border border-transparent dark:border-zinc-700">
        <div className="bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 p-3 rounded-full">{icon}</div>
        <div>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{label}</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{value}</p>
        </div>
    </div>
);

const ProfilePage: React.FC<ProfilePageProps> = ({ user, allResources, isCurrentUser }) => {
    const { userRanks, setView, deleteAccount, updateUserProfile, goBack } = useContext(AppContext);
    const [isEditing, setIsEditing] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    
    const userResources = useMemo(() => allResources.filter(r => r.author.id === user.id), [allResources, user.id]);
    const userRank = userRanks.get(user.id);

    const handleDeleteAccount = async () => {
        setIsDeleting(true);
        try {
            await deleteAccount();
        } finally {
            setIsDeleting(false);
            setIsDeleteModalOpen(false);
        }
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto">
            {!isCurrentUser && (
                <button onClick={goBack} className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold mb-6">
                    <ArrowLeft size={20} /> Back
                </button>
            )}

            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md mb-8 overflow-hidden border border-transparent dark:border-zinc-700">
                <div className="p-6 md:p-10 flex flex-col md:flex-row items-center gap-6">
                    <img src={user.avatarUrl} alt={user.name} className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-slate-100 dark:border-zinc-700 object-cover" />
                    <div className="flex-grow text-center md:text-left">
                        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-2">
                             <h1 className="text-3xl md:text-4xl font-bold text-slate-900 dark:text-white">{user.name}</h1>
                             <UserRankBadge rank={userRank} size={28}/>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">{user.bio}</p>
                        <div className="mt-2 flex items-center justify-center md:justify-start gap-2 text-slate-500 text-sm">
                            <Clock size={14} /> Joined {new Date(user.joinDate).toLocaleDateString()}
                        </div>
                    </div>
                    {isCurrentUser && (
                        <button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-white font-semibold py-2 px-6 rounded-lg hover:bg-slate-200">
                            <Edit size={18} /> Edit Profile
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <StatCard icon={<Award size={24}/>} label="Reputation" value={user.points} />
                <StatCard icon={<UploadCloud size={24}/>} label="Uploads" value={userResources.length} />
            </div>

            <h2 className="text-2xl font-bold mb-6">Shared Resources</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {userResources.map(r => (
                    <ResourceCard key={r.id} resource={r} onSelect={() => setView('resourceDetail', r.id)} onAuthorClick={() => {}} />
                ))}
            </div>

            {isCurrentUser && (
                <div className="mt-16 border-t-2 border-red-100 dark:border-red-900/30 pt-8 pb-12">
                    <div className="flex items-center gap-3 mb-6">
                        <AlertTriangle className="text-red-500" size={24} />
                        <h2 className="text-2xl font-bold text-red-600">Danger Zone</h2>
                    </div>
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Delete Account</h3>
                            <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">Permanently remove your account and data from ExamVault.</p>
                        </div>
                        <button onClick={() => setIsDeleteModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 px-6 rounded-lg transition shadow-md">
                            <Trash2 size={18} className="inline mr-2" /> Delete Account
                        </button>
                    </div>
                </div>
            )}

            {isDeleteModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md p-8 text-center border border-red-100 dark:border-red-900/30">
                        <AlertTriangle size={48} className="text-red-600 mx-auto mb-4" />
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Are you absolutely sure?</h3>
                        <p className="text-slate-600 dark:text-slate-400 mb-8">This action is irreversible. All your points and shared history will be lost.</p>
                        <div className="flex flex-col gap-3">
                            <button onClick={handleDeleteAccount} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2">
                                {isDeleting ? <Loader2 className="animate-spin" size={20} /> : <LogOut size={20} />} 
                                Confirm Deletion
                            </button>
                            <button onClick={() => setIsDeleteModalOpen(false)} className="bg-slate-100 dark:bg-zinc-800 py-3 rounded-xl font-bold">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfilePage;
