
import React, { useContext } from 'react';
import type { Resource } from '../types';
import { ThumbsUp, MessageSquare, FileText, Notebook } from 'lucide-react';
import { AppContext } from '../App';
import UserRankBadge from './UserRankBadge';
import Avatar from './Avatar';

interface ResourceCardProps {
  resource: Resource;
  onSelect: () => void;
  onAuthorClick: (authorId: string) => void;
  compact?: boolean;
}

const ResourceCard: React.FC<ResourceCardProps> = ({ resource, onSelect, onAuthorClick, compact = false }) => {
  const { userRanks } = useContext(AppContext);
  const authorRank = userRanks.get(resource.author.id);

  return (
    <div 
        onClick={onSelect}
        className={`bg-white dark:bg-dark-surface rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-all duration-300 cursor-pointer group border border-transparent dark:border-zinc-700 ${compact ? 'text-sm' : ''}`}
    >
      <div className="relative">
        <img
          className={`w-full object-cover ${compact ? 'h-28' : 'h-48'}`}
          src={resource.previewImageUrl}
          alt={resource.title}
        />
        <div className={`absolute top-3 right-3 flex items-center gap-2 font-semibold rounded-full ${resource.type === 'Past Paper' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/80 dark:text-blue-200' : 'bg-green-100 text-green-800 dark:bg-green-900/80 dark:text-green-200'} ${compact ? 'text-[10px] px-2 py-0.5' : 'text-xs px-2 py-1'}`}>
          {resource.type === 'Past Paper' ? <FileText size={compact ? 12 : 14}/> : <Notebook size={compact ? 12 : 14}/>}
          {!compact && resource.type}
        </div>
      </div>
      <div className={compact ? 'p-3' : 'p-4'}>
        <p className={`font-bold text-primary-600 dark:text-primary-400 ${compact ? 'text-[10px]' : 'text-sm'}`}>{resource.courseCode}</p>
        <h3
          title={resource.title}
          className={`font-bold text-slate-800 dark:text-white mt-1 truncate group-hover:text-primary-700 dark:group-hover:text-primary-400 transition ${compact ? 'text-sm' : 'text-lg'}`}
        >
          {resource.title}
        </h3>
        {!compact && <p className="text-slate-500 dark:text-slate-200 mt-1 truncate text-sm">{resource.courseName}</p>}
        
        <div className={`flex items-center justify-between mt-4 text-slate-600 dark:text-slate-400 ${compact ? 'text-xs' : 'text-sm'}`}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onAuthorClick(resource.author.id);
            }}
            className="flex items-center gap-2 rounded-md p-1 -ml-1 hover:bg-slate-100 dark:hover:bg-zinc-700 max-w-[70%]"
          >
            <Avatar 
                src={resource.author.avatarUrl} 
                alt={resource.author.name} 
                className={compact ? 'w-5 h-5' : 'w-6 h-6'} 
            />
            <div className="flex items-center min-w-0">
                <span className="truncate text-slate-700 dark:text-white">{resource.author.name}</span>
                <UserRankBadge rank={authorRank} size={compact ? 10 : 14} />
            </div>
          </button>
          <div className="flex items-center gap-3 shrink-0 text-slate-500 dark:text-slate-400">
            <span className="flex items-center">
              <ThumbsUp size={compact ? 12 : 16} />
              {resource.upvotes > 0 && <span className="ml-1">{resource.upvotes}</span>}
            </span>
            {!compact && (
                <span className="flex items-center">
                <MessageSquare size={16} />
                {resource.comments.length > 0 && <span className="ml-1">{resource.comments.length}</span>}
                </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResourceCard;
