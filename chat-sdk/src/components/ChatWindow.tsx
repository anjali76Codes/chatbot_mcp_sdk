import React, { useState, useRef, useEffect } from 'react';
import { useChatAgent } from '../hooks/useChatAgent';
import { ChatConfig, SendMessageOptions } from '../types';
import { FaPaperPlane, FaRedo, FaTimes, FaComment, FaStop, FaGem } from 'react-icons/fa';

interface ChatWindowProps {
  config: ChatConfig;
  title?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  showHeader?: boolean;
  streaming?: boolean;
  className?: string;
  placeholder?: string;
  showResetButton?: boolean;
}

// Utility function for error handling
const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === 'AbortError';
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ 
  config, 
  title = "Jewelry Assistant",
  position = "bottom-right",
  showHeader = true,
  streaming = false,
  className = "",
  placeholder = "Type your message...",
  showResetButton = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<Array<{role: string, content: string, timestamp?: Date}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    clearMessages, 
    cancelRequest,
    canCancel
  } = useChatAgent(config);

  // Update local messages when the hook messages change
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [localMessages]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      // Add user message immediately to UI
      const userMessage = {
        role: 'user',
        content: inputMessage.trim(),
        timestamp: new Date()
      };
      
      setLocalMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      
      const options: SendMessageOptions = {
        stream: streaming,
        onChunk: streaming ? (chunk) => {
          // Optional: handle individual chunks if needed
          console.log('Received chunk:', chunk);
        } : undefined
      };

      try {
        await sendMessage(inputMessage.trim(), options);
      } catch (error) {
        // Proper error type checking
        if (!isAbortError(error)) {
          console.error('Failed to send message:', error);
        }
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed z-50 w-16 h-16 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-110 hover:shadow-3xl ${
          position === 'bottom-right' ? 'bottom-6 right-6' :
          position === 'bottom-left' ? 'bottom-6 left-6' :
          position === 'top-right' ? 'top-6 right-6' : 'top-6 left-6'
        }`}
        aria-label="Open chat"
      >
        <FaGem className="text-2xl" />
        {localMessages.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {localMessages.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className={`fixed z-50 w-96 h-96 bg-white rounded-2xl shadow-2xl flex flex-col border border-gray-200 ${className} ${
      position === 'bottom-right' ? 'bottom-6 right-6' :
      position === 'bottom-left' ? 'bottom-6 left-6' :
      position === 'top-right' ? 'top-6 right-6' : 'top-6 left-6'
    }`}>
      {showHeader && (
        <div className="bg-gradient-to-r from-amber-400 to-amber-600 text-white p-4 flex items-center justify-between rounded-t-2xl">
          <h3 className="font-semibold flex items-center gap-2">
            <FaGem className="text-lg" />
            {title}
          </h3>
          <div className="flex items-center gap-2">
            {showResetButton && (
              <button 
                onClick={() => {
                  clearMessages();
                  setLocalMessages([]);
                }} 
                className="text-white hover:text-amber-200 transition-colors"
                title="Clear conversation"
              >
                <FaRedo />
              </button>
            )}
            <button 
              onClick={() => setIsOpen(false)} 
              className="text-white hover:text-amber-200 transition-colors"
              title="Close chat"
            >
              <FaTimes />
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 bg-amber-50">
        {localMessages.length === 0 ? (
          <div className="text-center text-amber-800 py-8">
            <FaGem className="text-4xl mx-auto mb-2 opacity-50" />
            <p>How can I help you with our jewelry collection today?</p>
          </div>
        ) : (
          localMessages.map((msg, index) => (
            <div key={index} className={`mb-3 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
              <div className={`inline-block p-3 rounded-2xl max-w-[80%] ${
                msg.role === 'user' 
                  ? 'bg-amber-600 text-white rounded-br-none' 
                  : 'bg-white text-gray-800 rounded-bl-none border border-amber-200 shadow-sm'
              }`}>
                {msg.content}
                <div className={`text-xs mt-1 ${msg.role === 'user' ? 'text-amber-100' : 'text-amber-600'}`}>
                  {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          ))
        )}
        {isLoading && !streaming && (
          <div className="text-center text-amber-700 py-2">
            <div className="inline-flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2"></div>
              Thinking...
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-500 text-center p-2 bg-red-50 rounded-lg text-sm">
            {error}
            <button 
              onClick={() => {
                clearMessages();
                setLocalMessages([]);
              }}
              className="ml-2 text-red-700 font-bold"
            >
              ×
            </button>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-amber-200 bg-white rounded-b-2xl">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            disabled={isLoading}
            className="flex-1 p-3 border border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-amber-100"
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="bg-amber-500 text-white p-3 rounded-lg hover:bg-amber-600 disabled:bg-amber-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            title="Send message"
          >
            {isLoading && canCancel ? (
              <FaStop 
                className="cursor-pointer" 
                onClick={(e) => { 
                  e.preventDefault(); 
                  cancelRequest(); 
                }} 
              />
            ) : (
              <FaPaperPlane />
            )}
          </button>
        </div>
        {streaming && (
          <div className="text-xs text-amber-600 mt-2 text-center">
            Streaming responses enabled
          </div>
        )}
      </form>
    </div>
  );
};