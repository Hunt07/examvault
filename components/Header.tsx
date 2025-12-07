
import React, { useContext, useState, useMemo, useRef, useEffect } from 'react';
import { AppContext } from '../App';
import { BookOpen, PlusCircle, Bell, User, LogOut, FileText, Mail, MessageSquare, Gift, Bookmark, Sun, Moon } from 'lucide-react';
import type { Notification } from '../types';
import UserRankBadge from './UserRankBadge';
import { NotificationType } from '../types';

function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 5) return "just now";
  
  let interval = seconds / 31536000;
  if (interval > 1) {
    const years = Math.floor(interval);
    return `${years} year${years > 1 ? 's' : ''} ago`;
  }
  interval = seconds / 2592000;
  if (interval > 1) {
    const months = Math.floor(interval);
    return `${months} month${months > 1 ? 's' : ''} ago`;
  }
  interval = seconds / 86400;
  if (interval > 1) {
    const days = Math.floor(interval);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
  interval = seconds / 3600;
  if (interval > 1) {
    const hours = Math.floor(interval);
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  }
  interval = seconds / 60;
  if (interval > 1) {
    const minutes = Math.floor(interval);
    return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  }
  return `${Math.floor(seconds)} second${seconds > 1 ? 's' : ''} ago`;
}

const Header: React.FC<{ onUploadClick: () => void }> = ({ onUploadClick }) => {
  const { user, userRanks, logout, setView, notifications, markNotificationAsRead, markAllNotificationsAsRead, clearAllNotifications, savedResourceIds, resources, isDarkMode, toggleDarkMode, setScrollTargetId } = useContext(AppContext);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);
  
  const [isSavedOpen, setIsSavedOpen] = useState(false);
  const savedRef = useRef<HTMLDivElement>(null);

  const userRank = user ? userRanks.get(user.id) : undefined;

  // Filter notifications for the current user only
  const userNotifications = useMemo(() => {
    if (!user) return [];
    return notifications.filter(n => n.recipientId === user.id);
  }, [notifications, user]);

  const unreadCount = useMemo(() => userNotifications.filter(n => !n.isRead).length, [userNotifications]);

  const savedItems = useMemo(() => 
    resources.filter(r => savedResourceIds.includes(r.id)), 
  [resources, savedResourceIds]);

  // Logic for saved dot notification
  const [lastViewedCount, setLastViewedCount] = useState(0);
    
  useEffect(() => {
    if (user) {
            const stored = parseInt(localStorage.getItem(`examvault_saved_viewed_count_${user.id}`) || '0');
            setLastViewedCount(isNaN(stored) ? 0 : stored);
    }
  }, [user]);

  const savedCount = savedResourceIds.length;
    
  // Auto-sync downwards
  useEffect(() => {
    if (user && savedCount < lastViewedCount) {
        setLastViewedCount(savedCount);
        localStorage.setItem(`examvault_saved_viewed_count_${user.id}`, savedCount.toString());
    }
  }, [savedCount, lastViewedCount, user]);

  const showSavedDot = savedCount > lastViewedCount;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (savedRef.current && !savedRef.current.contains(event.target as Node)) {
        setIsSavedOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleSavedMenu = () => {
    const newState = !isSavedOpen;
    setIsSavedOpen(newState);
    
    if (newState && user) {
        // When opening, mark current count as viewed
        setLastViewedCount(savedCount);
        localStorage.setItem(`examvault_saved_viewed_count_${user.id}`, savedCount.toString());
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markNotificationAsRead(notification.id);
    }

    // Set scroll target if specific comment/reply link exists
    if (notification.commentId) {
        setScrollTargetId(notification.commentId);
    } else if (notification.replyId) {
        setScrollTargetId(notification.replyId);
    }
    
    switch(notification.type) {
        case NotificationType.Subscription:
            if (notification.senderId) {
                // Redirect to the new follower's profile
                setView('publicProfile', notification.senderId);
            } else if (notification.resourceId) {
                // Fallback for course/lecturer notifications that link to a resource
                setView('resourceDetail', notification.resourceId);
            }
            break;
        case NotificationType.NewResource:
        case NotificationType.RequestFulfilled:
            if (notification.resourceId) {
                setView('resourceDetail', notification.resourceId);
            }
            break;
        case NotificationType.NewMessage:
            if (notification.conversationId) {
                setView('messages', notification.conversationId);
            }
            break;
        case NotificationType.NewForumPost:
            if (notification.forumPostId) {
                setView('forumDetail', notification.forumPostId);
            }
            break;
        case NotificationType.NewReply:
            if (notification.forumPostId) {
                setView('forumDetail', notification.forumPostId);
            } else if (notification.resourceId) {
                setView('resourceDetail', notification.resourceId);
            }
            break;
    }

    setIsNotificationsOpen(false);
  };
  
  const handleMarkAllRead = () => {
      markAllNotificationsAsRead();
  };

  const handleClearAll = () => {
      if (window.confirm("Are you sure you want to clear all notifications?")) {
          clearAllNotifications();
      }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case NotificationType.Subscription:
        return <Bell size={16} className="text-primary-500" />;
      case NotificationType.NewResource:
        return <FileText size={16} className="text-green-500" />;
      case NotificationType.NewMessage:
        return <Mail size={16} className="text-blue-500" />;
      case NotificationType.NewForumPost:
      case NotificationType.NewReply:
        return <MessageSquare size={16} className="text-purple-500" />;
      case NotificationType.RequestFulfilled:
        return <Gift size={16} className="text-teal-500" />;
      default:
        return null;
    }
  };


  return (
    <header className="bg-white dark:bg-dark-surface shadow-sm dark:border-b dark:border-dark-border sticky top-0 z-20 transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center gap-8 md:pl-6">
            <button
              onClick={() => setView('dashboard')}
              className="flex items-center gap-4 rounded-md focus:outline-none active:scale-95 transition-transform duration-100"
              aria-label="Go to dashboard"
            >
              <BookOpen className="w-10 h-10 text-primary-600 dark:text-primary-500" />
              <span className="text-2xl font-bold text-slate-800 dark:text-white">ExamVault</span>
            </button>
          </div>
          <div className="flex items-center gap-4">
            <button
                id="tour-upload-button"
                onClick={onUploadClick} 
                className="hidden md:inline-flex items-center gap-2 bg-primary-600 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-700 transition"
            >
              <PlusCircle size={20} />
              Upload Resource
            </button>
            
            <div className="relative" ref={savedRef} id="tour-saved-items">
                <button onClick={toggleSavedMenu} className="relative p-2 rounded-full text-slate-500 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-primary-400 transition">
                    <Bookmark size={22} />
                    {showSavedDot && (
                        <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-blue-600 ring-2 ring-white dark:ring-0" />
                    )}
                </button>
                {isSavedOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-dark-surface rounded-lg shadow-xl z-30 border border-slate-200 dark:border-dark-border">
                        <div className="p-3 border-b dark:border-dark-border flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white">Saved Resources</h3>
                        </div>
                        <div className="max-h-96 overflow-y-auto">
                            {savedItems.length > 0 ? (
                                savedItems.map(res => (
                                    <button
                                        key={res.id}
                                        onClick={() => {
                                            setView('resourceDetail', res.id);
                                            setIsSavedOpen(false);
                                        }}
                                        className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-50 dark:border-zinc-800 last:border-0"
                                    >
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{res.title}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{res.courseCode} • {res.type}</p>
                                    </button>
                                ))
                            ) : (
                                <p className="text-center text-slate-500 dark:text-slate-400 p-8">No saved items.</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            <div className="relative" ref={notificationsRef} id="tour-notifications">
              <button onClick={() => setIsNotificationsOpen(prev => !prev)} className="relative p-2 rounded-full text-slate-500 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-primary-400 transition">
                <Bell size={22} />
                {unreadCount > 0 && (
                   <span className="absolute top-0 right-0 block h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-0" />
                )}
              </button>
              {isNotificationsOpen && (
                 <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white dark:bg-dark-surface rounded-lg shadow-xl z-30 border border-slate-200 dark:border-dark-border">
                    <div className="p-3 border-b dark:border-dark-border flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
                        <h3 className="font-bold text-slate-800 dark:text-white">Notifications</h3>
                        <div className="flex gap-3">
                            {unreadCount > 0 && (
                            <button onClick={handleMarkAllRead} className="text-xs text-primary-600 dark:text-primary-400 font-semibold hover:text-primary-800 dark:hover:text-primary-300">
                                Mark all read
                            </button>
                            )}
                            {userNotifications.length > 0 && (
                                <button onClick={handleClearAll} className="text-xs text-red-500 hover:text-red-700 font-semibold">
                                    Clear all
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {userNotifications.length > 0 ? (
                            userNotifications.map(notification => (
                                <button
                                    key={notification.id}
                                    onClick={() => handleNotificationClick(notification)}
                                    className={`w-full text-left p-3 flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0 ${!notification.isRead ? 'bg-primary-50 dark:bg-primary-900/20' : ''}`}
                                >
                                    <div className="mt-1 flex-shrink-0">
                                      {getNotificationIcon(notification.type)}
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-2">{notification.message}</p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{timeAgo(notification.timestamp)}</p>
                                    </div>
                                </button>
                            ))
                        ) : (
                            <p className="text-center text-slate-500 dark:text-slate-400 p-8">No notifications yet.</p>
                        )}
                    </div>
                 </div>
              )}
            </div>

            <button 
                id="tour-dark-mode"
                onClick={toggleDarkMode} 
                className="p-2 rounded-full text-slate-500 dark:text-white hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-800 dark:hover:text-primary-400 transition"
                aria-label="Toggle Dark Mode"
            >
                {isDarkMode ? <Moon size={22} /> : <Sun size={22} />}
            </button>

            <div id="tour-profile-menu" className="relative group">
              <button className="flex items-center gap-2">
                <img
                  src={user?.avatarUrl}
                  alt={user?.name}
                  className="w-10 h-10 rounded-full border-2 border-slate-200 dark:border-slate-700"
                />
              </button>
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-dark-surface rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-30 border border-slate-200 dark:border-dark-border">
                <div className="py-2">
                    <div className="px-4 py-2 border-b dark:border-dark-border">
                        <div className="flex items-center">
                          <p className="font-bold text-slate-800 dark:text-white">{user?.name}</p>
                          <UserRankBadge rank={userRank} size={16}/>
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <button onClick={() => setView('profile')} className="w-full text-left flex items-center gap-3 px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-zinc-800">
                        <User size={16} />
                        Profile
                    </button>
                    <button onClick={logout} className="w-full text-left flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <LogOut size={16} />
                        Logout
                    </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
