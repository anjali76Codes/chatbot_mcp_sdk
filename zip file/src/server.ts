// src/server.ts
import express from 'express';
import { ContentstackChatAgent } from './chat-agent.js';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors()); // Enable Cross-Origin Requests
app.use(express.json()); // Parse JSON bodies

// Initialize a single chat agent instance for the server
const chatAgent = new ContentstackChatAgent();
await chatAgent.initialize(); // Make sure to await initialization

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