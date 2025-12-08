import React, { useState, useEffect } from 'react';

interface AvatarProps {
  src?: string;
  name: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, className = '', onClick }) => {
  const [imgStatus, setImgStatus] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    if (!src) {
        setImgStatus('error');
        return;
    }
    if (src.startsWith('data:')) {
        setImgStatus('loaded');
        return;
    }
    
    setImgStatus('loading');
    const img = new Image();
    img.src = src;
    img.onload = () => setImgStatus('loaded');
    img.onerror = () => setImgStatus('error');
  }, [src]);

  // Generate deterministic color based on name
  const getColor = (name: string) => {
    const colors = [
      'bg-blue-600', 'bg-emerald-600', 'bg-amber-600', 'bg-rose-600', 
      'bg-purple-600', 'bg-indigo-600', 'bg-cyan-600', 'bg-pink-600'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const initial = (name || '?').charAt(0).toUpperCase();

  // Combine classes. 
  // We apply the background color only if the image is not loaded to avoid flashing colors behind transparent images (though avatars are usually opaque)
  const containerClasses = `relative flex items-center justify-center shrink-0 overflow-hidden ${className} ${imgStatus !== 'loaded' ? getColor(name) : 'bg-gray-200 dark:bg-zinc-700'}`;

  return (
    <div className={containerClasses} onClick={onClick}>
       {/* Fallback Initial - visible when loading or error */}
       {imgStatus !== 'loaded' && (
           <span className="text-white font-bold select-none text-[inherit] leading-none">
               {initial}
           </span>
       )}
       
       {/* Image - absolute positioned to cover */}
       {src && imgStatus !== 'error' && (
           <img 
              src={src} 
              alt={name}
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${imgStatus === 'loaded' ? 'opacity-100' : 'opacity-0'}`}
           />
       )}
    </div>
  );
};

export default Avatar;