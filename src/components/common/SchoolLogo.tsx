import React, { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import defaultLogo from '../../assets/logo.jpg';

interface SchoolLogoProps {
  src?: string;
  alt?: string;
  className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  src,
  alt = 'Logo SMKS SANJAYA BAJAWA',
  className = 'w-10 h-10 object-contain',
}) => {
  const [errorCount, setErrorCount] = useState(0);

  // Fallback chain: if src is invalid or contains tka, use defaultLogo
  let currentSrc = defaultLogo;
  if (src && !src.includes('tka_logo') && src !== '/logo.jpg') {
    currentSrc = src;
  }

  if (errorCount >= 1) {
    currentSrc = defaultLogo;
  }

  if (errorCount >= 2) {
    return (
      <div
        className={`flex items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white shadow-sm shrink-0 ${className}`}
        title={alt}
      >
        <GraduationCap className="w-2/3 h-2/3" />
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      onError={() => setErrorCount((prev) => prev + 1)}
      className={`${className} object-contain`}
    />
  );
};
