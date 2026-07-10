import React, { useState } from 'react';
import { motion } from 'motion/react';

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  skeletonClassName?: string;
  id?: string;
}

export default function LazyImage({
  src,
  alt,
  className = '',
  containerClassName = '',
  skeletonClassName = 'bg-slate-150 animate-pulse',
  id,
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  React.useEffect(() => {
    setLoaded(false);
    setError(false);
  }, [src]);

  return (
    <div className={`relative overflow-hidden ${containerClassName}`} id={id ? `lazy-container-${id}` : undefined}>
      {/* Skeleton loader shown before image loaded */}
      {!loaded && !error && (
        <div className={`absolute inset-0 z-10 ${skeletonClassName}`} />
      )}

      {/* Error placeholder if image fails to load */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400 text-[10px] p-2 text-center font-medium">
          <span>Sem imagem</span>
        </div>
      )}

      {/* Lazy loaded image with smooth transition */}
      <motion.img
        src={src}
        alt={alt}
        initial={{ opacity: 0 }}
        animate={{ opacity: loaded ? 1 : 0 }}
        transition={{ duration: 0.3 }}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        className={`${className} ${!loaded ? 'absolute top-0 left-0 w-full h-full opacity-0' : ''}`}
        id={id}
      />
    </div>
  );
}
