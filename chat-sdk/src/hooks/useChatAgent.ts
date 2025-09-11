import { useState, useCallback, useRef } from 'react';
import { ChatConfig, ChatMessage, SendMessageOptions, SendMessageResponse } from '../types';

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
        metadata: options?.metadata,
        stream: options?.stream || false
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

      // Handle streaming response
      if (options?.stream) {
        return handleStreamingResponse(response, message, options?.onChunk);
      }

      // Handle regular response
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

  const handleStreamingResponse = async (
    response: Response, 
    userMessage: string,
    onChunk?: (chunk: string) => void
  ): Promise<SendMessageResponse> => {
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';
    let convId = conversationId;

    // Add user message and empty assistant message
    setMessages(prev => [
      ...prev, 
      { role: 'user', content: userMessage, timestamp: new Date() },
      { role: 'assistant', content: '', timestamp: new Date() }
    ]);

    try {
      while (true) {
        const { done, value } = await reader!.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') break;
            
            try {
              const parsed = JSON.parse(data);
              if (parsed.conversationId) {
                convId = parsed.conversationId;
                setConversationId(convId);
              }
              
              if (parsed.content) {
                fullResponse += parsed.content;
                // Update the last message (assistant's response)
                setMessages(prev => {
                  const newMessages = [...prev];
                  newMessages[newMessages.length - 1] = {
                    ...newMessages[newMessages.length - 1],
                    content: fullResponse
                  };
                  return newMessages;
                });
                
                onChunk?.(parsed.content);
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

    return { response: fullResponse, conversationId: convId };
  };

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
    clearMessages,
    updateConfig,
    cancelRequest,
    
    // Status helpers
    isInitialized: !!config.apiBaseUrl,
    hasMessages: messages.length > 0,
    canCancel: isLoading && abortControllerRef.current !== null
  };

  
};