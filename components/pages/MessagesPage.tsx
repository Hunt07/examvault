import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../App';
import type { User, Conversation, DirectMessage } from '../../types';
import { MessageStatus } from '../../types';
import { Send, Check, CheckCheck, MessageCircle, ArrowLeft, FileText, Notebook, ExternalLink, MoreVertical, Edit2, Trash2, X, Search } from 'lucide-react';
import Avatar from '../Avatar';

const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffSeconds = Math.round((now.getTime() - date.getTime()) / 1000);
    const diffDays = Math.floor(diffSeconds / 86400);

    if (diffDays >= 1) {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } else {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
};

const MessageStatusIcon: React.FC<{ status: MessageStatus }> = ({ status }) => {
    switch (status) {
        case MessageStatus.Read:
            return <CheckCheck size={16} className="text-blue-200" />;
        case MessageStatus.Delivered:
            return <CheckCheck size={16} className="text-white opacity-70" />;
        case MessageStatus.Sent:
            return <Check size={16} className="text-white opacity-70" />;
        default:
            return null;
    }
};

interface MessageBubbleProps {
    message: {
        id: string;
        text: string;
        timestamp: string;
        status: MessageStatus;
        isDeleted?: boolean;
        editedAt?: string;
    };
    isSender: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, isSender }) => {
    const { setView, resources, deleteMessage, editMessage } = useContext(AppContext);
    const [showOptions, setShowOptions] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editText, setEditText] = useState(message.text);
    const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
    const optionsRef = useRef<HTMLDivElement>(null);

    // 15 minutes in milliseconds
    const EDIT_WINDOW = 15 * 60 * 1000;
    const canEdit = isSender && !message.isDeleted && (Date.now() - new Date(message.timestamp).getTime() < EDIT_WINDOW);
    const canDelete = isSender && !message.isDeleted;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (optionsRef.current && !optionsRef.current.contains(event.target as Node)) {
                setShowOptions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDeleteClick = () => {
        setIsDeleteConfirmOpen(true);
        setShowOptions(false);
    };

    const confirmDelete = () => {
        deleteMessage(message.id);
        setIsDeleteConfirmOpen(false);
    };

    const handleEdit = () => {
        setIsEditing(true);
        setShowOptions(false);
    };

    const submitEdit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editText.trim() && editText !== message.text) {
            editMessage(message.id, editText);
        }
        setIsEditing(false);
    };

    const renderText = (text: string) => {
        if (message.isDeleted) {
            return <span className="italic opacity-60 flex items-center gap-1"><X size={12}/> This message was deleted</span>;
        }

        // Regex to find URLs
        const urlRegex = /(https?:\/\/[^\s]+|http:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);
        
        return parts.map((part, i) => {
            if (part.match(urlRegex)) {
                let resourceId: string | null = null;
                
                try {
                    const url = new URL(part);
                    // Check if URL contains resourceId parameter
                    resourceId = url.searchParams.get('resourceId');
                } catch (e) {
                    // Ignore invalid URLs
                }

                if (resourceId) {
                     const resource = resources.find(r => r.id === resourceId);
                     if (resource) {
                        // Render a rich card for resources found in the app context
                        return (
                             <button 
                                key={i}
                                onClick={() => setView('resourceDetail', resource.id)}
                                className={`flex items-center text-left p-3 rounded-lg transition border shadow-sm overflow-hidden group my-2 w-full ${
                                    isSender 
                                    ? 'bg-white/10 border-white/20 hover:bg-white/20 text-white' 
                                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700 dark:text-white'
                                }`}
                            >
                                <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 mr-3 ${
                                    isSender 
                                        ? 'bg-white/20 text-white' 
                                        : (resource.type === 'Past Paper' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600')
                                }`}>
                                        {resource.type === 'Past Paper' ? <FileText size={20}/> : <Notebook size={20}/>}
                                </div>
                                <div className="min-w-0 flex-1">
                                        <p className={`text-sm font-bold truncate ${isSender ? 'text-white' : 'text-slate-900 dark:text-white'}`}>{resource.title}</p>
                                        <p className={`text-xs truncate ${isSender ? 'text-blue-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                        {resource.courseCode} • {resource.type}
                                        </p>
                                </div>
                            </button>
                        );
                     }
                }
                
                // Render standard external link with break-all to prevent layout breakage
                const className = isSender ? "text-white underline opacity-90 hover:opacity-100 break-all" : "text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300 break-all";
                return (
                    <a key={i} href={part} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-1 ${className}`}>
                        {part} <ExternalLink size={10} className="inline" />
                    </a>
                );
            }
            // Regular text
            return <span key={i}>{part}</span>;
        });
    };

    if (isEditing) {
        return (
            <form onSubmit={submitEdit} className="w-full">
                <input 
                    type="text" 
                    value={editText} 
                    onChange={e => setEditText(e.target.value)}
                    className="w-full px-2 py-1 rounded text-slate-800 dark:text-white bg-white/90 dark:bg-black/20 border-none focus:ring-1 focus:ring-white mb-1"
                    autoFocus
                />
                <div className="flex justify-end gap-2 text-xs">
                    <button type="button" onClick={() => setIsEditing(false)} className="opacity-70 hover:opacity-100">Cancel</button>
                    <button type="submit" className="font-bold hover:underline">Save</button>
                </div>
            </form>
        );
    }

    return (
        <div className="group relative">
            <div className="break-words whitespace-pre-wrap text-sm md:text-base">
                {renderText(message.text)}
                {message.editedAt && !message.isDeleted && <span className="text-[10px] opacity-60 italic ml-1">(edited)</span>}
            </div>
            
            {/* Context Menu Trigger */}
            {(canEdit || canDelete) && (
                <button 
                    onClick={() => setShowOptions(!showOptions)}
                    className={`absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition p-1 rounded-full ${isSender ? 'text-white hover:bg-white/20' : 'text-slate-500 hover:bg-slate-200 dark:hover:bg-zinc-600'}`}
                >
                    <MoreVertical size={12} />
                </button>
            )}

            {/* Context Menu */}
            {showOptions && (
                <div ref={optionsRef} className="absolute right-0 top-4 z-10 bg-white dark:bg-zinc-800 shadow-lg rounded-lg border border-slate-200 dark:border-zinc-700 py-1 min-w-[100px] overflow-hidden">
                    {canEdit && (
                        <button onClick={handleEdit} className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-200 flex items-center gap-2">
                            <Edit2 size={12} /> Edit
                        </button>
                    )}
                    {canDelete && (
                        <button onClick={handleDeleteClick} className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2">
                            <Trash2 size={12} /> Delete
                        </button>
                    )}
                </div>
            )}
             
             {isDeleteConfirmOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white dark:bg-zinc-800 p-4 rounded-lg shadow-xl max-w-xs w-full border dark:border-zinc-700">
                        <p className="text-sm font-bold text-slate-800 dark:text-white mb-4">Delete this message?</p>
                        <div className="flex justify-end gap-2">
                             <button onClick={() => setIsDeleteConfirmOpen(false)} className="px-3 py-1 text-sm bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 rounded hover:bg-slate-200 dark:hover:bg-zinc-600">Cancel</button>
                             <button onClick={confirmDelete} className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const MessagesPage: React.FC<{ activeConversationId: string | null }> = ({ activeConversationId }) => {
    const { user, users, conversations, directMessages, sendMessage, markMessagesAsRead, setView } = useContext(AppContext);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    };

    const sortedConversations = useMemo(() => {
        if (!user) return [];
        return conversations
            .filter(c => c.participants.includes(user.id))
            .sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
    }, [conversations, user]);

    const filteredConversations = useMemo(() => {
        if (!searchTerm) return sortedConversations;
        return sortedConversations.filter(c => {
            const otherUserId = c.participants.find(id => id !== user?.id);
            const otherUser = users.find(u => u.id === otherUserId);
            return otherUser?.name.toLowerCase().includes(searchTerm.toLowerCase());
        });
    }, [sortedConversations, users, user, searchTerm]);

    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId);
    }, [conversations, activeConversationId]);

    const currentMessages = useMemo(() => {
        if (!activeConversationId) return [];
        return directMessages.filter(m => m.conversationId === activeConversationId);
    }, [directMessages, activeConversationId]);

    useEffect(() => {
        if (activeConversationId) {
            markMessagesAsRead(activeConversationId);
            setTimeout(scrollToBottom, 100);
        }
    }, [activeConversationId, currentMessages.length]);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (activeConversationId && newMessage.trim()) {
            sendMessage(activeConversationId, newMessage);
            setNewMessage('');
        }
    };

    const getOtherParticipant = (conversation: Conversation) => {
        const otherId = conversation.participants.find((p) => p !== user?.id);
        return users.find(u => u.id === otherId);
    };

    const getLastMessage = (conversationId: string) => {
        const msgs = directMessages.filter(m => m.conversationId === conversationId);
        return msgs.length > 0 ? msgs[msgs.length - 1] : null;
    };

    const getUnreadCount = (conversationId: string) => {
        if (!user) return 0;
        return directMessages.filter(
            m => m.conversationId === conversationId && m.recipientId === user.id && m.status !== MessageStatus.Read
        ).length;
    };

    return (
        <div className="flex h-[calc(100vh-6rem)] bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden border border-transparent dark:border-zinc-700">
            {/* Sidebar List */}
            <div className={`${activeConversationId ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r border-slate-200 dark:border-zinc-700`}>
                <div className="p-4 border-b border-slate-200 dark:border-zinc-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Messages</h2>
                    <div className="relative">
                         <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                         <input 
                            type="text" 
                            placeholder="Search conversations..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 pl-10 pr-4 py-2 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                         />
                    </div>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {filteredConversations.length > 0 ? (
                        filteredConversations.map(conv => {
                            const otherUser = getOtherParticipant(conv);
                            const lastMsg = getLastMessage(conv.id);
                            const unreadCount = getUnreadCount(conv.id);
                            const isActive = conv.id === activeConversationId;

                            if (!otherUser) return null;

                            return (
                                <button
                                    key={conv.id}
                                    onClick={() => setView('messages', conv.id)}
                                    className={`w-full p-4 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition border-b border-slate-50 dark:border-zinc-800 ${isActive ? 'bg-slate-50 dark:bg-zinc-800' : ''}`}
                                >
                                    <Avatar src={otherUser.avatarUrl} name={otherUser.name} className="w-12 h-12 rounded-full" />
                                    <div className="flex-grow min-w-0 text-left">
                                        <div className="flex justify-between items-baseline">
                                            <h4 className="font-semibold text-slate-800 dark:text-white truncate">{otherUser.name}</h4>
                                            {lastMsg && (
                                                <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                                                    {formatTimestamp(lastMsg.timestamp)}
                                                </span>
                                            )}
                                        </div>
                                        <p className={`text-sm truncate mt-0.5 ${unreadCount > 0 ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                                            {lastMsg ? (lastMsg.senderId === user?.id ? `You: ${lastMsg.text}` : lastMsg.text) : 'Start a conversation'}
                                        </p>
                                    </div>
                                    {unreadCount > 0 && (
                                        <div className="bg-primary-600 text-white text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full shrink-0">
                                            {unreadCount}
                                        </div>
                                    )}
                                </button>
                            );
                        })
                    ) : (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
                            <p>No conversations found.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            {activeConversationId ? (
                <div className={`${!activeConversationId ? 'hidden md:flex' : 'flex'} flex-col flex-grow h-full bg-slate-50 dark:bg-zinc-900/50`}>
                     {/* Chat Header */}
                     <div className="p-4 bg-white dark:bg-dark-surface border-b border-slate-200 dark:border-zinc-700 flex items-center gap-3 shadow-sm z-10">
                        <button onClick={() => setView('messages')} className="md:hidden p-2 -ml-2 text-slate-600 dark:text-slate-400">
                            <ArrowLeft size={20} />
                        </button>
                        {activeConversation && getOtherParticipant(activeConversation) && (
                            <>
                                <button onClick={() => setView('publicProfile', getOtherParticipant(activeConversation)?.id)}>
                                     <Avatar 
                                        src={getOtherParticipant(activeConversation)?.avatarUrl} 
                                        name={getOtherParticipant(activeConversation)?.name || 'User'} 
                                        className="w-10 h-10 rounded-full" 
                                    />
                                </button>
                                <div>
                                    <h3 className="font-bold text-slate-800 dark:text-white">{getOtherParticipant(activeConversation)?.name}</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{getOtherParticipant(activeConversation)?.course}</p>
                                </div>
                            </>
                        )}
                     </div>

                     {/* Messages List */}
                     <div className="flex-grow overflow-y-auto p-4 space-y-4">
                        {currentMessages.map((msg, index) => {
                            const isSender = msg.senderId === user?.id;
                            const showDate = index === 0 || new Date(msg.timestamp).toDateString() !== new Date(currentMessages[index - 1].timestamp).toDateString();
                            
                            return (
                                <React.Fragment key={msg.id}>
                                    {showDate && (
                                        <div className="flex justify-center my-4">
                                            <span className="text-xs font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-zinc-800 px-3 py-1 rounded-full">
                                                {new Date(msg.timestamp).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex ${isSender ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-3 md:p-4 shadow-sm relative group ${
                                            isSender 
                                            ? 'bg-primary-600 text-white rounded-br-none' 
                                            : 'bg-white dark:bg-zinc-800 text-slate-800 dark:text-white rounded-bl-none border border-slate-100 dark:border-zinc-700'
                                        }`}>
                                            <MessageBubble message={msg} isSender={isSender} />
                                            <div className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${isSender ? 'text-blue-100' : 'text-slate-400 dark:text-slate-500'}`}>
                                                <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                                {isSender && <MessageStatusIcon status={msg.status} />}
                                            </div>
                                        </div>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                        <div ref={messagesEndRef} />
                     </div>

                     {/* Input Area */}
                     <form onSubmit={handleSendMessage} className="p-4 bg-white dark:bg-dark-surface border-t border-slate-200 dark:border-zinc-700">
                        <div className="flex items-end gap-2 bg-slate-100 dark:bg-zinc-800 p-2 rounded-xl border border-transparent focus-within:border-primary-500 dark:focus-within:border-primary-500 transition-colors">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={e => setNewMessage(e.target.value)}
                                placeholder="Type a message..."
                                className="flex-grow bg-transparent border-none focus:ring-0 text-slate-800 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 px-2 py-2 max-h-32 overflow-y-auto"
                            />
                            <button 
                                type="submit" 
                                disabled={!newMessage.trim()}
                                className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
                            >
                                <Send size={20} />
                            </button>
                        </div>
                     </form>
                </div>
            ) : (
                <div className="hidden md:flex flex-col items-center justify-center flex-grow bg-slate-50 dark:bg-zinc-900/50 text-slate-400">
                    <div className="w-24 h-24 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                        <MessageCircle size={48} className="opacity-50" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-600 dark:text-slate-300">Your Messages</h3>
                    <p className="mt-2 text-sm">Select a conversation to start chatting.</p>
                </div>
            )}
        </div>
    );
};

export default MessagesPage;