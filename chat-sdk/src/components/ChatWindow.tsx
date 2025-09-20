import React, { useState, useRef, useEffect } from 'react';
import { useChatAgent } from '../hooks/useChatAgent';
import { ChatMessage, SendMessageOptions, StreamingChunk } from '../types';
import { FaPaperPlane, FaRedo, FaTimes, FaStop, FaGem, FaCrown, FaRing, FaSpinner, FaMinus, FaExpand, FaCompress, FaUser, FaRobot } from 'react-icons/fa';

interface ChatWindowProps {
  apiBaseUrl: string;
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
  apiBaseUrl, 
  title = "Jewelry Assistant",
  position = "bottom-right",
  showHeader = true,
  streaming = false,
  className = "",
  placeholder = "Ask about our jewelry collection...",
  showResetButton = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [inputMessage, setInputMessage] = useState('');
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  const { 
    messages, 
    isLoading, 
    error, 
    isInitializing,
    sendMessage, 
    sendMessageStream,
    clearMessages, 
    cancelRequest,
    canCancel,
    hasChatHistory
  } = useChatAgent(apiBaseUrl);

  // Update local messages when the hook messages change
  useEffect(() => {
    setLocalMessages(messages);
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isMinimized) {
      scrollToBottom();
    }
  }, [localMessages, isMinimized]);

  useEffect(() => {
    if (isOpen && inputRef.current && !isMinimized) {
      inputRef.current.focus();
    }
  }, [isOpen, isMinimized]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading && !isInitializing) {
      // Add user message immediately to UI
      const userMessage: ChatMessage = {
        role: 'user',
        content: inputMessage.trim(),
        timestamp: new Date()
      };
      
      setLocalMessages(prev => [...prev, userMessage]);
      setInputMessage('');
      
      try {
        if (streaming) {
          // Use streaming method
          await sendMessageStream(inputMessage.trim(), {
            onChunk: (chunk: StreamingChunk) => {
              if (chunk.done) {
                // Streaming completed
                return;
              }
              
              // Update the last assistant message with the streaming content
              setLocalMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                
                if (lastMessage.role === 'assistant') {
                  // Update existing assistant message
                  newMessages[newMessages.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + chunk.content
                  };
                } else {
                  // Create new assistant message
                  newMessages.push({
                    role: 'assistant',
                    content: chunk.content,
                    timestamp: new Date(),
                    isStreaming: true
                  });
                }
                return newMessages;
              });
            }
          });

          // Remove streaming flag when done
          setLocalMessages(prev => prev.map(msg => ({
            ...msg,
            isStreaming: false
          })));

        } else {
          // Use regular non-streaming method
          await sendMessage(inputMessage.trim());
        }
      } catch (error) {
        if (!isAbortError(error)) {
          console.error('Failed to send message:', error);
          // Add error message to UI
          const errorMessage: ChatMessage = {
            role: 'assistant',
            content: 'Sorry, I encountered an error. Please try again.',
            timestamp: new Date()
          };
          setLocalMessages(prev => [...prev, errorMessage]);
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

  const toggleMinimize = () => {
    setIsMinimized(!isMinimized);
    if (isMaximized) {
      setIsMaximized(false);
    }
  };

  const toggleMaximize = () => {
    setIsMaximized(!isMaximized);
    if (isMinimized) {
      setIsMinimized(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setIsMinimized(false);
    setIsMaximized(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed z-50 w-16 h-16 bg-gradient-to-r from-amber-500 to-amber-700 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-110 hover:shadow-3xl ${
          position === 'bottom-right' ? 'bottom-6 right-6' :
          position === 'bottom-left' ? 'bottom-6 left-6' :
          position === 'top-right' ? 'top-6 right-6' : 'top-6 left-6'
        }`}
        aria-label="Open chat"
      >
        <div className="relative">
          <FaGem className="text-2xl" />
          <FaCrown className="absolute -top-2 -right-2 text-yellow-300 text-xs" />
        </div>
        {hasChatHistory && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            !
          </span>
        )}
      </button>
    );
  }

  return (
    <div 
      ref={chatContainerRef}
      className={`fixed z-50 transition-all duration-300 font-sans ${
        isMaximized 
          ? 'inset-5 m-0' 
          : isMinimized 
            ? 'w-64 h-16' 
            : 'w-96 h-[500px]'
      } ${
        !isMaximized && (
          position === 'bottom-right' ? 'bottom-6 right-6' :
          position === 'bottom-left' ? 'bottom-6 left-6' :
          position === 'top-right' ? 'top-6 right-6' : 'top-6 left-6'
        )
      }`}
    >
      {isMinimized ? (
        // Minimized state - just the header bar
        <div className="bg-gradient-to-r from-amber-500 to-amber-700 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between border-2 border-amber-300">
          <div className="flex items-center gap-2">
            <div className="relative">
              <FaGem className="text-lg text-yellow-200" />
              <FaCrown className="absolute -top-1 -right-1 text-yellow-300 text-xs" />
            </div>
            <h3 className="font-semibold text-sm">{title}</h3>
            {hasChatHistory && (
              <span className="bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center animate-pulse">
                !
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleMaximize}
              className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
              title="Maximize chat"
            >
              <FaExpand className="text-sm" />
            </button>
            <button 
              onClick={toggleMinimize}
              className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
              title="Restore chat"
            >
              <FaMinus className="text-sm" />
            </button>
            <button 
              onClick={handleClose}
              className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
              title="Close chat"
            >
              <FaTimes className="text-sm" />
            </button>
          </div>
        </div>
      ) : (
        // Expanded state - full chat window
        <div className={`bg-gradient-to-b from-amber-50 to-white rounded-2xl shadow-2xl flex flex-col border-2 border-amber-300 overflow-hidden h-full ${className}`}>
          {showHeader && (
            <div className="bg-gradient-to-r from-amber-500 to-amber-700 text-white p-4 flex items-center justify-between rounded-t-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-full opacity-10">
                <div className="absolute top-2 left-10"><FaGem /></div>
                <div className="absolute top-6 right-16"><FaRing /></div>
                <div className="absolute bottom-4 left-20"><FaGem /></div>
              </div>
              <h3 className="font-bold text-lg flex items-center gap-2 relative z-10">
                <div className="relative">
                  <FaGem className="text-xl text-yellow-200" />
                  <FaCrown className="absolute -top-1 -right-1 text-yellow-300 text-xs" />
                </div>
                {title}
              </h3>
              <div className="flex items-center gap-2 relative z-10">
                {showResetButton && (
                  <button 
                    onClick={() => {
                      clearMessages();
                      setLocalMessages([]);
                    }} 
                    className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
                    title="Clear conversation"
                  >
                    <FaRedo />
                  </button>
                )}
                <button 
                  onClick={toggleMaximize}
                  className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
                  title={isMaximized ? "Restore chat" : "Maximize chat"}
                >
                  {isMaximized ? <FaCompress /> : <FaExpand />}
                </button>
                <button 
                  onClick={toggleMinimize}
                  className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
                  title="Minimize chat"
                >
                  <FaMinus />
                </button>
                <button 
                  onClick={handleClose}
                  className="text-white hover:text-yellow-200 transition-colors p-1 rounded-full hover:bg-amber-600"
                  title="Close chat"
                >
                  <FaTimes />
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 bg-gradient-to-b from-amber-50 to-white">
            {isInitializing ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FaSpinner className="animate-spin text-amber-600 text-3xl mx-auto mb-3" />
                  <p className="text-amber-700 font-medium">Initializing chat agent...</p>
                </div>
              </div>
            ) : localMessages.length === 0 ? (
              <div className="text-center text-amber-800 py-8">
                <div className="relative inline-block mb-4">
                  <FaGem className="text-4xl mx-auto opacity-50 text-amber-500" />
                  <FaRing className="absolute -bottom-1 -right-2 text-amber-600 text-xl" />
                </div>
                <p className="font-bold text-xl mb-2">Welcome to our Jewelry Assistant!</p>
                <p className="text-sm font-medium text-amber-600 mb-6">How can I help you with our exquisite collection today?</p>
                <div className="mt-6 text-left text-sm font-medium text-amber-800 bg-amber-100 p-4 rounded-xl inline-block border border-amber-200 shadow-sm">
                  <p className="font-bold mb-2">Try asking:</p>
                  <ul className="list-disc list-inside space-y-1 text-xs">
                    <li>What diamond rings do you have?</li>
                    <li>Show me gold necklaces</li>
                    <li>What's special about your collection?</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {localMessages.map((msg, index) => (
                  <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`flex max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-2`}>
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        msg.role === 'user' 
                          ? 'bg-amber-600 text-white' 
                          : 'bg-amber-200 text-amber-800'
                      }`}>
                        {msg.role === 'user' ? <FaUser size={14} /> : <FaRobot size={16} />}
                      </div>
                      <div className={`rounded-2xl p-4 relative ${
                        msg.role === 'user' 
                          ? 'bg-gradient-to-r from-amber-600 to-amber-700 text-white rounded-br-none shadow-md' 
                          : 'bg-white text-gray-800 rounded-bl-none border border-amber-100 shadow-sm'
                      }`}>
                        {msg.role === 'assistant' && (
                          <div className="absolute -left-2 top-3 w-3 h-3 bg-amber-500 rounded-full border-2 border-white"></div>
                        )}
                        <div className={`font-medium ${msg.role === 'user' ? 'text-white' : 'text-gray-800'}`}>
                          {msg.content}
                        </div>
                        {msg.isStreaming && (
                          <span className="inline-block w-2 h-4 bg-amber-400 ml-1 animate-pulse rounded-sm"></span>
                        )}
                        <div className={`text-xs mt-2 ${msg.role === 'user' ? 'text-amber-100' : 'text-amber-600'}`}>
                          {msg.timestamp?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isLoading && !streaming && (
              <div className="text-center text-amber-700 py-2">
                <div className="inline-flex items-center bg-amber-100 px-3 py-2 rounded-full border border-amber-200">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-600 mr-2"></div>
                  <span className="font-medium">Thinking...</span>
                </div>
              </div>
            )}
            {error && (
              <div className="text-red-500 text-center p-3 bg-red-50 rounded-lg text-sm border-2 border-red-200">
                <span className="font-medium">{error}</span>
                <button 
                  onClick={() => {
                    clearMessages();
                    setLocalMessages([]);
                  }}
                  className="ml-2 text-red-700 font-medium bg-red-100 px-2 py-1 rounded"
                >
                  ×
                </button>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <form onSubmit={handleSubmit} className="p-4 border-t-2 border-amber-200 bg-white rounded-b-2xl">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={placeholder}
                disabled={isLoading || isInitializing}
                className="flex-1 p-3 border-2 border-amber-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:bg-amber-100 bg-amber-50 font-medium placeholder-amber-400"
              />
              <button
                type="submit"
                disabled={isLoading || isInitializing || !inputMessage.trim()}
                className="bg-gradient-to-r from-amber-500 to-amber-600 text-white p-3 rounded-lg hover:from-amber-600 hover:to-amber-700 disabled:from-amber-300 disabled:to-amber-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center shadow-md hover:shadow-lg font-bold"
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
              <div className="text-xs text-amber-600 mt-2 text-center flex items-center justify-center font-medium">
                <span className="inline-block w-2 h-2 bg-amber-500 rounded-full mr-1 animate-pulse"></span>
                Streaming responses enabled
              </div>
            )}
          </form>
        </div>
      )}
    </div>
  );
};