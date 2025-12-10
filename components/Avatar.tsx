import React, { useState, useEffect } from 'react';

// Helper to generate default SVG avatar
export const generateDefaultAvatar = (name: string): string => {
  const initial = name && name.length > 0 ? name.charAt(0).toUpperCase() : '?';
  const colors = ['#2563eb', '#db2777', '#ca8a04', '#16a34a', '#dc2626', '#7c3aed', '#0891b2', '#be123c'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const color = colors[Math.abs(hash) % colors.length];

  const svgString = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="${color}"/>
      <text x="50" y="65" font-family="Arial, sans-serif" font-size="50" font-weight="bold" fill="white" text-anchor="middle">${initial}</text>
    </svg>
  `.trim();
  return `data:image/svg+xml;base64,${btoa(svgString)}`;
};

interface AvatarProps {
  src?: string;
  name: string;
  className?: string;
  onClick?: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, className = "", onClick }) => {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const defaultAvatar = generateDefaultAvatar(name);

    // If no src, show default immediately
    if (!src || src === '') {
        setImgSrc(defaultAvatar);
        setIsLoading(false);
        return;
    }

    // Check if image is already cached/loaded to avoid flicker
    const img = new Image();
    img.src = src;

    if (img.complete) {
        setImgSrc(src);
        setIsLoading(false);
        return;
    }

    // Only set loading if not cached
    setIsLoading(true);

    img.onload = () => {
        if (active) {
            setImgSrc(src);
            setIsLoading(false);
        }
    };

    img.onerror = () => {
        if (active) {
            setImgSrc(defaultAvatar);
            setIsLoading(false);
        }
    };

    return () => {
        active = false;
    };
  }, [src, name]);

  return (
    <div 
        className={`relative overflow-hidden bg-slate-200 dark:bg-zinc-700 shrink-0 ${className}`} 
        onClick={onClick}
    >
      {isLoading && (
        <div className="absolute inset-0 animate-pulse bg-slate-300 dark:bg-zinc-600 w-full h-full" />
      )}
      <img 
        src={imgSrc || generateDefaultAvatar(name)}
        alt={name} 
        className={`w-full h-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
      />
    </div>
  );
};

export default Avatar;