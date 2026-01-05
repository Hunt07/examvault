
import React, { useContext, useMemo, useState } from 'react';
import { AppContext } from '../../App';
import type { User } from '../../types';
import { Award, Medal, Trophy, Info, X } from 'lucide-react';
import UserRankBadge from '../UserRankBadge';

type LeaderboardTab = 'all' | 'weekly';

const LeaderboardPage: React.FC = () => {
    const { users, setView, user: loggedInUser } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<LeaderboardTab>('all');
    const [showPointsInfo, setShowPointsInfo] = useState(false);

    const sortedUsers = useMemo(() => {
        const usersCopy = [...users];
        switch (activeTab) {
            case 'weekly':
                return usersCopy.sort((a, b) => b.weeklyPoints - a.weeklyPoints || a.id.localeCompare(b.id));
            case 'all':
            default:
                // Deterministic sort: Points Descending -> ID Ascending
                return usersCopy.sort((a, b) => b.points - a.points || a.id.localeCompare(b.id));
        }
    }, [users, activeTab]);
    
    const handleUserClick = (userId: string) => {
        if (userId === loggedInUser?.id) {
            setView('profile');
        } else {
            setView('publicProfile', userId);
        }
    };
    
    const getPointsForUser = (user: User) => {
        switch (activeTab) {
            case 'weekly':
                return user.weeklyPoints;
            case 'all':
            default:
                return user.points;
        }
    };

    const formatDate = (dateString: string) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
    };

    return (
        <div>
             {showPointsInfo && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100">
                        <div className="p-5 border-b flex justify-between items-center bg-primary-50 dark:bg-primary-900/20 dark:border-zinc-700">
                            <h2 className="text-lg font-bold text-primary-800 dark:text-primary-300 flex items-center gap-2">
                                <Award size={20} /> Points System
                            </h2>
                            <button onClick={() => setShowPointsInfo(false)} className="p-1 rounded-full hover:bg-primary-100 dark:hover:bg-zinc-800 text-primary-700 dark:text-primary-400 transition">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-3">
                            <p className="text-slate-600 dark:text-slate-300 text-sm mb-4">Earn reputation points by contributing to the community. Here is the breakdown:</p>
                            
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Fulfill a Request</span>
                                <span className="font-bold text-green-600 dark:text-green-400">+50 pts</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Upload a Resource</span>
                                <span className="font-bold text-green-600 dark:text-green-400">+25 pts</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Verified Answer</span>
                                <span className="font-bold text-green-600 dark:text-green-400">+15 pts</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg border border-slate-100 dark:border-zinc-700">
                                <span className="font-medium text-slate-700 dark:text-slate-300">Create Discussion</span>
                                <span className="font-bold text-green-600 dark:text-green-400">+10 pts</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mb-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">Leaderboard</h1>
                        <p className="text-slate-600 dark:text-slate-300 mt-2">See who the top contributors are in the ExamVault community!</p>
                    </div>
                    <button 
                        onClick={() => setShowPointsInfo(true)}
                        className="flex items-center gap-2 text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:hover:bg-primary-900/30 px-4 py-2 rounded-lg transition self-start md:self-auto"
                    >
                        <Info size={18} />
                        <span>How to earn points</span>
                    </button>
                </div>
                <div className="mt-6 border-b border-slate-200 dark:border-zinc-700">
                    <nav className="flex -mb-px space-x-6">
                        <button
                            onClick={() => setActiveTab('all')}
                            className={`px-3 py-3 font-semibold text-sm transition-colors ${
                                activeTab === 'all'
                                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            All-Time
                        </button>
                        <button
                            onClick={() => setActiveTab('weekly')}
                            className={`px-3 py-3 font-semibold text-sm transition-colors ${
                                activeTab === 'weekly'
                                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            Weekly
                        </button>
                    </nav>
                </div>
            </div>
            <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <ul className="divide-y divide-slate-100 dark:divide-zinc-800">
                    {sortedUsers.map((user, index) => (
                        <li key={user.id} className={`p-3 sm:p-4 flex items-center justify-between transition-colors ${index < 3 ? 'bg-primary-50/50 dark:bg-primary-900/10' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}>
                           <button onClick={() => handleUserClick(user.id)} className="flex items-center gap-4 w-full text-left">
                                <div className="flex items-center justify-center w-8 shrink-0">
                                    {index < 3 ? (
                                        <UserRankBadge rank={index} size={28} />
                                    ) : (
                                        <span className="text-slate-500 dark:text-slate-400 font-bold text-sm w-7 h-7 flex items-center justify-center bg-slate-100 dark:bg-zinc-700 rounded-full border border-slate-200 dark:border-zinc-600 shadow-sm">
                                            {index + 1}
                                        </span>
                                    )}
                                </div>
                                <img src={user.avatarUrl} alt={user.name} className="w-12 h-12 rounded-full" />
                                <div>
                                    <p className="text-base sm:text-lg font-bold text-slate-800 dark:text-white">{user.name}</p>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">
                                        <span className="font-semibold">{user.course}</span> • Joined on {formatDate(user.joinDate)}
                                    </p>
                                </div>
                           </button>
                           <div className="text-right shrink-0 pl-2 sm:pl-4">
                               <p className="text-lg sm:text-xl font-bold text-primary-600 dark:text-primary-400">{getPointsForUser(user).toLocaleString()} pts</p>
                           </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default LeaderboardPage;
