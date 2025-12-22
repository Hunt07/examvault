
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../App';
import { MASTER_ADMIN_EMAILS } from '../../constants';
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
        if (userId === currentUser?.id) { showToast("You cannot ban yourself.", "error"); return; }
        setActionLoading(userId);
        try { await banUser(userId); showToast("User Restricted.", "success"); } finally { setActionLoading(null); }
    };

    const handleReportAction = async (reportId: string, status: 'resolved' | 'dismissed') => {
        setActionLoading(reportId);
        try { await updateReportStatus(reportId, status); showToast(`Report ${status}.`, "success"); } finally { setActionLoading(null); }
    };

    const getPresenceStatus = (u: any) => {
        if (u.status === 'banned') return { label: 'BANNED', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' };
        if (u.status === 'deactivated') return { label: 'DEACTIVATED', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' };
        return { label: 'OFFLINE', color: 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-slate-400' };
    };

    if (!currentUser?.isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-center">
                <ShieldAlert size={64} className="text-red-500 mb-4" />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Access Denied</h1>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="bg-white dark:bg-dark-surface p-6 rounded-2xl shadow-md border dark:border-zinc-700 flex flex-col md:flex-row gap-6 items-center">
                <div className="bg-red-100 p-4 rounded-xl text-red-600"><Shield size={32} /></div>
                <div className="flex-grow">
                    <h1 className="text-3xl font-bold dark:text-white">Admin Panel</h1>
                    <div className="flex gap-6 mt-4">
                        <button onClick={() => setActiveTab('reports')} className={`pb-2 ${activeTab === 'reports' ? 'border-b-2 border-red-500 font-bold' : ''}`}>Reports</button>
                        <button onClick={() => setActiveTab('users')} className={`pb-2 ${activeTab === 'users' ? 'border-b-2 border-red-500 font-bold' : ''}`}>Users</button>
                    </div>
                </div>
            </div>

            {activeTab === 'reports' ? (
                 <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-md overflow-hidden border dark:border-zinc-700">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-xs font-bold uppercase text-slate-500">
                                <tr><th className="px-6 py-4">Title</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                            </thead>
                            <tbody>
                                {filteredReports.map(r => (
                                    <tr key={r.id} className="border-t dark:border-zinc-800">
                                        <td className="px-6 py-4 dark:text-white">{r.targetTitle}</td>
                                        <td className="px-6 py-4 capitalize dark:text-slate-300">{r.status}</td>
                                        <td className="px-6 py-4 text-right">
                                            {r.status === 'pending' && <button onClick={() => handleReportAction(r.id, 'resolved')} className="text-green-500 hover:underline">Resolve</button>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                 </div>
            ) : (
                <div className="bg-white dark:bg-dark-surface rounded-2xl shadow-md border dark:border-zinc-700 overflow-hidden">
                    <div className="p-4 border-b dark:border-zinc-700"><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full bg-slate-50 dark:bg-zinc-900 dark:text-white p-2 rounded-lg" /></div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 dark:bg-zinc-900 text-xs font-bold uppercase text-slate-500">
                                <tr><th className="px-6 py-4">User</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
                            </thead>
                            <tbody>
                                {filteredUsers.map(u => (
                                    <tr key={u.id} className="border-t dark:border-zinc-800">
                                        <td className="px-6 py-4 flex items-center gap-3"><Avatar src={u.avatarUrl} alt={u.name} className="w-8 h-8" /><span className="dark:text-white">{u.name}</span></td>
                                        <td className="px-6 py-4"><span className={`text-[10px] p-1 rounded font-bold ${getPresenceStatus(u).color}`}>{getPresenceStatus(u).label}</span></td>
                                        <td className="px-6 py-4 text-right">
                                            {!MASTER_ADMIN_EMAILS.includes(u.email) && u.id !== currentUser?.id && (
                                                <button onClick={() => handleBan(u.id)} className="text-red-500 text-sm font-bold">Restrict</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
