import express from 'express';
import { StreamingContentstackChatAgent } from '../streaming-chat-agent.js';

const router = express.Router();

// Initialize agent instance
let streamingAgent: StreamingContentstackChatAgent;

// Async initialization
const initializeStreamingAgent = async (): Promise<void> => {
  try {
    streamingAgent = new StreamingContentstackChatAgent();
    await streamingAgent.initialize();
    console.log('✅ Streaming Chat Agent initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Streaming Chat Agent:', error);
  }
};

// Initialize on startup
initializeStreamingAgent();

// Define types for SSE events
interface SSEStatusEvent {
  type: 'thinking' | 'researching';
}

interface SSEMessageEvent {
  content: string;
}

interface SSEEndEvent {
  completed: boolean;
}

interface SSEErrorEvent {
  error: string;
}

// Fast detection for MCP needs
const needsMCPData = (message: string): boolean => {
  const lowerMessage = message.toLowerCase();
  
  // General chat patterns that don't need MCP
  const generalPatterns = [
    /^(hi|hello|hey|greetings)/i,
    /^(thanks|thank you)/i,
    /^(who are you|what can you do)/i,
    /^(bye|goodbye|exit|quit)/i,
    /^(help|support)/i,
    /^how are you/i
  ];
  
  if (generalPatterns.some(pattern => pattern.test(lowerMessage))) {
    return false;
  }
  
  // Patterns that likely need MCP data
  const mcpPatterns = [
    /(tour|product|item|article|blog|content|entry|asset|image|file|price|cost|detail|specification)/i,
    /(what|which|where|when|how|show me|find|search|get).*(tour|product|item|article|blog|content|entry)/i
  ];
  
  return mcpPatterns.some(pattern => pattern.test(lowerMessage));
};

// Streaming endpoint
router.post('/stream', async (req, res) => {
  const { message, conversationId } = req.body;
  
  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }
  
  console.log(`📨 Streaming request: ${message.substring(0, 50)}...`);
  
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  
  try {
    const requiresMCP = needsMCPData(message);
    
    // Send initial response immediately
    res.write(`event: status\ndata: ${JSON.stringify({ type: 'thinking' } as SSEStatusEvent)}\n\n`);
    
    if (requiresMCP) {
      res.write(`event: status\ndata: ${JSON.stringify({ type: 'researching' } as SSEStatusEvent)}\n\n`);
    }
    
    // Get the stream from the agent
    const stream = streamingAgent.sendMessageStream(message);
    
    // Stream the response
    for await (const chunk of stream) {
      res.write(`event: message\ndata: ${JSON.stringify({ content: chunk } as SSEMessageEvent)}\n\n`);
    }
    
    // End of stream
    res.write(`event: end\ndata: ${JSON.stringify({ completed: true } as SSEEndEvent)}\n\n`);
    
  } catch (error) {
    console.error('❌ Streaming error:', error);
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Failed to process message' } as SSEErrorEvent)}\n\n`);
    res.write(`event: end\ndata: ${JSON.stringify({ completed: false } as SSEEndEvent)}\n\n`);
  } finally {
    res.end();
  }
});

export default router;