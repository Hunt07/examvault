
import React, { useContext, useState, useMemo } from 'react';
import { AppContext, MASTER_ADMIN_EMAILS } from '../../App';
import { Shield, Users, AlertTriangle, Search, ExternalLink, UserX, UserCheck, Check, X, ShieldAlert, Loader2, UserPlus, UserMinus } from 'lucide-react';
import Avatar from '../Avatar';

type AdminTab = 'reports' | 'users';

const AdminPage: React.FC = () => {
    const { 
        user: currentUser, users, reports, setView, banUser, unbanUser, 
        toggleAdminStatus, updateReportStatus, showToast
    } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<AdminTab>('reports');
    const [searchTerm, setSearchTerm] = useState('');
    const [reportFilter, setReportFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const filteredUsers = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();
        return users.filter(u => 
            u.name.toLowerCase().includes(term) || 
            u.email.toLowerCase().includes(term) ||
            u.course.toLowerCase().includes(term)
        );
    }, [users, searchTerm]);

    const filteredReports = useMemo(() => {
        if (reportFilter === 'all') return reports;
        return reports.filter(r => r.status === reportFilter);
    }, [reports, reportFilter]);

    const handleBan = async (userId: string) => {
        if (userId === currentUser?.id) {
            showToast("You cannot ban yourself.", "error");
            return;
        }
        setActionLoading(userId);
        try {
            await banUser(userId);
            showToast("User has been restricted.", "success");
        } finally {
            setActionLoading(null);
        }
    };

    const handleUnban = async (userId: string) => {
        setActionLoading(userId);
        try {
            await unbanUser(userId);
            showToast("User access restored.", "success");
        } finally {
            setActionLoading(null);
        }
    };

    const handleToggleAdmin = async (userId: string) => {
        if (userId === currentUser?.id) {
            showToast("You cannot revoke your own admin rights.", "error");
            return;
        }
        const targetUser = users.find(u => u.id === userId);
        if (targetUser && MASTER_ADMIN_EMAILS.includes(targetUser.email)) {
            showToast("Master admin roles cannot be changed.", "error");
            return;
        }

        setActionLoading(userId);
        try {
            await toggleAdminStatus(userId);
            showToast("User role updated.", "success");
        } finally {
            setActionLoading(null);
        }
    };

    const handleReportAction = async (reportId: string, status: 'resolved' | 'dismissed') => {
        setActionLoading(reportId);
        try {
            await updateReportStatus(reportId, status);
            showToast(`Report ${status}.`, "success");
        } finally {
            setActionLoading(null);
        }
    };

    // Presence calculation
    const getPresenceStatus = (u: any) => {
        if (u.status === 'banned') return { label: 'BANNED', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
        if (u.status === 'deactivated') return { label: 'DEACTIVATED', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        
        if (u.lastSeen) {
            const lastSeenDate = new Date(u.lastSeen);
            const now = new Date();
            // Threshold of 2 minutes for online status
            const diffMinutes = (now.getTime() - lastSeenDate.getTime()) / (1000 * 60);
            if (diffMinutes < 2) return { label: 'ONLINE', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' };
        }
        return { label: 'OFFLINE', color: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400' };
    };

    if (!currentUser?.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldAlert size={64} className="text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-2">Only administrators can view this page.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Admin Header */}
            <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700 flex flex-col md:flex-row gap-6 items-start md:items-center">
                <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-xl text-red-600 dark:text-red-400">
                    <Shield size={32} />
                </div>
                <div className="flex-grow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
                            <p className="text-slate-500 dark:text-slate-400">Security & Moderation Controls</p>
                        </div>
                    </div>
                    
                    <div className="flex gap-6 mt-4 border-b dark:border-zinc-700">
                        <button 
                            onClick={() => setActiveTab('reports')}
                            className={`pb-2 px-1 font-bold text-sm transition-colors relative ${activeTab === 'reports' ? 'text-red-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            Reports Queue
                            {activeTab === 'reports' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
                        </button>
                        <button 
                            onClick={() => setActiveTab('users')}
                            className={`pb-2 px-1 font-bold text-sm transition-colors relative ${activeTab === 'users' ? 'text-red-500' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                        >
                            User Management
                            {activeTab === 'users' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500" />}
                        </button>
                    </div>
                </div>
            </div>

            {activeTab === 'reports' && (
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-md border dark:border-zinc-700 overflow-hidden">
                    <div className="p-6 border-b dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-2 text-slate-800 dark:text-white font-bold text-lg">
                            <AlertTriangle size={20} className="text-amber-500" />
                            Community Reports
                        </div>
                        <div className="flex bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
                            {(['all', 'pending', 'resolved', 'dismissed'] as const).map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setReportFilter(f)}
                                    className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${reportFilter === f ? 'bg-primary-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Content / Reason</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredReports.length > 0 ? filteredReports.map((report) => (
                                    <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <button 
                                                    onClick={() => setView(report.targetType === 'resource' ? 'resourceDetail' : 'forumDetail', report.targetId)}
                                                    className="font-bold text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 flex items-center gap-1 text-left"
                                                >
                                                    {report.targetTitle}
                                                    <ExternalLink size={12} />
                                                </button>
                                                <span className="text-sm text-slate-500 italic mt-1">"{report.reason}"</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                                report.status === 'pending' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                report.status === 'resolved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-slate-400'
                                            }`}>
                                                {report.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {report.status === 'pending' ? (
                                                <div className="flex justify-end gap-2">
                                                    <button 
                                                        disabled={actionLoading === report.id}
                                                        onClick={() => handleReportAction(report.id, 'dismissed')}
                                                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition bg-slate-100 dark:bg-zinc-800 rounded-lg disabled:opacity-50"
                                                        title="Dismiss"
                                                    >
                                                        {actionLoading === report.id ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />}
                                                    </button>
                                                    <button 
                                                        disabled={actionLoading === report.id}
                                                        onClick={() => handleReportAction(report.id, 'resolved')}
                                                        className="p-2 text-green-600 hover:text-green-700 transition bg-green-50 dark:bg-green-900/20 rounded-lg disabled:opacity-50"
                                                        title="Resolve"
                                                    >
                                                        {actionLoading === report.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Actioned</span>
                                            )}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="px-6 py-12 text-center text-slate-500 dark:text-slate-400 italic">
                                            No reports found in this queue.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'users' && (
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-md border dark:border-zinc-700 overflow-hidden">
                    <div className="p-6 border-b dark:border-zinc-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input 
                                type="text"
                                placeholder="Search users by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-50 dark:bg-zinc-900/50 dark:text-white pl-10 pr-4 py-2.5 rounded-xl border-none focus:ring-2 focus:ring-red-500 transition-all"
                            />
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                                {filteredUsers.map((u) => {
                                    const presence = getPresenceStatus(u);
                                    return (
                                        <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                                            <td className="px-6 py-4">
                                                <button 
                                                    onClick={() => setView('publicProfile', u.id)}
                                                    className="flex items-center gap-3 group text-left"
                                                >
                                                    <Avatar src={u.avatarUrl} alt={u.name} className="w-10 h-10 border border-slate-200 dark:border-zinc-700" />
                                                    <div className="overflow-hidden">
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-slate-800 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 truncate">{u.name}</p>
                                                        </div>
                                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email}</p>
                                                    </div>
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${presence.color}`}>
                                                    {presence.label}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {u.isAdmin ? (
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 text-[10px] font-black uppercase rounded flex items-center gap-1">
                                                            <Shield size={10} /> Admin
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-slate-100 text-slate-600 dark:text-zinc-800 dark:text-slate-400 text-[10px] font-bold uppercase rounded">
                                                            Student
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex justify-end gap-3">
                                                    {/* Role Management */}
                                                    {!MASTER_ADMIN_EMAILS.includes(u.email) && u.id !== currentUser.id && (
                                                        <button 
                                                            disabled={actionLoading === u.id}
                                                            onClick={() => handleToggleAdmin(u.id)}
                                                            className={`p-2 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold ${
                                                                u.isAdmin 
                                                                ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/20' 
                                                                : 'text-primary-600 bg-primary-50 dark:bg-primary-900/20'
                                                            }`}
                                                            title={u.isAdmin ? "Revoke Admin Rights" : "Make Admin"}
                                                        >
                                                            {actionLoading === u.id ? <Loader2 size={14} className="animate-spin" /> : (u.isAdmin ? <UserMinus size={14} /> : <UserPlus size={14} />)}
                                                            {u.isAdmin ? "Demote" : "Promote"}
                                                        </button>
                                                    )}

                                                    {/* Account Restriction */}
                                                    {!MASTER_ADMIN_EMAILS.includes(u.email) && u.id !== currentUser.id && (
                                                        u.status === 'banned' ? (
                                                            <button 
                                                                disabled={actionLoading === u.id}
                                                                onClick={() => handleUnban(u.id)}
                                                                className="p-2 text-green-600 bg-green-50 dark:bg-green-900/20 rounded-lg hover:text-green-700 font-bold transition-colors disabled:opacity-50"
                                                                title="Restore Access"
                                                            >
                                                                {actionLoading === u.id ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                                                            </button>
                                                        ) : (
                                                            <button 
                                                                disabled={actionLoading === u.id}
                                                                onClick={() => handleBan(u.id)}
                                                                className="p-2 text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg hover:text-red-600 font-bold transition-colors disabled:opacity-50"
                                                                title="Ban User"
                                                            >
                                                                {actionLoading === u.id ? <Loader2 size={14} className="animate-spin" /> : <UserX size={14} />}
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
