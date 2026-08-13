import React, { useEffect, useRef } from 'react';

interface RichTextProps {
  content?: string;
  className?: string;
}

/**
 * Cleans raw HTML/Word strings to prevent MS Word bloat, unextracted local image paths, and raw HTML display
 */
export function cleanHtmlContent(raw?: string): string {
  if (!raw) return '';

  let cleaned = String(raw).trim();

  // 1. Decode double-escaped or entity-encoded HTML strings first (e.g. &quot;, &#39;, &lt;, &gt;, &amp;)
  cleaned = cleaned
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

  // 2. Remove Microsoft Word / Office specific comments & XML tags
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '');
  cleaned = cleaned.replace(/<\/?o:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?v:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?w:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?m:[^>]*>/gi, '');
  cleaned = cleaned.replace(/<\/?st1:[^>]*>/gi, '');

  // 3. Remove all MS Word classes (MsoNormal, SpellE, etc.) and inline style attributes completely
  cleaned = cleaned.replace(/\s*class=["'][^"']*["']/gi, '');
  cleaned = cleaned.replace(/\s*style=["'][^"']*["']/gi, '');

  // 4. Clean <img> tags: Remove <img> if src is missing, empty, file://, cid:, local relative path without base64/http
  cleaned = cleaned.replace(/<img\s+[^>]*>/gi, (imgTag) => {
    const srcMatch = imgTag.match(/src=["']([^"']*)["']/i);
    if (!srcMatch || !srcMatch[1]) return '';
    const src = srcMatch[1].trim();
    if (!src || src === 'undefined' || src === 'null') return '';
    if (src.startsWith('file:') || src.startsWith('cid:') || src.startsWith('blob:')) return '';
    // If src does not start with http://, https://, or data:image/, remove it
    if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:image/')) return '';
    return imgTag;
  });

  // 5. Remove empty/redundant tags like <p></p>, <span></span>, <b></b>
  cleaned = cleaned.replace(/<(p|span|b|i|u|strong|em)\b[^>]*>\s*<\/\1>/gi, '');

  return cleaned.trim();
}

export const RichText: React.FC<RichTextProps> = ({ content, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  if (!content) return null;

  const cleanedContent = cleanHtmlContent(content);

  // Attach image error handlers to gracefully hide broken images
  useEffect(() => {
    if (!containerRef.current) return;
    const images = containerRef.current.querySelectorAll('img');
    images.forEach((img) => {
      img.onerror = () => {
        img.style.display = 'none';
      };
    });
  }, [cleanedContent]);

  // Check if content has HTML tags
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(cleanedContent);

  if (hasHtmlTags) {
    return (
      <div
        ref={containerRef}
        className={`rich-text-container leading-relaxed [&_img]:max-w-full [&_img]:max-h-96 [&_img]:my-2 [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200 [&_img]:dark:border-slate-700 [&_img]:shadow-sm [&_img]:inline-block [&_img]:object-contain [&_p]:my-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: cleanedContent }}
      />
    );
  }

  return (
    <div ref={containerRef} className={`whitespace-pre-wrap leading-relaxed ${className}`}>
      {cleanedContent}
    </div>
  );
};

export default RichText;

