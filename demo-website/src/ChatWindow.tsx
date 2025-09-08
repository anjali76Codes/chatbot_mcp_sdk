import React, { useState } from 'react';
import { useChatAgent } from './useChatAgent';
import { FaUserCircle, FaRobot, FaPaperPlane, FaRedo } from 'react-icons/fa';

export const ChatWindow: React.FC = () => {
  const [inputMessage, setInputMessage] = useState('');
  const { messages, isLoading, error, sendMessage, clearMessages } = useChatAgent();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMessage.trim() && !isLoading) {
      sendMessage(inputMessage.trim());
      setInputMessage('');
    }
  };

  return (
    <div className="w-[640px] h-[70vh] max-h-[800px] mx-auto bg-white rounded-2xl shadow-xl flex flex-col font-sans overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-500 text-white p-4 flex items-center justify-between">
        <h3 className="m-0 text-xl font-semibold">Contentstack Chat Agent</h3>
        <button
          onClick={clearMessages}
          className="bg-transparent border-none text-white cursor-pointer text-sm flex items-center gap-1 transition-transform transform hover:scale-105"
        >
          <FaRedo className="text-sm" /> Clear
        </button>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-gray-50">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`flex items-start ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role !== 'user' && <FaRobot className="mr-2 text-xl text-purple-600" />}
            <div
              className={`p-3 rounded-2xl max-w-[80%] shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-white text-gray-800 rounded-bl-none border border-gray-200'
              }`}
            >
              {msg.content}
            </div>
            {msg.role === 'user' && <FaUserCircle className="ml-2 text-xl text-blue-500" />}
          </div>
        ))}
        {isLoading && (
          <div className="text-gray-500 italic text-center">
            <span className="animate-pulse">🤖 Thinking...</span>
          </div>
        )}
        {error && <div className="text-red-500 text-center">Error: {error}</div>}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-gray-200 flex items-center gap-2 bg-white">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
          className="flex-1 p-3 rounded-full border border-gray-300 outline-none focus:border-blue-500 transition-colors disabled:bg-gray-100 disabled:cursor-not-allowed text-black placeholder:text-gray-400"
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center cursor-pointer transition-all transform hover:scale-110 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:scale-100"
        >
          <FaPaperPlane className="text-xl" />
        </button>
      </form>
    </div>
  );
};