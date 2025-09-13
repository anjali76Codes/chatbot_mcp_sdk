import { useState, useCallback, useRef } from 'react';
import { ChatConfig, ChatMessage, SendMessageOptions, SendMessageResponse, StreamMessageOptions, StreamingChunk } from '../types';

export const useChatAgent = (config: ChatConfig) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (message: string, options?: SendMessageOptions): Promise<SendMessageResponse> => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        message,
        config: {
          contentstack: config.contentstack,
          llm: config.llm
        },
        conversationId: options?.conversationId || conversationId,
        resetConversation: options?.resetConversation,
        metadata: options?.metadata
      };

      const response = await fetch(`${config.apiBaseUrl}/v1/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Update conversation ID if provided
      if (data.conversationId) {
        setConversationId(data.conversationId);
      }

      setMessages(prev => [...prev, 
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: data.response, timestamp: new Date() }
      ]);
      
      return {
        response: data.response,
        conversationId: data.conversationId || conversationId,
        metadata: data.metadata
      };
      
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err; // Don't show error for aborted requests
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [config, conversationId]);

  const sendMessageStream = useCallback(async (
    message: string, 
    options: StreamMessageOptions
  ): Promise<void> => {
    // Cancel any ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    setIsLoading(true);
    setError(null);
    
    try {
      const payload = {
        message,
        config: {
          contentstack: config.contentstack,
          llm: config.llm
        },
        conversationId: options?.conversationId || conversationId,
        resetConversation: options?.resetConversation,
        metadata: options?.metadata
      };

      const response = await fetch(`${config.apiBaseUrl}/v1/chat/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Add user message and empty assistant message for streaming
      setMessages(prev => [
        ...prev, 
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: '', timestamp: new Date(), isStreaming: true }
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let convId = conversationId;

      try {
        while (true) {
          const { done, value } = await reader!.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              
              try {
                const parsed = JSON.parse(data);
                
                if (parsed.done) {
                  // Streaming complete
                  options.onChunk?.({ content: '', done: true, conversationId: parsed.conversationId });
                  
                  // Update conversation ID if provided
                  if (parsed.conversationId) {
                    convId = parsed.conversationId;
                    setConversationId(convId);
                  }
                  break;
                }
                
                if (parsed.chunk) {
                  fullResponse += parsed.chunk;
                  
                  // Update the last message (assistant's response) in real-time
                  setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'assistant') {
                      newMessages[newMessages.length - 1] = {
                        ...lastMessage,
                        content: fullResponse
                      };
                    }
                    return newMessages;
                  });
                  
                  // Call the onChunk callback
                  options.onChunk?.({ 
                    content: parsed.chunk, 
                    done: false,
                    conversationId: parsed.conversationId 
                  });
                }
                
                if (parsed.conversationId) {
                  convId = parsed.conversationId;
                  setConversationId(convId);
                }
                
              } catch (e) {
                console.warn('Failed to parse streaming chunk:', e);
              }
            }
          }
        }
      } finally {
        reader?.releaseLock();
      }

      // Final update to remove streaming flag
      setMessages(prev => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage.role === 'assistant') {
          newMessages[newMessages.length - 1] = {
            ...lastMessage,
            content: fullResponse,
            isStreaming: false
          };
        }
        return newMessages;
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw err; // Don't show error for aborted requests
      }
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to send message';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [config, conversationId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setConversationId('');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  }, []);

  const updateConfig = useCallback((newConfig: Partial<ChatConfig>) => {
    return { ...config, ...newConfig };
  }, [config]);

  return {
    // State
    messages,
    isLoading,
    error,
    conversationId,
    
    // Actions
    sendMessage,
    sendMessageStream,
    clearMessages,
    updateConfig,
    cancelRequest,
    
    // Status helpers
    isInitialized: !!config.apiBaseUrl,
    hasMessages: messages.length > 0,
    canCancel: isLoading && abortControllerRef.current !== null
  };
};