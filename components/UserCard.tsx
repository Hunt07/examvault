import React, { useContext } from 'react';
import type { User } from '../types';
import { Award } from 'lucide-react';
import { AppContext } from '../App';
import UserRankBadge from './UserRankBadge';
import Avatar from './Avatar';

interface UserCardProps {
  user: User;
  onSelect: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onSelect }) => {
  const { userRanks } = useContext(AppContext);
  const userRank = userRanks.get(user.id);
  return (
    <div
      onClick={onSelect}
      className="bg-white dark:bg-zinc-800 rounded-xl shadow-md p-4 flex flex-col items-center text-center hover:shadow-xl transition-all duration-300 cursor-pointer group border border-transparent dark:border-zinc-700"
    >
      <Avatar
        className="w-24 h-24 rounded-full border-4 border-slate-200 dark:border-zinc-700 group-hover:border-primary-400 dark:group-hover:border-primary-500 transition-colors object-cover"
        src={user.avatarUrl}
        name={user.name}
      />
      <div className="flex items-center mt-4">
        <h3 className="text-lg font-bold text-slate-800 dark:text-white group-hover:text-primary-700 dark:group-hover:text-primary-400 transition truncate" title={user.name}>
          {user.name}
        </h3>
        <UserRankBadge rank={userRank} />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">{user.course}</p>
      <div className="flex items-center gap-2 mt-3 text-sm text-primary-600 dark:text-primary-400 font-semibold bg-primary-50 dark:bg-primary-900/30 px-3 py-1 rounded-full">
        <Award size={16} />
        <span>{user.points.toLocaleString()} points</span>
      </div>
    </div>
  );
};

export default UserCard;