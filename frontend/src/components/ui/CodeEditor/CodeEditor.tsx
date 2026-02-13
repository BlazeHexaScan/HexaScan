import { useRef, useEffect } from 'react';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: 'typescript' | 'javascript';
  placeholder?: string;
  minHeight?: string;
  maxHeight?: string;
  disabled?: boolean;
  error?: string;
}

/**
 * Simple code editor with syntax highlighting for TypeScript/JavaScript
 * Uses a textarea with monospace font and basic styling
 */
export const CodeEditor = ({
  value,
  onChange,
  language = 'typescript',
  placeholder = '',
  minHeight = '200px',
  maxHeight = '400px',
  disabled = false,
  error,
}: CodeEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const newHeight = Math.min(
        Math.max(textarea.scrollHeight, parseInt(minHeight)),
        parseInt(maxHeight)
      );
      textarea.style.height = `${newHeight}px`;
    }
  }, [value, minHeight, maxHeight]);

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Insert 2 spaces for tab
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);

      // Move cursor after the inserted spaces
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }, 0);
    }
  };

  return (
    <div className="relative">
      <div
        className={`
          relative rounded-lg border overflow-hidden
          ${error
            ? 'border-red-300 dark:border-red-700'
            : 'border-gray-300 dark:border-gray-600'
          }
          ${disabled ? 'opacity-60' : ''}
        `}
      >
        {/* Language badge */}
        <div className="absolute top-2 right-2 z-10">
          <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
            {language === 'typescript' ? 'TypeScript' : 'JavaScript'}
          </span>
        </div>

        {/* Line numbers gutter */}
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-gray-50 dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 pointer-events-none">
          <div className="pt-3 pr-2 text-right font-mono text-xs text-gray-400 dark:text-gray-500 select-none leading-6">
            {value.split('\n').map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
        </div>

        {/* Code textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          spellCheck={false}
          className={`
            w-full pl-12 pr-4 py-3
            font-mono text-sm leading-6
            bg-white dark:bg-gray-900
            text-gray-900 dark:text-gray-100
            placeholder-gray-400 dark:placeholder-gray-500
            focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-inset
            resize-none
            ${disabled ? 'cursor-not-allowed' : ''}
          `}
          style={{
            minHeight,
            maxHeight,
            tabSize: 2,
          }}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
};
