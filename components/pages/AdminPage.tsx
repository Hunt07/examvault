
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../App';
import { Shield, User, UserX, UserCheck, AlertTriangle, Trash2, CheckCircle, Search, Ban, RotateCcw, Eye, Check, X, GraduationCap } from 'lucide-react';
import Avatar from '../Avatar';
import type { User as UserType, Report } from '../../types';

type AdminTab = 'reports' | 'users';

const AdminPage: React.FC = () => {
    const { users, reports, toggleUserRole, toggleUserStatus, resolveReport, setView, showToast, deleteResource } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState<AdminTab>('users');
    const [searchTerm, setSearchTerm] = useState('');

    // User Management Logic
    const filteredUsers = useMemo(() => {
        if (!searchTerm) return users;
        const lower = searchTerm.toLowerCase();
        return users.filter(u => 
            u.name.toLowerCase().includes(lower) || 
            u.email.toLowerCase().includes(lower)
        );
    }, [users, searchTerm]);

    const handlePromote = (userId: string, currentRole: 'student' | 'admin') => {
        const newRole = currentRole === 'student' ? 'admin' : 'student';
        toggleUserRole(userId, newRole);
        showToast(newRole === 'admin' ? "User promoted to Admin" : "User demoted to Student", "success");
    };

    const handleBan = (userId: string, currentStatus: 'active' | 'banned') => {
        const newStatus = currentStatus === 'active' ? 'banned' : 'active';
        toggleUserStatus(userId, newStatus);
        showToast(newStatus === 'banned' ? "User has been restricted." : "User access restored.", newStatus === 'banned' ? 'success' : 'success');
    };

    // Reports Logic
    const handleDismissReport = (reportId: string) => {
        resolveReport(reportId, 'dismissed');
        showToast("Report dismissed.", "info");
    };

    const handleResolveReport = (reportId: string) => {
        resolveReport(reportId, 'resolved');
        showToast("Report marked as resolved (Content kept).", "success");
    };

    const handleDeleteResource = async (report: Report) => {
        await deleteResource(report.resourceId, '', ''); 
        resolveReport(report.id, 'resolved');
        showToast("Resource deleted and report resolved.", "success");
    };

    const isUserOnline = (lastActive?: string) => {
        if (!lastActive) return false;
        const now = new Date().getTime();
        const lastActivity = new Date(lastActive).getTime();
        const threshold = 60 * 1000; // 1 minute threshold for "Online"
        return (now - lastActivity) < threshold;
    };

    return (
        <div className="space-y-6">
            {/* Header Card */}
            <div className="bg-dark-surface dark:bg-zinc-900 rounded-xl p-6 shadow-lg border border-zinc-700 text-white relative overflow-hidden">
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <div className="p-2 bg-red-500/20 rounded-lg text-red-500 border border-red-500/30">
                                <Shield size={24} />
                            </div>
                            <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                        </div>
                        <p className="text-zinc-400">Security & Moderation Controls</p>
                    </div>
                </div>
                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                
                {/* Tabs */}
                <div className="flex gap-6 mt-8 border-b border-zinc-700">
                    <button 
                        onClick={() => setActiveTab('reports')}
                        className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'reports' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        Reports Queue
                        {reports.length > 0 && <span className="ml-2 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{reports.length}</span>}
                        {activeTab === 'reports' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 rounded-t-full" />}
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`pb-3 text-sm font-semibold transition-colors relative ${activeTab === 'users' ? 'text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                        User Management
                        {activeTab === 'users' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-500 rounded-t-full" />}
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {activeTab === 'users' && (
                <div className="bg-dark-surface dark:bg-zinc-900 rounded-xl shadow-lg border border-zinc-700 overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-4 border-b border-zinc-700">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
                            <input 
                                type="text" 
                                placeholder="Search users by name or email..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-zinc-800 text-white placeholder-zinc-500 pl-10 pr-4 py-2.5 rounded-lg border border-zinc-700 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead>
                                <tr className="bg-zinc-800/50 text-xs uppercase tracking-wider text-zinc-500 font-semibold border-b border-zinc-700">
                                    <th className="px-6 py-4">User</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Role</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-700">
                                {filteredUsers.map(user => (
                                    <tr 
                                        key={user.id} 
                                        onClick={() => setView('publicProfile', user.id)}
                                        className="hover:bg-zinc-800/50 transition cursor-pointer"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <Avatar src={user.avatarUrl} alt={user.name} className="w-10 h-10" />
                                                <div>
                                                    <p className="font-bold text-white text-sm">{user.name}</p>
                                                    <p className="text-zinc-500 text-xs">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.status === 'banned' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                                                    BANNED
                                                </span>
                                            ) : isUserOnline(user.lastActive) ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30">
                                                    ONLINE
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-zinc-700/50 text-zinc-400 border border-zinc-600">
                                                    OFFLINE
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.role === 'admin' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                                                    <Shield size={10} /> ADMIN
                                                </span>
                                            ) : user.role === 'lecturer' ? (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                                    <GraduationCap size={12} /> LECTURER
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-zinc-700 text-zinc-300 border border-zinc-600">
                                                    STUDENT
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                {/* Only allow role toggle if not a lecturer (auto-assigned) or if promoting student/admin */}
                                                {user.role !== 'lecturer' && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handlePromote(user.id, user.role as 'student' | 'admin'); }}
                                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-600/20 text-xs font-semibold transition"
                                                    >
                                                        {user.role === 'student' ? <UserCheck size={14} /> : <UserX size={14} />}
                                                        {user.role === 'student' ? 'Promote' : 'Demote'}
                                                    </button>
                                                )}
                                                {user.status === 'banned' ? (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleBan(user.id, user.status); }}
                                                        className="p-1.5 rounded-lg bg-green-600/10 text-green-400 hover:bg-green-600/20 border border-green-600/20 transition group relative"
                                                        title="Restore Access"
                                                    >
                                                        <RotateCcw size={16} />
                                                        <span className="absolute bottom-full mb-2 right-0 w-max px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition">Restore Access</span>
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); handleBan(user.id, user.status); }}
                                                        className="p-1.5 rounded-lg bg-red-600/10 text-red-400 hover:bg-red-600/20 border border-red-600/20 transition group relative"
                                                        title="Restrict User"
                                                    >
                                                        <UserX size={16} />
                                                        <span className="absolute bottom-full mb-2 right-0 w-max px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition">Restrict User</span>
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {filteredUsers.length === 0 && (
                            <div className="p-8 text-center text-zinc-500">
                                No users found matching your search.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'reports' && (
                <div className="grid gap-4">
                    {reports.length === 0 ? (
                        <div className="bg-dark-surface dark:bg-zinc-900 rounded-xl p-12 text-center border border-zinc-700">
                            <CheckCircle size={48} className="mx-auto text-green-500 mb-4 opacity-50" />
                            <h3 className="text-xl font-bold text-white">All Caught Up!</h3>
                            <p className="text-zinc-400 mt-2">There are no pending reports in the queue.</p>
                        </div>
                    ) : (
                        reports.map(report => (
                            <div key={report.id} className="bg-dark-surface dark:bg-zinc-900 rounded-xl p-6 shadow-md border border-zinc-700 flex flex-col lg:flex-row gap-6">
                                <div className="flex-grow">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="bg-red-500/20 text-red-400 text-xs font-bold px-2 py-1 rounded border border-red-500/30 uppercase tracking-wider">Reported</span>
                                        <span className="text-zinc-500 text-sm">• {new Date(report.timestamp).toLocaleDateString()}</span>
                                    </div>
                                    <h3 className="text-lg font-bold text-white mb-1">Resource: {report.resourceTitle}</h3>
                                    <div className="text-sm text-zinc-400 mb-4 space-y-1">
                                        <p>Uploaded by: <span className="text-white font-medium">{report.uploaderName}</span></p>
                                        <p>Reported by: <span className="text-white font-medium">{report.reporterName}</span></p>
                                    </div>
                                    <div className="bg-zinc-800 p-3 rounded-lg border border-zinc-700">
                                        <p className="text-xs text-zinc-500 uppercase font-bold mb-1">Reason</p>
                                        <p className="text-zinc-300 text-sm">{report.reason}</p>
                                    </div>
                                </div>
                                <div className="flex flex-row lg:flex-col justify-center gap-3 min-w-[200px] border-t lg:border-t-0 lg:border-l border-zinc-700 pt-4 lg:pt-0 lg:pl-6 flex-wrap">
                                    <button 
                                        onClick={() => setView('resourceDetail', report.resourceId)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white py-2 px-4 rounded-lg transition text-sm font-semibold border border-zinc-600 whitespace-nowrap"
                                    >
                                        <Eye size={16} /> View Resource
                                    </button>
                                    <button 
                                        onClick={() => handleDismissReport(report.id)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 px-4 rounded-lg transition text-sm font-semibold border border-zinc-600 whitespace-nowrap"
                                        title="Dismiss report (Keep content)"
                                    >
                                        <X size={16} /> Dismiss
                                    </button>
                                    <button 
                                        onClick={() => handleResolveReport(report.id)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-green-900/30 hover:bg-green-900/50 text-green-400 py-2 px-4 rounded-lg transition text-sm font-semibold border border-green-800 whitespace-nowrap"
                                        title="Mark resolved without deleting"
                                    >
                                        <Check size={16} /> Resolve (Keep)
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteResource(report)}
                                        className="flex-1 flex items-center justify-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 py-2 px-4 rounded-lg transition text-sm font-semibold border border-red-600/30 whitespace-nowrap"
                                        title="Delete content and resolve"
                                    >
                                        <Trash2 size={16} /> Delete Content
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminPage;
