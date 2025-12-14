
import React, { useState, useEffect, useRef } from 'react';

interface AvatarProps {
  src?: string;
  alt: string;
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, alt, className = "w-10 h-10" }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // If src changes, reset loaded state unless it matches the previous successfully loaded one immediately
    if (src !== currentSrc) {
        setIsLoaded(false);
        setCurrentSrc(src);
    }
  }, [src, currentSrc]);

  useEffect(() => {
      // Check if the image is already loaded in the browser cache
      if (imgRef.current && imgRef.current.complete && imgRef.current.naturalWidth > 0) {
          setIsLoaded(true);
      }
  }, [src]);

  const initial = alt && alt.length > 0 ? alt.charAt(0).toUpperCase() : '?';

  // Ensure className includes 'rounded-full' if not explicitly overridden
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
          ref={imgRef}
          src={src}
          alt={alt}
          className={`relative w-full h-full object-cover transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setIsLoaded(false)}
          loading="lazy" 
        />
      )}
    </div>
  );
};

export default Avatar;
