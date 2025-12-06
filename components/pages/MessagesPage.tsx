
import React, { useContext, useMemo, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../App';
import type { User } from '../../types';
import { MessageStatus } from '../../types';
import { Send, Check, CheckCheck, MessageCircle, ArrowLeft, FileText, Notebook, ExternalLink } from 'lucide-react';

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
            return <CheckCheck size={16} className="text-white" />;
        case MessageStatus.Delivered:
            return <CheckCheck size={16} className="text-white opacity-70" />;
        case MessageStatus.Sent:
            return <Check size={16} className="text-white opacity-70" />;
        default:
            return null;
    }
};

const MessageBubble: React.FC<{ text: string; isSender: boolean }> = ({ text, isSender }) => {
    const { setView, resources } = useContext(AppContext);
    
    const renderText = (text: string) => {
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

    return (
        <div className="break-words whitespace-pre-wrap text-sm md:text-base">
            {renderText(text)}
        </div>
    );
};


const MessagesPage: React.FC<{ activeConversationId: string | null }> = ({ activeConversationId }) => {
    const { user, users, conversations, directMessages, setView, sendMessage, markMessagesAsRead } = useContext(AppContext);
    const [newMessage, setNewMessage] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);

    const usersMap = useMemo(() => new Map(users.map(u => [u.id, u])), [users]);

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

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (newMessage.trim() && activeConversationId) {
            sendMessage(activeConversationId, newMessage);
            setNewMessage('');
        }
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
                                <img src={otherParticipant.avatarUrl} alt={otherParticipant.name} className="w-12 h-12 rounded-full" />
                                <div className="flex-grow overflow-hidden">
                                    <div className="flex justify-between items-center">
                                        <h3 title={otherParticipant.name} className="font-bold text-slate-800 dark:text-white truncate">{otherParticipant.name}</h3>
                                        {lastMessage && <p className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{formatTimestamp(lastMessage.timestamp)}</p>}
                                    </div>
                                    <div className="flex justify-between items-start">
                                        <p title={lastMessage?.text || 'No messages yet'} className="text-sm text-slate-600 dark:text-slate-300 truncate">{lastMessage?.text || 'No messages yet'}</p>
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
                                <img src={otherParticipant.avatarUrl} alt="avatar" className="w-10 h-10 rounded-full" />
                                <div className="min-w-0">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-white truncate">{otherParticipant.name}</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{otherParticipant.course}</p>
                                </div>
                            </button>
                        </div>

                        <div className="flex-grow p-4 md:p-6 overflow-y-auto bg-slate-50 dark:bg-black/20 w-full" key={activeConversationId}>
                            <div className="space-y-4">
                                {activeChatMessages.map(msg => (
                                    <div key={msg.id} className={`flex items-end gap-2 ${msg.senderId === user.id ? 'justify-end' : ''}`}>
                                        {msg.senderId !== user.id && <img src={usersMap.get(msg.senderId)?.avatarUrl} alt="sender" className="w-8 h-8 rounded-full" />}
                                        <div className={`max-w-[85%] md:max-w-md p-3 rounded-2xl min-w-0 ${msg.senderId === user.id ? 'bg-primary-500 text-white rounded-br-none' : 'bg-white dark:bg-zinc-700 text-slate-800 dark:text-white rounded-bl-none shadow-sm'}`}>
                                            <MessageBubble text={msg.text} isSender={msg.senderId === user.id} />
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
                        <div className="p-4 bg-white dark:bg-dark-surface border-t border-slate-200 dark:border-zinc-700 w-full">
                            <form onSubmit={handleSendMessage} className="flex items-center gap-4 w-full">
                                <input
                                    type="text"
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="Type a message..."
                                    className="flex-grow bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 placeholder:text-slate-500 dark:placeholder:text-slate-500 px-4 py-3 border border-slate-300 dark:border-zinc-700 rounded-full focus:ring-primary-500 focus:border-primary-500 transition min-w-0"
                                    autoComplete="off"
                                />
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
