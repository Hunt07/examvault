
import React, { useState, useContext, useMemo } from 'react';
import { X, Mail, MessageSquare, Copy, Check, Search, Send, ArrowLeft, Link as LinkIcon } from 'lucide-react';
import { AppContext } from '../App';
import type { Resource } from '../types';
import Avatar from './Avatar';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  resource: Resource;
}

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
);

const TwitterIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"></path></svg>
);

const LinkedinIcon = () => (
  <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-blue-700"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
);

const WhatsAppIcon = () => (
    <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
        <path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
        <path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1" />
    </svg>
);

const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose, resource }) => {
  const { users, user: currentUser, sendDirectMessageToUser } = useContext(AppContext);
  const [mode, setMode] = useState<'options' | 'chat'>('options');
  const [copied, setCopied] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sentTo, setSentTo] = useState<Set<string>>(new Set());

  if (!isOpen) return null;

  // Mock URL - in a real app this would be the actual route
  const shareUrl = `${window.location.origin}?resourceId=${resource.id}`;
  const shareText = `Check out this resource on ExamVault: ${resource.title}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShareToChat = (recipientId: string) => {
    if (!currentUser) return;

    // ONLY send the URL using the non-navigating function to keep user in the modal
    sendDirectMessageToUser(recipientId, shareUrl);
    setSentTo(prev => new Set(prev).add(recipientId));
  };

  const filteredUsers = users.filter(u => 
    u.id !== currentUser?.id && 
    u.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderOptions = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <a 
            href={`mailto:?subject=${encodeURIComponent(resource.title)}&body=${encodeURIComponent(shareText + '\n' + shareUrl)}`}
            className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition group"
            target="_blank" rel="noopener noreferrer"
        >
            <div className="w-12 h-12 bg-slate-100 dark:bg-zinc-800 rounded-full flex items-center justify-center group-hover:bg-slate-200 dark:group-hover:bg-zinc-700 transition">
                <Mail className="text-slate-700 dark:text-slate-300" size={24} />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Email</span>
        </a>
        
        <button 
            onClick={() => setMode('chat')}
            className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition group"
        >
            <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition">
                <MessageSquare className="text-primary-600 dark:text-primary-400" size={24} />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chat</span>
        </button>

        <a 
            href={`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + shareUrl)}`}
            target="_blank" rel="noopener noreferrer"
            className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition group"
        >
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition">
                <WhatsAppIcon />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">WhatsApp</span>
        </a>

        <a 
             href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`}
             target="_blank" rel="noopener noreferrer"
             className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition group"
        >
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition">
                <FacebookIcon />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Facebook</span>
        </a>
         <a 
             href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`}
             target="_blank" rel="noopener noreferrer"
             className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition group"
        >
            <div className="w-12 h-12 bg-sky-50 dark:bg-sky-900/20 rounded-full flex items-center justify-center group-hover:bg-sky-100 dark:group-hover:bg-sky-900/40 transition">
                <TwitterIcon />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Twitter</span>
        </a>
         <a 
             href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
             target="_blank" rel="noopener noreferrer"
             className="flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition group"
        >
            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40 transition">
                <LinkedinIcon />
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">LinkedIn</span>
        </a>
      </div>

      <div className="bg-slate-100 dark:bg-zinc-800 p-3 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 overflow-hidden">
            <LinkIcon size={16} className="shrink-0" />
            <span className="text-sm truncate">{shareUrl}</span>
        </div>
        <button 
            onClick={handleCopy}
            className={`ml-2 px-3 py-1.5 rounded-md text-sm font-bold transition flex items-center gap-2 shrink-0 ${copied ? 'bg-green-600 text-white' : 'bg-white dark:bg-zinc-700 text-slate-700 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-600'}`}
        >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );

  const renderChatSelection = () => (
    <div className="h-96 flex flex-col">
        <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
                type="text"
                placeholder="Search for a user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-100 dark:bg-zinc-800 dark:text-white text-slate-900 pl-10 pr-4 py-2 rounded-lg border-none focus:ring-2 focus:ring-primary-500"
                autoFocus
            />
        </div>
        <div className="flex-grow overflow-y-auto space-y-2">
            {filteredUsers.length > 0 ? (
                filteredUsers.map(user => {
                    const isSent = sentTo.has(user.id);
                    return (
                        <button
                            key={user.id}
                            onClick={() => !isSent && handleShareToChat(user.id)}
                            disabled={isSent}
                            className={`w-full flex items-center justify-between p-3 rounded-lg transition text-left ${isSent ? 'opacity-50 cursor-default' : 'hover:bg-slate-50 dark:hover:bg-zinc-700'}`}
                        >
                            <div className="flex items-center gap-3">
                                <Avatar src={user.avatarUrl} alt={user.name} className="w-10 h-10" />
                                <div>
                                    <div className="flex items-center gap-2">
                                        <p className="font-semibold text-slate-800 dark:text-white">{user.name}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{user.course}</p>
                                </div>
                            </div>
                            {isSent ? (
                                <span className="text-green-600 dark:text-green-400 text-sm font-bold flex items-center gap-1">
                                    <Check size={16} /> Sent
                                </span>
                            ) : (
                                <div className="bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 p-2 rounded-full hover:bg-primary-100 dark:hover:bg-primary-900/40 transition">
                                    <Send size={16} />
                                </div>
                            )}
                        </button>
                    );
                })
            ) : (
                <p className="text-center text-slate-400 mt-8">No users found.</p>
            )}
        </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-dark-surface rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-transparent dark:border-zinc-700">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-700 flex justify-between items-center bg-slate-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-2">
                {mode === 'chat' && (
                    <button onClick={() => setMode('options')} className="mr-2 p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition">
                        <ArrowLeft size={20} className="text-slate-600 dark:text-slate-400" />
                    </button>
                )}
                <h3 className="font-bold text-slate-800 dark:text-white">{mode === 'chat' ? 'Send to Chat' : 'Share Resource'}</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-zinc-700 transition">
                <X size={20} className="text-slate-500 dark:text-slate-400" />
            </button>
        </div>
        <div className="p-6">
            {mode === 'options' ? renderOptions() : renderChatSelection()}
        </div>
      </div>
    </div>
  );
};

export default ShareModal;
