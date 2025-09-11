// src/server.ts
import express from 'express';
import { ContentstackChatAgent } from './chat-agent.js';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable Cross-Origin Requests
app.use(express.json()); // Parse JSON bodies

// Initialize chat agent instance
let chatAgent: ContentstackChatAgent;

// Define ChatMessage type
type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};


// Async initialization function
const initializeServer = async () => {
  try {
    // Now chatAgent accepts configuration
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
        model: 'gemini-1.5-flash',
        temperature: 0.3
      }
    });
    
    await chatAgent.initialize();
    console.log('✅ Chat Agent initialized successfully with configuration');
  } catch (error) {
    console.error('❌ Failed to initialize Chat Agent:', error);
    process.exit(1);
  }
};

app.get('/api/products', async (req, res) => {
  try {
    const apiKey = process.env.CONTENTSTACK_API_KEY;
    const deliveryToken = process.env.CONTENTSTACK_DELIVERY_TOKEN;
    const environment = process.env.CONTENTSTACK_ENVIRONMENT;

    if (!apiKey || !deliveryToken || !environment) {
      return res.status(500).json({ error: 'Contentstack configuration missing' });
    }

    // Get pagination parameters from query string
    const limit = parseInt(req.query.limit as string) || 100; // Default to 100
    const skip = parseInt(req.query.skip as string) || 0;

    console.log(`Fetching ${limit} products starting from ${skip}...`);

    const response = await fetch(
      `https://eu-api.contentstack.com/v3/content_types/product/entries?environment=${environment}&limit=${limit}&skip=${skip}`,
      {
        headers: {
          'api_key': apiKey,
          'access_token': deliveryToken,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Contentstack API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    
    // Return both entries and total count
    res.json({
      entries: data.entries || [],
      total: data.entries?.length || 0,
      skip: skip,
      limit: limit,
      hasMore: data.entries?.length === limit // Indicate if more entries exist
    });
    
  } catch (error) {
    console.error('Error in /api/products:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



// Add conversation storage (in-memory for now, use Redis in production)
const conversationSessions = new Map<string, {
  history: ChatMessage[];
  createdAt: Date;
  lastAccessed: Date;
}>();

// Define the main chat endpoint with conversation support
app.post('/v1/chat', async (req, res) => {
  try {
    const { 
      message, 
      config, 
      conversationId: providedConversationId, 
      resetConversation = false 
    } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📨 Received message: ${message}`, { 
      conversationId: providedConversationId, 
      resetConversation 
    });

    let agent = chatAgent; // Use default agent
    let conversationHistory: ChatMessage[] = [];

    // If config is provided, create a new agent instance with that config
    if (config) {
      console.log('🔄 Creating new chat agent with provided configuration');
      agent = new ContentstackChatAgent(config);
      await agent.initialize();
    }

    // Handle conversation state
    let conversationId = providedConversationId;
    
    if (resetConversation && conversationId) {
      // Clear existing conversation
      conversationSessions.delete(conversationId);
      conversationId = undefined;
    }

    if (conversationId && conversationSessions.has(conversationId)) {
      // Continue existing conversation
      const session = conversationSessions.get(conversationId)!;
      session.lastAccessed = new Date();
      conversationHistory = session.history;
      console.log(`↩️ Continuing conversation ${conversationId} with ${conversationHistory.length} messages`);
    } else if (!conversationId) {
      // Start new conversation
      conversationId = generateConversationId();
      conversationSessions.set(conversationId, {
        history: [],
        createdAt: new Date(),
        lastAccessed: new Date()
      });
      console.log(`🆕 Started new conversation: ${conversationId}`);
    }

    // Add current message to history safely
    const userMessage: ChatMessage = { role: 'user', content: message };
    let session = conversationSessions.get(conversationId!);
    if (!session) {
      session = {
        history: [userMessage],
        createdAt: new Date(),
        lastAccessed: new Date()
      };
      conversationSessions.set(conversationId!, session);
    } else {
      session.history.push(userMessage);
      session.lastAccessed = new Date();
    }
    conversationHistory = session.history;

    // Use your existing sendMessage method (modified to accept history)
    const response = await agent.sendMessage(message, conversationHistory);

    // Add assistant response safely
    const assistantMessage: ChatMessage = { role: 'assistant', content: response };
    session = conversationSessions.get(conversationId!);
    if (session) {
      session.history.push(assistantMessage);
      session.lastAccessed = new Date();
    }

    // Clean up old conversations
    cleanupOldConversations();

    // Send the response back with conversation ID
    res.json({ 
      response,
      conversationId,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to generate conversation ID
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Clean up conversations older than 24 hours
function cleanupOldConversations() {
  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - (24 * 60 * 60 * 1000));
  
  for (const [conversationId, session] of conversationSessions.entries()) {
    if (session.lastAccessed < twentyFourHoursAgo) {
      conversationSessions.delete(conversationId);
      console.log(`🧹 Cleaned up old conversation: ${conversationId}`);
    }
  }
}

// Add conversation management endpoint
app.get('/v1/conversations/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  const session = conversationSessions.get(conversationId);
  
  if (!session) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json({
    conversationId,
    messageCount: session.history.length,
    createdAt: session.createdAt,
    lastAccessed: session.lastAccessed,
    history: session.history
  });
});

app.delete('/v1/conversations/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  
  if (conversationSessions.delete(conversationId)) {
    res.json({ success: true, message: 'Conversation deleted' });
  } else {
    res.status(404).json({ error: 'Conversation not found' });
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

// Initialize and start the server
initializeServer().then(() => {
  app.listen(port, () => {
    console.log(`🚀 Model API server running on http://localhost:${port}`);
    console.log(`✅ Health check available at http://localhost:${port}/health`);
  });
}).catch(error => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});