import { useState } from 'react';
import { Wrench } from 'lucide-react';

export function ProductImage({
  src,
  alt,
  className = 'h-12 w-16 rounded-lg object-cover',
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} flex items-center justify-center border border-slate-200 bg-slate-100 text-slate-400`}
        title={alt}
      >
        <Wrench className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} border border-slate-200 bg-slate-100`}
    />
  );
}
