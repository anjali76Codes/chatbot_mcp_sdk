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
        className="fixed bottom-6 right-6 z-50 w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-500 text-white rounded-full shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-300 transform hover:scale-110 hover:shadow-3xl"
        aria-label="Open chat"
      >
        <FaComment className="text-2xl" />
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center animate-pulse">
          💬
        </span>
      </button>
    );
  }

  // If chat is open, show the full chat window
  return (
    <div className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col font-sans overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FaRobot className="text-xl" />
          <h3 className="m-0 text-lg font-semibold">Jewelry Assistant</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearMessages}
            className="bg-transparent border-none text-white cursor-pointer text-sm flex items-center gap-1 transition-transform transform hover:scale-105 p-1"
            title="Clear chat"
          >
            <FaRedo className="text-sm" />
          </button>
          <button
            onClick={toggleChat}
            className="bg-transparent border-none text-white cursor-pointer text-lg flex items-center transition-transform transform hover:scale-110 p-1"
            title="Close chat"
          >
            <FaTimes />
          </button>
        </div>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <FaRobot className="text-4xl text-purple-400 mx-auto mb-2" />
            <p className="text-sm">Hi! I'm your jewelry assistant. Ask me about our products!</p>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div
              key={index}
              className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role !== 'user' && (
                <FaRobot className="mr-2 text-xl text-purple-600 mt-1 flex-shrink-0" />
              )}
              <div
                className={`p-3 rounded-2xl max-w-[80%] shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white rounded-br-none'
                    : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
                }`}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <FaUserCircle className="ml-2 text-xl text-blue-500 mt-1 flex-shrink-0" />
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start justify-start">
            <FaRobot className="mr-2 text-xl text-purple-600 mt-1" />
            <div className="bg-white text-gray-800 p-3 rounded-2xl rounded-bl-none border border-gray-200">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        {error && (
          <div className="text-red-500 text-center text-sm p-2 bg-red-50 rounded-lg">
            Error: {error}
          </div>
        )}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Ask about our jewelry..."
          disabled={isLoading}
          className="flex-1 p-3 rounded-full border border-gray-300 outline-none focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-black placeholder:text-gray-400 text-sm"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center cursor-pointer transition-all transform hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100"
          title="Send message"
        >
          <FaPaperPlane className="text-lg" />
        </button>
      </form>
    </div>
  );
};