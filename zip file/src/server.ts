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

    console.log('Fetching products from EU region...');

    // Try the CORRECT EU endpoint format
    const response = await fetch(
      `https://eu-api.contentstack.com/v3/content_types/product/entries?environment=${environment}`,
      {
        headers: {
          'api_key': apiKey,
          'access_token': deliveryToken,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Contentstack API response status:', response.status);

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Contentstack API error details:', errorData);
      throw new Error(`Contentstack API error: ${response.status} - ${errorData}`);
    }

    const data = await response.json();
    console.log(`✅ Success! Fetched ${data.entries?.length || 0} products`);
    
    res.json(data.entries || []);
    
  } catch (error) {
    console.error('Error in /api/products:', error);
    
    // Try US endpoint as fallback
    try {
      console.log('Trying US endpoint as fallback...');
      const usResponse = await fetch(
        `https://cdn.contentstack.io/v3/content_types/product/entries?environment=${process.env.CONTENTSTACK_ENVIRONMENT}`,
        {
          headers: {
            'api_key': process.env.CONTENTSTACK_API_KEY!,
            'access_token': process.env.CONTENTSTACK_DELIVERY_TOKEN!,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (usResponse.ok) {
        const data = await usResponse.json();
        console.log('✅ Success with US endpoint!');
        return res.json(data.entries || []);
      }
    } catch (fallbackError) {
      console.error('US endpoint also failed:', fallbackError);
    }

    res.status(500).json({ 
      error: 'Network error: Cannot connect to Contentstack. Check your internet connection.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});



// Define the main chat endpoint
app.post('/v1/chat', async (req, res) => {
  try {
    const { message, config } = req.body; // Accept config from request

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📨 Received message: ${message}`);

    let agent = chatAgent; // Use default agent

    // If config is provided, create a new agent instance with that config
    if (config) {
      console.log('🔄 Creating new chat agent with provided configuration');
      agent = new ContentstackChatAgent(config);
      await agent.initialize();
    }

    const response = await agent.sendMessage(message);
    
    // Send the response back as JSON
    res.json({ response });

  } catch (error) {
    console.error('❌ Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
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