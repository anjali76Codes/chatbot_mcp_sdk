// Storage service for persisting chat messages
const CHAT_STORAGE_KEY = 'contentstack_chat_history';

// Import the ChatMessage type from types to ensure consistency
import { ChatMessage as TypesChatMessage } from './types';

export interface StoredChat {
  id: string;
  timestamp: number;
  messages: TypesChatMessage[];
}

export const ChatStorage = {
  // Save chat messages to localStorage
  saveChat: (messages: TypesChatMessage[]): void => {
    try {
      const chatData: StoredChat = {
        id: 'current_session',
        timestamp: Date.now(),
        messages: messages.map(msg => ({
          ...msg,
          id: msg.id || Math.random().toString(36).substring(2, 9)
        }))
      };
      
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatData));
    } catch (error) {
      console.error('Failed to save chat to localStorage:', error);
      // Handle storage quota exceeded or other errors
    }
  },

  // Load chat messages from localStorage
  loadChat: (): TypesChatMessage[] => {
    try {
      const storedData = localStorage.getItem(CHAT_STORAGE_KEY);
      if (!storedData) return [];
      
      const chatData: StoredChat = JSON.parse(storedData);
      
      // Convert timestamp strings back to Date objects
      return chatData.messages.map(msg => ({
        ...msg,
        timestamp: new Date(msg.timestamp)
      }));
    } catch (error) {
      console.error('Failed to load chat from localStorage:', error);
      return [];
    }
  },

  // Clear chat history from localStorage
  clearChat: (): void => {
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear chat from localStorage:', error);
    }
  },

  // Check if chat history exists
  hasChatHistory: (): boolean => {
    return localStorage.getItem(CHAT_STORAGE_KEY) !== null;
  }
};