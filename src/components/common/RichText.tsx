import React from 'react';

interface RichTextProps {
  content?: string;
  className?: string;
}

export const RichText: React.FC<RichTextProps> = ({ content, className = '' }) => {
  if (!content) return null;

  // Cek apakah konten mengandung tag HTML (seperti <img>, <p>, <br>, dll.)
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(content);

  if (hasHtmlTags) {
    return (
      <div
        className={`rich-text-container leading-relaxed [&_img]:max-w-full [&_img]:max-h-96 [&_img]:my-2 [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_img]:dark:border-slate-700 [&_img]:shadow-sm [&_img]:inline-block [&_img]:object-contain [&_p]:my-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return <div className={`whitespace-pre-wrap leading-relaxed ${className}`}>{content}</div>;
};

export default RichText;