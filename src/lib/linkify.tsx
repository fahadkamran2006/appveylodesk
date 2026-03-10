import React from 'react';

const URL_REGEX = /(https?:\/\/[^\s<]+)/g;

/**
 * Renders text with clickable links for any URLs found.
 */
export function Linkify({ text, className }: { text: string; className?: string }) {
  const parts = text.split(URL_REGEX);

  return (
    <span className={className}>
      {parts.map((part, i) =>
        URL_REGEX.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-2 hover:text-primary/80 break-all"
            onClick={(e) => e.stopPropagation()}
          >
            {part.length > 60 ? part.slice(0, 57) + '...' : part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </span>
  );
}
