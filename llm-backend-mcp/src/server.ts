// src/server.ts
import express from 'express';
import { ContentstackChatAgent } from './chat-agent.js';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize chat agent instance
let chatAgent: ContentstackChatAgent;

// Async initialization function
const initializeServer = async () => {
  try {
    chatAgent = new ContentstackChatAgent({
      contentstack: {
        apiKey: process.env.CONTENTSTACK_API_KEY,
        deliveryToken: process.env.CONTENTSTACK_DELIVERY_TOKEN,
        environment: process.env.CONTENTSTACK_ENVIRONMENT,
        region: 'eu'
      },
      llm: {
        provider: 'google',
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-2.5-flash',
        temperature: 0.7
      }
    });
    
    await chatAgent.initialize();
    console.log('✅ Chat Agent initialized successfully with configuration');
  } catch (error) {
    console.error('❌ Failed to initialize Chat Agent:', error);
    process.exit(1);
  }
};

// SIMPLIFIED chat endpoint - no conversation history, no session management
app.post('/v1/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📨 Received message: ${message}`);

    const startTime = Date.now();
    
    // Use the globally initialized chat agent
    // Pass empty history to mimic CLI behavior
    const response = await chatAgent.sendMessage(message, []);

    const responseTime = Date.now() - startTime;
    console.log(`⚡ Response time: ${responseTime}ms`);

    // Send the response back - simplified response without conversation ID
    res.json({ 
      response,
      timestamp: new Date().toISOString(),
      responseTime
    });

  } catch (error) {
    console.error('❌ Error in /chat endpoint:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    chatAgentInitialized: !!chatAgent,
    timestamp: new Date().toISOString()
  });
});

// Clear cache endpoint (optional)
app.post('/v1/clear-cache', (req, res) => {
  if (chatAgent) {
    chatAgent.clearConversationHistory();
    console.log('🗑️ Cache cleared via API');
  }
  res.json({ status: 'Cache cleared' });
});

// Initialize and start the server
initializeServer().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Model API server running on http://localhost:${port}`);
    console.log(`✅ Health check available at http://localhost:${port}/health`);
    console.log(`💬 Chat endpoint: POST http://localhost:${port}/v1/chat`);
  });
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});