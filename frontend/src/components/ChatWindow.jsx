import { useEffect, useRef } from 'react';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';
import { useChat } from '../hooks/useChat';

/**
 * Main chat window component.
 * Contains the message list and input area.
 */

const EXAMPLES = [
  'What is Aspirin used for?',
  'What are the side effects of Aspirin?',
  'Can I take Aspirin with ibuprofen?',
  'ما هو الأسبرين وما استخداماته؟',
];

export default function ChatWindow() {
  const { messages, isLoading, sendMessage, clearChat } = useChat();
  const messagesEndRef = useRef(null);

  // Auto-scroll to the latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-teal-600 to-teal-700">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💊</span>
          <div>
            <h1 className="text-lg font-semibold text-white">Pharmacy Chatbot</h1>
            <p className="text-xs text-teal-100">Ask about medications, dosage & interactions</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="text-xs text-teal-100 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-teal-500/30"
          >
            Clear Chat
          </button>
        )}
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/50">
        {messages.length === 0 ? (
          // Welcome screen
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-6xl mb-4">💊</div>
            <h2 className="text-xl font-semibold text-gray-700 mb-2">
              Welcome to Pharmacy Chatbot
            </h2>
            <p className="text-sm text-gray-500 mb-6 max-w-md">
              Ask me anything about medications — dosage, side effects,
              contraindications, and drug interactions.
            </p>

            {/* Disclaimer */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6 max-w-md">
              <p className="text-xs text-amber-700">
                <span className="font-semibold">⚠️ Disclaimer:</span> For informational purposes only — not medical advice.
                Always consult a licensed pharmacist or physician.
              </p>
            </div>

            {/* Example questions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  onClick={() => sendMessage(example)}
                  className="
                    text-left text-sm px-4 py-3 rounded-xl
                    bg-white border border-gray-200
                    hover:border-teal-300 hover:bg-teal-50
                    transition-colors text-gray-600
                  "
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Message list
          <>
            {messages.map((msg, i) => (
              <MessageBubble key={i} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
