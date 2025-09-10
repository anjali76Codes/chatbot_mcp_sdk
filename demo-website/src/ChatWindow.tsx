import React, { useState } from 'react';
import { useChatAgent } from './useChatAgent';
import { FaUserCircle, FaRobot, FaPaperPlane, FaRedo, FaComment, FaTimes } from 'react-icons/fa';

export const ChatWindow: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(false);
  const { messages, isLoading, error, sendMessage, clearMessages } = useChatAgent();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      sendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
  };

  // If chat is closed, show only the floating button
  if (!isChatOpen) {
    return (
      <button
        onClick={toggleChat}
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-500 text-white rounded-full shadow-lg flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-105 hover:shadow-xl"
        aria-label="Open chat"
      >
        <FaComment className="text-xl" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-purple-400 text-white text-xs rounded-full flex items-center justify-center">
          💬
        </span>
      </button>
    );
  }

  // If chat is open, show the full chat window
  return (
    <div className="fixed bottom-6 right-6 z-50 w-90 h-96 max-h-[80vh] bg-white rounded-xl shadow-xl flex flex-col font-sans overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-400 to-purple-500 text-white p-4 flex items-center justify-between rounded-t-xl">
        <div className="flex items-center gap-2">
          <FaRobot className="text-lg" />
          <h3 className="m-0 text-base font-medium">Jewelry Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="bg-white/20 border-none text-white cursor-pointer text-sm flex items-center gap-1 p-1 rounded-md transition-colors hover:bg-white/30"
            title="Clear chat"
          >
            <FaRedo className="text-xs" />
          </button>
          <button
            onClick={toggleChat}
            className="bg-white/20 border-none text-white cursor-pointer text-sm flex items-center p-1 rounded-md transition-colors hover:bg-white/30"
            title="Close chat"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <FaRobot className="text-3xl text-purple-300 mx-auto mb-2" />
            <p className="text-sm">Hi! I'm your jewelry assistant. Ask me about our products!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <FaRobot className="mr-2 text-purple-400 mt-1 flex-shrink-0" />
              )}
              <div
                className={`p-3 rounded-xl max-w-[80%] ${
                  msg.role === 'user'
                    ? 'bg-purple-500 text-white rounded-br-none'
                    : 'bg-white text-gray-700 rounded-bl-none border border-gray-200'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <FaUserCircle className="ml-2 text-purple-400 mt-1 flex-shrink-0" />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start justify-start">
            <FaRobot className="mr-2 text-purple-400 mt-1" />
            <div className="bg-white text-gray-700 p-3 rounded-xl rounded-bl-none border border-gray-200">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-400 text-center text-xs p-2 bg-red-50 rounded-lg border border-red-100">
            Error: {error}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-gray-100 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask about our jewelry..."
          disabled={isLoading}
          className="flex-1 p-2.5 rounded-lg border border-gray-200 outline-none focus:border-purple-400 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-gray-700 placeholder:text-gray-400 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="bg-purple-400 text-white rounded-lg w-9 h-9 flex items-center justify-center cursor-pointer transition-all transform hover:bg-purple-500 disabled:bg-gray-300 disabled:cursor-not-allowed"
          title="Send message"
        >
          <FaPaperPlane className="text-sm" />
        </button>
      </form>
    </div>
  );
};
