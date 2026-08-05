import React from 'react';
import { GraduationCap } from 'lucide-react';

interface SchoolLogoProps {
  src?: string;
  alt?: string;
  className?: string;
}

export const SchoolLogo: React.FC<SchoolLogoProps> = ({
  alt = 'Logo SMKS SANJAYA BAJAWA',
  className = 'w-10 h-10',
}) => {
  return (
    <div
      className={`flex items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-700 text-white shadow-sm shrink-0 ${className}`}
      title={alt}
    >
      <GraduationCap className="w-3/5 h-3/5" />
    </div>
  );
};

