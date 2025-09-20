import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  ChatConfig, 
  ChatMessage, 
  SendMessageOptions, 
  SendMessageResponse, 
  StreamMessageOptions, 
  StreamingChunk, 
  BackendConfig,
  ChatError,
  ErrorCodes 
} from '../types';
import { ChatStorage } from '../storage';

export const useChatAgent = (apiBaseUrl: string) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string>('');
  const [config, setConfig] = useState<BackendConfig | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load messages from storage on component mount
  useEffect(() => {
    const storedMessages = ChatStorage.loadChat();
    if (storedMessages.length > 0) {
      setMessages(storedMessages);
    }
  }, []);

  // Save messages to storage whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      ChatStorage.saveChat(messages);
    }
  }, [messages]);

  // Fetch configuration from backend on mount
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        setIsInitializing(true);
        const response = await fetch(`${apiBaseUrl}/v1/config`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || `Failed to fetch configuration: ${response.status}`);
        }
        
        const configData = await response.json();
        setConfig(configData);
        setError(null);
      } catch (err: any) {
        console.error('Failed to load chat configuration:', err);
        const chatError: ChatError = {
          code: ErrorCodes.CONFIG_ERROR,
          message: err instanceof Error ? err.message : 'Failed to initialize chat agent',
          retryable: true
        };
        setError(chatError.message);
      } finally {
        setIsInitializing(false);
      }
    };

    fetchConfig();
  }, [apiBaseUrl]);

  const sendMessage = useCallback(async (message: string, options?: SendMessageOptions): Promise<SendMessageResponse> => {
    if (!config) {
      throw new Error('Chat agent not initialized. Configuration not loaded.');
    }

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
        conversationId: options?.conversationId || conversationId,
        resetConversation: options?.resetConversation,
        metadata: options?.metadata,
        contentTypes: options?.contentTypes,
        format: options?.format,
        language: options?.language
      };

      const response = await fetch(`${apiBaseUrl}/v1/chat`, {
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

      // Update messages state (this will automatically trigger storage save)
      setMessages(prev => [...prev, 
        { 
          role: 'user', 
          content: message, 
          timestamp: new Date(),
          metadata: options?.metadata 
        },
        { 
          role: 'assistant', 
          content: data.response, 
          timestamp: new Date(),
          metadata: data.metadata 
        }
      ]);
      
      return {
        response: data.response,
        conversationId: data.conversationId || conversationId,
        metadata: data.metadata,
        usage: data.usage,
        latency: data.latency
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
  }, [apiBaseUrl, config, conversationId]);

  const sendMessageStream = useCallback(async (
    message: string, 
    options: StreamMessageOptions
  ): Promise<void> => {
    if (!config) {
      throw new Error('Chat agent not initialized. Configuration not loaded.');
    }

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
        conversationId: options?.conversationId || conversationId,
        resetConversation: options?.resetConversation,
        metadata: options?.metadata,
        contentTypes: options?.contentTypes,
        format: options?.format,
        language: options?.language
      };

      const response = await fetch(`${apiBaseUrl}/v1/chat/stream`, {
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
        { 
          role: 'user', 
          content: message, 
          timestamp: new Date(),
          metadata: options.metadata 
        },
        { 
          role: 'assistant', 
          content: '', 
          timestamp: new Date(), 
          isStreaming: true,
          metadata: options.metadata 
        }
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
  }, [apiBaseUrl, config, conversationId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
    setConversationId('');
    ChatStorage.clearChat(); // Clear from storage as well
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

  return {
    // State
    messages,
    isLoading,
    error,
    conversationId,
    isInitializing,
    config,
    
    // Actions
    sendMessage,
    sendMessageStream,
    clearMessages,
    cancelRequest,
    
    // Status helpers
    isInitialized: !!config,
    hasMessages: messages.length > 0,
    canCancel: isLoading && abortControllerRef.current !== null,
    hasChatHistory: ChatStorage.hasChatHistory()
  };
};