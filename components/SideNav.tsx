
import React, { useContext, useState } from 'react';
import { AppContext, View } from '../App';
import { LayoutDashboard, MessageSquare, BarChart3, Send, ClipboardList, ShieldAlert } from 'lucide-react';

const SideNav: React.FC = () => {
    const { view, setView, user, hasUnreadMessages, hasUnreadDiscussions } = useContext(AppContext);
    const [isHovered, setIsHovered] = useState(false);

    const navItems: { name: string; icon: React.ElementType; view: View; id: string; adminOnly?: boolean }[] = [
        { name: 'Dashboard', icon: LayoutDashboard, view: 'dashboard', id: 'tour-dashboard' },
        { name: 'Discussions', icon: MessageSquare, view: 'discussions', id: 'tour-discussions' },
        { name: 'Requests', icon: ClipboardList, view: 'requests', id: 'tour-requests' },
        { name: 'Messages', icon: Send, view: 'messages', id: 'tour-messages' },
        { name: 'Leaderboard', icon: BarChart3, view: 'leaderboard', id: 'tour-leaderboard' },
        { name: 'Admin Panel', icon: ShieldAlert, view: 'admin', id: 'tour-admin', adminOnly: true },
    ];

    const filteredNavItems = navItems.filter(item => !item.adminOnly || user?.isAdmin);

    return (
        <aside 
            id="tour-sidenav" 
            className={`fixed top-20 left-0 h-[calc(100vh-5rem)] bg-white dark:bg-dark-surface shadow-xl z-30 transition-all duration-300 ease-out flex flex-col border-r border-slate-100 dark:border-dark-border ${isHovered ? 'w-64' : 'w-20'}`}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <nav className="flex flex-col gap-3 p-3 mt-4">
                {filteredNavItems.map((item) => {
                    const hasUnread = (item.view === 'messages' && hasUnreadMessages) || (item.view === 'discussions' && hasUnreadDiscussions);
                    const isActive = view === item.view;

                    return (
                        <button
                            key={item.name}
                            id={item.id}
                            onClick={() => {
                                setView(item.view);
                                setIsHovered(false);
                            }}
                            className={`relative group flex items-center px-4 py-3.5 rounded-2xl font-medium transition-all duration-300 w-full text-left overflow-hidden whitespace-nowrap ${
                                isActive
                                    ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/25 translate-x-1'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white hover:translate-x-1'
                            }`}
                            title={!isHovered ? item.name : ''}
                        >
                            <div className="flex items-center justify-center min-w-[1.5rem]">
                                <item.icon 
                                    size={24} 
                                    className={`shrink-0 transition-colors duration-300 ${isActive ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-primary-600 dark:group-hover:text-white'}`} 
                                />
                            </div>
                            
                            <span className={`ml-4 transition-all duration-500 ease-out font-semibold ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'}`}>
                                {item.name}
                            </span>
                            
                            {/* Status Dot */}
                            {hasUnread && (
                                <span className={`absolute w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-dark-surface ${isHovered ? 'right-4 top-1/2 -translate-y-1/2' : 'top-3 right-4'}`} />
                            )}
                        </button>
                    );
                })}
            </nav>
        </aside>
    );
};

export default SideNav;
