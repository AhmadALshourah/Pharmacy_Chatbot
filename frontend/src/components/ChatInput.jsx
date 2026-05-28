import { useState, useRef, useEffect } from 'react';

/**
 * Chat input box with send button.
 * Enter to send, Shift+Enter for newline.
 */
export default function ChatInput({ onSend, disabled }) {
  const [text, setText] = useState('');
  const textareaRef = useRef(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [text]);

  const handleSubmit = () => {
    if (text.trim() && !disabled) {
      onSend(text.trim());
      setText('');
      // Reset height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex items-end gap-3 p-4 border-t border-gray-200 bg-white">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about medications... (Arabic or English)"
        disabled={disabled}
        rows={1}
        className="
          flex-1 resize-none rounded-xl border border-gray-300
          px-4 py-3 text-sm
          focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent
          disabled:bg-gray-50 disabled:text-gray-400
          placeholder:text-gray-400
        "
      />
      <button
        onClick={handleSubmit}
        disabled={disabled || !text.trim()}
        className="
          flex-shrink-0 w-11 h-11 rounded-xl
          bg-teal-600 text-white
          flex items-center justify-center
          hover:bg-teal-700 transition-colors
          disabled:bg-gray-300 disabled:cursor-not-allowed
        "
        aria-label="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
        </svg>
      </button>
    </div>
  );
}
