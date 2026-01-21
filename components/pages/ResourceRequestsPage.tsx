
import React, { useContext, useState, useMemo } from 'react';
import { AppContext } from '../../App';
import type { ResourceRequest } from '../../types';
import { ResourceRequestStatus } from '../../types';
import { PlusCircle, Search, HelpCircle } from 'lucide-react';
import CreateRequestModal from '../CreateRequestModal';
import ResourceRequestCard from '../ResourceRequestCard';

type RequestTab = 'open' | 'fulfilled';

const ResourceRequestsPage: React.FC = () => {
    const { resourceRequests, addResourceRequest } = useContext(AppContext);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<RequestTab>('open');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredRequests = useMemo(() => {
        const trimmedSearch = searchTerm.trim().toLowerCase();
        const tabFilter = (req: ResourceRequest) => activeTab === 'open' ? req.status === ResourceRequestStatus.Open : req.status === ResourceRequestStatus.Fulfilled;
        
        const searchFilter = (req: ResourceRequest) => 
            !trimmedSearch ||
            req.title.toLowerCase().includes(trimmedSearch) ||
            req.courseCode.toLowerCase().includes(trimmedSearch) ||
            req.requester.name.toLowerCase().includes(trimmedSearch) ||
            req.details.toLowerCase().includes(trimmedSearch);

        return resourceRequests.filter(req => tabFilter(req) && searchFilter(req));
    }, [resourceRequests, activeTab, searchTerm]);

    return (
        <div>
            <div className="bg-white dark:bg-dark-surface p-4 sm:p-6 rounded-xl shadow-md mb-8 transition-colors duration-300 border border-transparent dark:border-zinc-700">
                <div className="flex flex-col md:flex-row gap-4 md:justify-between md:items-center">
                    <div className="text-center md:text-left">
                        <h1 className="text-2xl sm:text-3xl font-bold text-slate-800 dark:text-white">Resource Requests</h1>
                        <p className="text-slate-600 dark:text-slate-300 mt-2">Can't find what you're looking for? Ask the community!</p>
                    </div>
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="w-full md:w-auto flex items-center justify-center gap-2 bg-primary-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-primary-700 transition"
                    >
                        <PlusCircle size={20} />
                        Make a Request
                    </button>
                </div>
                 <div className="mt-6 flex flex-col sm:flex-row gap-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                        <input
                        type="text"
                        placeholder="Search requests..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 pl-10 pr-4 py-3 border border-slate-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition"
                        />
                    </div>
                </div>
                <div className="mt-6 border-b border-slate-200 dark:border-zinc-700">
                    <nav className="flex -mb-px space-x-6">
                        <button
                            onClick={() => setActiveTab('open')}
                            className={`px-3 py-3 font-semibold text-sm transition-colors ${
                                activeTab === 'open'
                                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            Open
                        </button>
                        <button
                            onClick={() => setActiveTab('fulfilled')}
                            className={`px-3 py-3 font-semibold text-sm transition-colors ${
                                activeTab === 'fulfilled'
                                ? 'border-b-2 border-primary-600 text-primary-600 dark:text-primary-400'
                                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                        >
                            Fulfilled
                        </button>
                    </nav>
                </div>
            </div>

            <div className="space-y-6">
                {filteredRequests.length > 0 ? (
                    filteredRequests.map(request => (
                        <ResourceRequestCard key={request.id} request={request} />
                    ))
                ) : (
                    <div className="col-span-full text-center py-16 bg-white dark:bg-dark-surface rounded-xl shadow-md transition-colors duration-300 border border-transparent dark:border-zinc-700">
                        <HelpCircle size={48} className="mx-auto text-slate-400" />
                        <p className="mt-4 text-slate-500 dark:text-slate-400 font-semibold">No requests found.</p>
                        <p className="text-slate-500 dark:text-slate-400">Try adjusting your search or check the other tab.</p>
                    </div>
                )}
            </div>

            {isCreateModalOpen && (
                <CreateRequestModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSubmit={addResourceRequest}
                />
            )}
        </div>
    );
};

export default ResourceRequestsPage;