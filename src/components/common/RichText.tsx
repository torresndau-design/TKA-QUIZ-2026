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
  if (!cleaned) return '';

  // 1. Decode double-escaped HTML entities if the string was entity-encoded (e.g. &lt;p&gt;)
  if (cleaned.includes('&lt;') && cleaned.includes('&gt;') && !cleaned.includes('<p>') && !cleaned.includes('<div>')) {
    cleaned = cleaned
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&');
  }

// 2. Convert MS Word / VML image tags (<v:imagedata src="...">) to standard <img> before stripping Word XML
  cleaned = cleaned.replace(/<v:imagedata\s+[^>]*src=["']([^"']+)["'][^>]*\/?>/gi, '<img src="$1" />');
  cleaned = cleaned.replace(/<!--\[if\s+gte\s+vml\s+1\]>[\s\S]*?<v:imagedata\s+[^>]*src=["']([^"']+)["'][^>]*\/?>[\s\S]*?<!\[endif\]-->/gi, '<img src="$1" />');

  // 3. Remove Microsoft Word / Office specific comments & XML tags
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/gi, '');
  cleaned = cleaned.replace(/<\/?(?:o|v|w|m|st1):[^>]*>/gi, '');

  // 4. Use DOMParser to safely sanitize attributes, strip inline styles, remove Word Mso classes, and unwrap useless spans
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${cleaned}</div>`, 'text/html');
    const container = doc.body.firstElementChild || doc.body;

    // Remove style, class, lang attributes from elements except <img>
    const allElements = container.querySelectorAll('*');
    allElements.forEach((el) => {
      el.removeAttribute('style');
      el.removeAttribute('class');
      el.removeAttribute('lang');

      // Process images
      if (el.tagName.toLowerCase() === 'img') {
        const src = (el.getAttribute('src') || '').trim();
        if (
          !src ||
          src === 'undefined' ||
          src === 'null' ||
          src.startsWith('file:') ||
          src.startsWith('cid:')
        ) {
          el.remove();
        }
      }
    });

    // Unwrap <span>, <font>, and <o:p> formatting wrapper tags from Word
    const wrappers = container.querySelectorAll('span, font, o\\:p');
    wrappers.forEach((wrapper) => {
      while (wrapper.firstChild) {
        wrapper.parentNode?.insertBefore(wrapper.firstChild, wrapper);
      }
      wrapper.parentNode?.removeChild(wrapper);
    });

    // Remove empty tags (like <p></p>, <b></b>, <i></i>) that contain no text and no images
    const emptyCandidates = container.querySelectorAll('p, div, b, i, u, strong, em, h1, h2, h3, h4, h5, h6');
    emptyCandidates.forEach((el) => {
      if (!el.innerHTML.trim() && !el.querySelector('img')) {
        el.remove();
      }
    });

    cleaned = container.innerHTML.trim();
  } catch (e) {
    console.warn('DOMParser cleaning fallback:', e);
  }

  return cleaned;
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

