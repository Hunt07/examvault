
import React from 'react';

interface UserRankBadgeProps {
  rank?: number;
  size?: number;
}

const UserRankBadge: React.FC<UserRankBadgeProps> = ({ rank, size = 24 }) => {
  if (rank === undefined || rank > 2) {
    return null;
  }

  const titles = ['Gold Medal - 1st Place', 'Silver Medal - 2nd Place', 'Bronze Medal - 3rd Place'];
  
  const medalColors = [
      { main: '#FFD700', dark: '#F57F17', light: '#FFF59D', ribbon: '#D32F2F' }, // Gold
      { main: '#E0E0E0', dark: '#757575', light: '#FAFAFA', ribbon: '#1976D2' }, // Silver
      { main: '#CD7F32', dark: '#5D4037', light: '#FFCCBC', ribbon: '#388E3C' }, // Bronze
  ];

  const color = medalColors[rank];
  return (
    <div className="inline-flex items-center justify-center ml-2 shrink-0" title={titles[rank]}>
        <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id={`shadow-${rank}`} x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="1" stdDeviation="0.5" floodOpacity="0.2" />
                </filter>
            </defs>

            {/* Ribbon */}
            <path d="M10 2L16 9L22 2H10Z" fill={color.ribbon} />
            <path d="M8 4L16 12L24 4" stroke={color.ribbon} strokeWidth="2" strokeLinecap="round" />
            
            {/* Medal Body */}
            <g filter={`url(#shadow-${rank})`}>
                <circle cx="16" cy="18" r="10" fill={color.main} stroke={color.dark} strokeWidth="1" />
                <circle cx="16" cy="18" r="8.5" fill="none" stroke={color.light} strokeWidth="0.5" opacity="0.6"/>
            </g>
            
            {/* Star / Number */}
            {rank === 0 ? (
                    <path d="M16 13L17 16H20L17.5 18L18.5 21L16 19L13.5 21L14.5 18L12 16H15L16 13Z" fill="white" stroke={color.dark} strokeWidth="0.5"/>
            ) : (
                    <text x="16" y="22" fontSize="11" fontWeight="900" fill={color.dark} textAnchor="middle" fontFamily="Arial, sans-serif">{rank + 1}</text>
            )}
        </svg>
    </div>
  );
};

export default UserRankBadge;
