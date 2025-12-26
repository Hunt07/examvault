
import React, { useState, useEffect } from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, className = "w-10 h-10" }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  useEffect(() => {
    // Reset loading state when src changes
    if (src !== currentSrc) {
        setIsLoaded(false);
        setCurrentSrc(src);
    }
  }, [src, currentSrc]);

  const initial = alt && alt.length > 0 ? alt.charAt(0).toUpperCase() : '?';

  // Ensure className includes 'rounded-full' if not explicitly overridden (though usually passed in)
  const containerClass = `${className} relative rounded-full overflow-hidden bg-slate-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center`;

  return (
    <div className={containerClass}>
      {/* Background/Placeholder - Always rendered behind */}
      <span className="absolute text-slate-500 dark:text-slate-400 font-bold uppercase select-none text-sm md:text-base">
        {initial}
      </span>
      
      {/* Image Layer */}
      {src && (
        <img
          src={src}
          alt={alt}
          className={`relative w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(false)}
          loading="eager"
        />
      )}
    </div>
  );
};

export default Avatar;
