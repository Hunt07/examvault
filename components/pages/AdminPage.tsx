
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../App';
import { ShieldAlert, Trash2, CheckCircle, XCircle, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { ReportStatus } from '../../types';

const AdminPage: React.FC = () => {
  const { reports, resources, resolveReport, deleteResource, setView } = useContext(AppContext);
  const [filter, setFilter] = useState<ReportStatus | 'all'>('all');

  const filteredReports = useMemo(() => {
    if (filter === 'all') return reports;
    return reports.filter(r => r.status === filter);
  }, [reports, filter]);

  const handleDeleteResource = async (resourceId: string, reportId: string) => {
    const res = resources.find(r => r.id === resourceId);
    if (!res) return;

    if (window.confirm(`Are you sure you want to PERMANENTLY delete "${res.title}"? This action is taken as an administrator.`)) {
      await deleteResource(resourceId, res.fileUrl, res.previewImageUrl);
      await resolveReport(reportId, ReportStatus.Resolved);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    if (window.confirm("Dismiss this report? No action will be taken against the content.")) {
      await resolveReport(reportId, ReportStatus.Dismissed);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white dark:bg-dark-surface p-6 rounded-xl shadow-md border border-transparent dark:border-zinc-700 mb-8">
        <div className="flex items-center gap-4 mb-2">
          <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400">Moderation Control Center</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden border border-transparent dark:border-zinc-700">
          <div className="p-6 border-b border-slate-100 dark:border-zinc-700 flex flex-col sm:flex-row justify-between items-center gap-4">
            <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              Community Reports ({filteredReports.length})
            </h2>
            <div className="flex gap-2 bg-slate-100 dark:bg-zinc-800 p-1 rounded-lg">
              {(['all', ReportStatus.Pending, ReportStatus.Resolved, ReportStatus.Dismissed] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`px-3 py-1.5 rounded-md text-sm font-bold capitalize transition ${filter === s ? 'bg-white dark:bg-zinc-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-zinc-900/50 text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-4 font-bold">Resource / Reason</th>
                  <th className="px-6 py-4 font-bold">Reporter</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Date</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <button 
                            onClick={() => setView('resourceDetail', report.resourceId)}
                            className="font-bold text-slate-800 dark:text-white hover:text-primary-600 flex items-center gap-1 group text-left"
                          >
                            {report.resourceTitle}
                            <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition" />
                          </button>
                          <span className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">"{report.reason}"</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 dark:text-slate-300">{report.reporterName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                          report.status === ReportStatus.Pending ? 'bg-amber-100 text-amber-700' :
                          report.status === ReportStatus.Resolved ? 'bg-red-100 text-red-700' :
                          'bg-green-100 text-green-700'
                        }`}>
                          {report.status === ReportStatus.Pending && <Clock size={12} />}
                          {report.status === ReportStatus.Resolved && <Trash2 size={12} />}
                          {report.status === ReportStatus.Dismissed && <CheckCircle size={12} />}
                          {report.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {new Date(report.timestamp).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {report.status === ReportStatus.Pending && (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleDeleteResource(report.resourceId, report.id)}
                              className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition"
                              title="Delete Resource"
                            >
                              <Trash2 size={18} />
                            </button>
                            <button
                              onClick={() => handleDismissReport(report.id)}
                              className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition"
                              title="Dismiss Report"
                            >
                              <CheckCircle size={18} />
                            </button>
                          </div>
                        )}
                        {report.status !== ReportStatus.Pending && (
                          <span className="text-xs font-medium text-slate-400 italic">No actions needed</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No reports found in this category.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
