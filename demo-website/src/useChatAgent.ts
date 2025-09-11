// // demo-website/src/useChatAgent.ts
// import { useState, useCallback } from 'react';
// import axios from 'axios';

// export interface ChatMessage {
//   role: 'user' | 'assistant';
//   content: string;
// }

// export const useChatAgent = (apiUrl: string = 'http://localhost:3000') => {
//   const [messages, setMessages] = useState<ChatMessage[]>([]);
//   const [isLoading, setIsLoading] = useState(false);
//   const [error, setError] = useState<string | null>(null);

//   const sendMessage = useCallback(async (userMessage: string) => {
//     // Add user message to UI immediately
//     setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
//     setIsLoading(true);
//     setError(null);

//     try {
//       // This is the crucial call to YOUR local API
//       const response = await axios.post(`${apiUrl}/v1/chat`, {
//         message: userMessage
//       });

//       const assistantResponse = response.data.response;

//       // Add AI response to the message history
//       setMessages(prev => [...prev, { role: 'assistant', content: assistantResponse }]);
      
//     } catch (err) {
//       const errorMessage = axios.isAxiosError(err) ? err.message : 'An unknown error occurred';
//       setError(errorMessage);
//       console.error('Error sending message:', err);
//     } finally {
//       setIsLoading(false);
//     }
//   }, [apiUrl]);

//   const clearMessages = useCallback(() => {
//     setMessages([]);
//     setError(null);
//   }, []);

//   return { messages, isLoading, error, sendMessage, clearMessages };
// };