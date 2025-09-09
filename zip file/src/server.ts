// src/server.ts
import express from 'express';
import { ContentstackChatAgent } from './chat-agent.js';
import cors from 'cors';
import { Stack } from '@contentstack/delivery-sdk';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable Cross-Origin Requests
app.use(express.json()); // Parse JSON bodies

// Initialize a single chat agent instance for the server
const chatAgent = new ContentstackChatAgent();
await chatAgent.initialize(); // Make sure to await initialization









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
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // TODO: Here, you need to integrate your existing logic.
    // Instead of using a fixed history from the request,
    // you'll need to manage state per user/session.
    // For now, this is a simple implementation.

    console.log(`📨 Received message: ${message}`);

    // This is the key line: use your existing sendMessage method
    const response = await chatAgent.sendMessage(message);

    // Send the response back as JSON
    res.json({ response });

  } catch (error) {
    console.error('❌ Error in /chat endpoint:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`🚀 Model API server running on http://localhost:${port}`);
});