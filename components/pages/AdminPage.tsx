
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../App';
import { ShieldAlert, Trash2, CheckCircle, XCircle, Clock, ExternalLink, AlertTriangle, Users, Search, UserMinus, UserCheck } from 'lucide-react';
import { ReportStatus, User } from '../../types';
import Avatar from '../Avatar';

const AdminPage: React.FC = () => {
  const { reports, resources, users, resolveReport, deleteResource, setView, updateUserStatus, forumPosts, deleteForumPost } = useContext(AppContext);
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [reportFilter, setReportFilter] = useState<ReportStatus | 'all'>('all');
  const [userSearch, setUserSearch] = useState("");
  const [banModal, setBanModal] = useState<{ user: User } | null>(null);
  const [banReason, setBanReason] = useState("");

  const filteredReports = useMemo(() => {
    if (reportFilter === 'all') return reports;
    return reports.filter(r => r.status === reportFilter);
  }, [reports, reportFilter]);

  const filteredUsers = useMemo(() => {
    const term = userSearch.toLowerCase();
    return users.filter(u => u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term));
  }, [users, userSearch]);

  const handleDeleteResource = async (resourceId: string, reportId: string) => {
    const res = resources.find(r => r.id === resourceId);
    if (!res) return;
    if (window.confirm(`Are you sure you want to PERMANENTLY delete "${res.title}"?`)) {
      await deleteResource(resourceId, res.fileUrl, res.previewImageUrl);
      await resolveReport(reportId, ReportStatus.Resolved);
    }
  };

  const handleBanUser = async () => {
    if (!banModal) return;
    await updateUserStatus(banModal.user.id, 'banned', banReason);
    setBanModal(null);
    setBanReason("");
  };

  const handleUnbanUser = async (userId: string) => {
    if (window.confirm("Restore this user's access?")) {
      await updateUserStatus(userId, 'active');
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
      <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-transparent dark:border-zinc-700 mb-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Security & Moderation Controls</p>
          </div>
        </div>
        
        <div className="flex gap-4 border-b dark:border-zinc-700">
           <button 
            onClick={() => setActiveTab('reports')}
            className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'reports' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500'}`}
           >
             Reports Queue
           </button>
           <button 
            onClick={() => setActiveTab('users')}
            className={`pb-4 px-2 font-bold text-sm transition-all border-b-2 ${activeTab === 'users' ? 'border-red-500 text-red-600' : 'border-transparent text-slate-500'}`}
           >
             User Management
           </button>
        </div>
      </div>

      {activeTab === 'reports' && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden border border-transparent dark:border-zinc-700">
          <div className="p-6 border-b border-slate-100 dark:border-zinc-700 flex justify-between items-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              Community Reports
            </h2>
            <div className="flex gap-2 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
              {(['all', ReportStatus.Pending, ReportStatus.Resolved, ReportStatus.Dismissed] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setReportFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold capitalize transition ${reportFilter === s ? 'bg-white dark:bg-zinc-700 text-primary-600' : 'text-slate-500'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold">Content / Reason</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredReports.map(report => (
                  <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <td className="px-6 py-4">
                      <button onClick={() => setView('resourceDetail', report.resourceId)} className="font-bold text-slate-800 dark:text-white hover:underline flex items-center gap-1">
                        {report.resourceTitle} <ExternalLink size={12} />
                      </button>
                      <p className="text-sm text-slate-500 italic mt-1">"{report.reason}"</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${report.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{report.status}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {report.status === 'pending' && (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleDeleteResource(report.resourceId, report.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18} /></button>
                          <button onClick={() => resolveReport(report.id, ReportStatus.Dismissed)} className="p-2 text-green-600 hover:bg-green-50 rounded-lg"><CheckCircle size={18} /></button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden border border-transparent dark:border-zinc-700">
           <div className="p-6 border-b border-slate-100 dark:border-zinc-700">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Search users by name or email..." 
                  className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-lg focus:ring-2 focus:ring-red-500 transition"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
              </div>
           </div>
           <div className="overflow-x-auto">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 text-xs uppercase tracking-wider">
                   <tr>
                     <th className="px-6 py-4 font-bold">User</th>
                     <th className="px-6 py-4 font-bold">Status</th>
                     <th className="px-6 py-4 font-bold text-right">Restrict Access</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                   {filteredUsers.map(u => (
                     <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                       <td className="px-6 py-4 flex items-center gap-3">
                          <Avatar src={u.avatarUrl} alt={u.name} />
                          <div>
                            <p className="font-bold text-slate-800 dark:text-white">{u.name} {u.isAdmin && <span className="ml-2 text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded">ADMIN</span>}</p>
                            <p className="text-xs text-slate-500">{u.email}</p>
                          </div>
                       </td>
                       <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${u.status === 'banned' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                            {u.status || 'active'}
                          </span>
                       </td>
                       <td className="px-6 py-4 text-right">
                          {u.isAdmin ? (
                            <span className="text-xs text-slate-400 italic">Protected Account</span>
                          ) : u.status === 'banned' ? (
                            <button onClick={() => handleUnbanUser(u.id)} className="text-xs font-bold text-green-600 hover:underline flex items-center gap-1 ml-auto">
                              <UserCheck size={14} /> Reactivate
                            </button>
                          ) : (
                            <button onClick={() => setBanModal({ user: u })} className="text-xs font-bold text-red-600 hover:underline flex items-center gap-1 ml-auto">
                              <UserMinus size={14} /> Ban User
                            </button>
                          )}
                       </td>
                     </tr>
                   ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {banModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-800 p-8 rounded-xl shadow-2xl max-w-md w-full border-t-4 border-red-600">
             <h2 className="text-2xl font-bold mb-2">Restrict Access</h2>
             <p className="text-slate-500 text-sm mb-4">You are about to ban <strong>{banModal.user.name}</strong>. They will be logged out and unable to access ExamVault.</p>
             <label className="block text-sm font-bold mb-2">Reason for restriction</label>
             <textarea 
               value={banReason}
               onChange={(e) => setBanReason(e.target.value)}
               className="w-full p-3 bg-slate-100 dark:bg-zinc-900 border rounded-lg focus:ring-2 focus:ring-red-500" 
               placeholder="e.g., Repeated spamming, offensive behavior..."
               rows={3}
             />
             <div className="flex gap-3 mt-6">
                <button onClick={() => setBanModal(null)} className="flex-1 py-2 bg-slate-100 rounded-lg font-bold">Cancel</button>
                <button onClick={handleBanUser} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-bold">Confirm Ban</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPage;
