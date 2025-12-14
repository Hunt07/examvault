
import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../App';
import type { User } from '../../types';
import { MessageStatus } from '../../types';
import { Send, Check, CheckCheck, MessageCircle, ArrowLeft, FileText, Notebook, ExternalLink, MoreVertical, Edit2, Trash2, X, Smile } from 'lucide-react';
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

            {/* Delete Confirmation Modal */}
            {isDeleteConfirmOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in cursor-default">
                    <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-xl max-w-sm w-full border dark:border-zinc-700">
                        <div className="flex flex-col items-center text-center">
                            <div className="p-3 bg-red-100 dark:bg-red-900/30 rounded-full text-red-600 dark:text-red-400 mb-4">
                                <Trash2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Message?</h3>
                            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
                                Are you sure you want to delete this message? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 w-full">
                                <button onClick={() => setIsDeleteConfirmOpen(false)} className="flex-1 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-slate-200 font-semibold rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-600 transition">Cancel</button>
                                <button onClick={confirmDelete} className="flex-1 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


const MessagesPage: React.FC<{ activeConversationId: string | null }> = ({ activeConversationId }) => {
    const { user, users, conversations, directMessages, setView, sendMessage, markMessagesAsRead } = useContext(AppContext);
    const [newMessage, setNewMessage] = useState('');
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const emojiPickerRef = useRef<HTMLDivElement>(null);

    const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

    const emojis = ['😀', '😂', '😭', '😍', '🥰', '😎', '😊', '🤔', '😅', '🙌', '👍', '👎', '🎉', '🔥', '❤️', '💔'];

    const userConversations = useMemo(() => {
        if (!user) return [];
        return conversations
            .filter(c => c.participants.includes(user.id))
            .sort((a, b) => new Date(b.lastMessageTimestamp).getTime() - new Date(a.lastMessageTimestamp).getTime());
    }, [conversations, user]);

    const activeConversation = useMemo(() => {
        return conversations.find(c => c.id === activeConversationId);
    }, [conversations, activeConversationId]);
    
    const otherParticipant = useMemo(() => {
        if (!activeConversation || !user) return null;
        const otherParticipantId = activeConversation.participants.find(pId => pId !== user.id);
        return otherParticipantId ? usersMap.get(otherParticipantId) : null;
    }, [activeConversation, user, usersMap]);

    const activeChatMessages = useMemo(() => {
        if (!activeConversationId) return [];
        return directMessages.filter(m => m.conversationId === activeConversationId);
    }, [directMessages, activeConversationId]);

    useEffect(() => {
        if (activeConversationId) {
            markMessagesAsRead(activeConversationId);
        }
    }, [activeConversationId, markMessagesAsRead]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView();
    }, [activeChatMessages, activeConversationId]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
                setShowEmojiPicker(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() && activeConversationId) {
            sendMessage(activeConversationId, newMessage);
            setNewMessage('');
            setShowEmojiPicker(false);
        }
    };

    const addEmoji = (emoji: string) => {
        setNewMessage(prev => prev + emoji);
        setShowEmojiPicker(false);
    };
    
    if (!user) return null;

    return (
        <div className="bg-white dark:bg-dark-surface rounded-xl shadow-md h-[calc(100vh-10rem)] flex overflow-hidden w-full transition-colors duration-300 border border-transparent dark:border-dark-border">
            <aside className={`w-full md:w-1/3 border-r border-slate-200 dark:border-zinc-700 flex-col shrink-0 ${activeConversationId ? 'hidden md:flex' : 'flex'}`}>
                <div className="p-4 border-b border-slate-200 dark:border-zinc-700">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Messages</h1>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {userConversations.map(convo => {
                        const otherParticipantId = convo.participants.find(pId => pId !== user.id);
                        const otherParticipant = otherParticipantId ? usersMap.get(otherParticipantId) : null;
                        const lastMessage = directMessages.filter(m => m.conversationId === convo.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
                        const unreadCount = directMessages.filter(m => m.conversationId === convo.id && m.recipientId === user.id && m.status !== MessageStatus.Read).length;

                        if (!otherParticipant) return null;

                        return (
                            <button
                                key={convo.id}
                                onClick={() => setView('messages', convo.id)}
                                className={`w-full text-left p-4 flex items-center gap-4 transition-colors border-b dark:border-zinc-800 ${activeConversationId === convo.id ? 'bg-primary-50 dark:bg-primary-900/20' : 'hover:bg-slate-50 dark:hover:bg-zinc-800'}`}
                            >
                                <Avatar src={otherParticipant.avatarUrl} alt={otherParticipant.name} className="w-12 h-12" />
                                <div className="flex-grow overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <h3 title={otherParticipant.name} className="font-bold text-slate-800 dark:text-white truncate">{otherParticipant.name}</h3>
                                        {lastMessage && <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{formatTimestamp(lastMessage.timestamp)}</p>}
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <p title={lastMessage?.isDeleted ? 'Message deleted' : (lastMessage?.text || 'No messages yet')} className="text-sm text-slate-600 dark:text-slate-300 truncate italic">{lastMessage?.isDeleted ? 'Message deleted' : (lastMessage?.text || 'No messages yet')}</p>
                                        {unreadCount > 0 && <span className="text-xs font-bold text-white bg-primary-600 rounded-full w-5 h-5 flex items-center justify-center shrink-0">{unreadCount}</span>}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </aside>
            <main className={`w-full md:w-2/3 flex-col min-w-0 ${activeConversationId ? 'flex' : 'hidden md:flex'}`}>
                {activeConversation && otherParticipant ? (
                    <>
                        <div className="w-full text-left p-4 border-b border-slate-200 dark:border-zinc-700 flex items-center gap-4 bg-white dark:bg-dark-surface z-10">
                             <button
                                onClick={() => setView('messages', undefined, { replace: true })}
                                className="md:hidden p-2 -ml-2 rounded-full hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                                aria-label="Back to conversations"
                            >
                                <ArrowLeft size={20} className="dark:text-white" />
                            </button>
                            <button 
                                onClick={() => setView('publicProfile', otherParticipant.id)}
                                className="flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors rounded-md p-1 -m-1 flex-grow min-w-0"
                            >
                                <Avatar src={otherParticipant.avatarUrl} alt="avatar" className="w-10 h-10" />
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate">{otherParticipant.name}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{otherParticipant.course}</p>
                                </div>
                            </button>
                        </div>

                        <div className="flex-grow p-4 md:p-6 overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-black/20 w-full custom-scrollbar" key={activeConversationId}>
                            <div className="space-y-4">
                                {activeChatMessages.map(msg => (
                                    <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user.id ? 'justify-end' : ''}`}>
                                        {msg.senderId !== user.id && <Avatar src={usersMap.get(msg.senderId)?.avatarUrl} alt="sender" className="w-8 h-8" />}
                                        <div className={`max-w-[85%] md:max-w-md p-3 rounded-2xl min-w-0 ${msg.senderId === user.id ? 'bg-primary-500 text-white rounded-br-none' : 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white rounded-bl-none shadow-sm'}`}>
                                            <MessageBubble 
                                                message={{
                                                    id: msg.id,
                                                    text: msg.text,
                                                    timestamp: msg.timestamp,
                                                    status: msg.status,
                                                    isDeleted: msg.isDeleted,
                                                    editedAt: msg.editedAt
                                                }} 
                                                isSender={msg.senderId === user.id} 
                                            />
                                            <div className={`flex items-center gap-1.5 mt-1 ${msg.senderId === user.id ? 'justify-end' : 'justify-start'}`}>
                                                <span className={`text-xs ${msg.senderId === user.id ? 'opacity-70' : 'text-slate-400 dark:text-slate-400'}`}>{formatTimestamp(msg.timestamp)}</span>
                                                {msg.senderId === user.id && <MessageStatusIcon status={msg.status} />}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                <div ref={chatEndRef} />
                            </div>
                        </div>
                        <div className="p-4 bg-white dark:bg-dark-surface border-t border-slate-200 dark:border-zinc-700 w-full relative">
                            {showEmojiPicker && (
                                <div ref={emojiPickerRef} className="absolute bottom-20 right-4 bg-white dark:bg-zinc-800 shadow-xl rounded-lg p-2 border border-slate-200 dark:border-zinc-700 grid grid-cols-4 gap-2 z-20">
                                    {emojis.map(emoji => (
                                        <button key={emoji} onClick={() => addEmoji(emoji)} className="text-xl p-1 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded transition">{emoji}</button>
                                    ))}
                                </div>
                            )}
                            <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-grow bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-3 border border-slate-300 dark:border-zinc-700 rounded-full focus:ring-primary-500 focus:border-primary-500 transition min-w-0"
                                    autoComplete="off"
                                />
                                <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition">
                                    <Smile size={24} />
                                </button>
                                <button type="submit" className="bg-primary-600 text-white p-3 rounded-full hover:bg-primary-700 transition shrink-0">
                                    <Send size={20} />
                                </button>
                            </form>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 p-4">
                        <MessageCircle size={64} className="mb-4" />
                        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Select a conversation</h2>
                        <p>Choose a chat from the left panel to start messaging.</p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default MessagesPage;
