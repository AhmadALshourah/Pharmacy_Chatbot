import { useState, useCallback } from 'react';
import { streamChat } from '../services/api';

/**
 * Custom hook for managing chat state and streaming responses.
 */
export function useChat() {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading) return;

    setError(null);

    // Add user message
    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    // Add placeholder for assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '▌' }]);
    setIsLoading(true);

    try {
      // Build history (exclude the placeholder)
      const history = updatedMessages.slice(0, -1).map(m => ({
        role: m.role,
        content: m.content,
      }));

      let lastContent = '';

      for await (const event of streamChat(text, history)) {
        if (event.error) {
          setError(event.error);
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: `Error: ${event.error}` },
          ]);
          break;
        }

        if (event.token) {
          lastContent = event.token;
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: event.token },
          ]);
        }

        if (event.done && event.content) {
          lastContent = event.content;
          setMessages(prev => [
            ...prev.slice(0, -1),
            {
              role: 'assistant',
              content: event.content,
              sources: event.sources || [],
            },
          ]);
        }
      }

      // If we never got content, remove the placeholder
      if (!lastContent) {
        setMessages(prev => prev.slice(0, -1));
      }
    } catch (err) {
      setError(err.message);
      setMessages(prev => [
        ...prev.slice(0, -1),
        { role: 'assistant', content: 'Failed to get a response. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, isLoading]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
  };
}
