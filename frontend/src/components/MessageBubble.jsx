/**
 * A single chat message bubble.
 * User messages are right-aligned, bot messages are left-aligned.
 */
export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const isLoading = message.content === '▌';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {/* Bot avatar */}
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-100 flex items-center justify-center mr-3 mt-1">
          <span className="text-base">💊</span>
        </div>
      )}

      <div
        className={`
          max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? 'bg-teal-600 text-white rounded-br-sm'
            : 'bg-gray-100 text-gray-800 rounded-bl-sm'
          }
        `}
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
          </span>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-teal-600 flex items-center justify-center ml-3 mt-1">
          <span className="text-white text-xs font-bold">You</span>
        </div>
      )}
    </div>
  );
}
