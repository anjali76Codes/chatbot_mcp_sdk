// src/server.ts
import express from 'express';
import { ContentstackChatAgent } from './chat-agent.js';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// dotenv
if (process.env.NODE_ENV !== 'production') {
  import('dotenv').then(dotenv => dotenv.config());
}

// Initialize chat agent instance
let chatAgent: ContentstackChatAgent;

// Helper functions
function getProviderApiKey(provider?: string): string {
  if (!provider) return process.env.GOOGLE_API_KEY || '';
  
  const envVars = {
    openai: process.env.OPENAI_API_KEY,
    anthropic: process.env.ANTHROPIC_API_KEY,
    groq: process.env.GROQ_API_KEY,
    google: process.env.GOOGLE_API_KEY
  };
  
  return envVars[provider as keyof typeof envVars] || '';
}

function getDefaultModel(provider: string): string {
  const defaultModels = {
    openai: 'gpt-4o-mini',
    anthropic: 'claude-3-haiku-20240307',
    groq: 'llama-3.1-8b-instant',
    google: 'gemini-2.5-flash'
  };
  return defaultModels[provider as keyof typeof defaultModels] || 'gemini-2.5-flash';
}

// Async initialization function
const initializeServer = async () => {
  try {
    const provider = process.env.LLM_PROVIDER || 'google';
    const apiKey = process.env.LLM_API_KEY || getProviderApiKey(provider);
    const model = process.env.LLM_MODEL || getDefaultModel(provider);

    chatAgent = new ContentstackChatAgent({
      contentstack: {
        apiKey: process.env.CONTENTSTACK_API_KEY,
        managementToken: process.env.CONTENTSTACK_MANAGEMENT_TOKEN,
        environment: process.env.CONTENTSTACK_ENVIRONMENT,
        region: process.env.CONTENTSTACK_REGION || 'eu'
      },
      llm: {
        provider: provider as 'google' | 'openai' | 'anthropic' | 'groq',
        apiKey: apiKey,
        model: model,
        temperature: parseFloat(process.env.LLM_TEMPERATURE || "0.7")
      }
    });

    await chatAgent.initialize();
    console.log('✅ Chat Agent initialized successfully with configuration');
  } catch (error) {
    console.error('❌ Failed to initialize Chat Agent:', error);
    process.exit(1);
  }
};

// Chat endpoint (non-streaming)
app.post('/v1/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    console.log(`📨 Received message: ${message}`);

    const startTime = Date.now();
    const response = await chatAgent.sendMessage(message, []);
    const responseTime = Date.now() - startTime;

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

// Chat endpoint (streaming)
app.post('/v1/chat/stream', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const stream = await chatAgent.sendMessageStream(message, []);

    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    console.error('Stream error:', error);
    res.status(500).end();
  }
});

// Config endpoint
app.get('/v1/config', (req, res) => {
  try {
    const validProviders = ['google', 'openai', 'anthropic', 'groq'];
    const provider = process.env.LLM_PROVIDER || 'google';
    
    if (!validProviders.includes(provider)) {
      throw new Error(`Invalid LLM provider: ${provider}`);
    }

    const config = {
      contentstack: {
        apiKey: process.env.CONTENTSTACK_API_KEY,
        managementToken: process.env.CONTENTSTACK_MANAGEMENT_TOKEN,
        environment: process.env.CONTENTSTACK_ENVIRONMENT,
        region: process.env.CONTENTSTACK_REGION || 'eu'
      },
      llm: {
        provider: provider as 'google' | 'openai' | 'anthropic' | 'groq',
        apiKey: process.env.LLM_API_KEY || getProviderApiKey(provider),
        model: process.env.LLM_MODEL || getDefaultModel(provider),
        temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7')
      }
    };

    if (!config.contentstack.apiKey || !config.contentstack.managementToken || !config.contentstack.environment) {
      throw new Error('Contentstack configuration is incomplete');
    }
    if (!config.llm.apiKey) {
      throw new Error('LLM API key is required');
    }

    res.json(config);
  } catch (error) {
    console.error('❌ Error in /config endpoint:', error);
    res.status(500).json({
      error: 'Failed to load configuration',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    chatAgentInitialized: !!chatAgent,
    endpoints: {
      chat: '/v1/chat',
      chatStream: '/v1/chat/stream',
      health: '/health',
      clearCache: '/v1/clear-cache'
    },
    timestamp: new Date().toISOString()
  });
});

// Clear cache
app.post('/v1/clear-cache', (req, res) => {
  if (chatAgent) {
    chatAgent.clearConversationHistory();
    console.log('🗑️ Cache cleared via API');
  }
  res.json({ status: 'Cache cleared' });
});







// Analytics endpoints
app.get('/api/analytics/overview', (req, res) => {
  try {
    if (!chatAgent) {
      return res.status(503).json({ error: 'Chat agent not initialized' });
    }
    
    const snapshot = chatAgent.getAnalyticsSnapshot();
    res.json(snapshot);
  } catch (error) {
    console.error('❌ Error fetching analytics overview:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

app.get('/api/analytics/live-metrics', (req, res) => {
  try {
    if (!chatAgent) {
      return res.status(503).json({ error: 'Chat agent not initialized' });
    }
    
    const liveMetrics = chatAgent.getLiveMetrics();
    res.json(liveMetrics);
  } catch (error) {
    console.error('❌ Error fetching live metrics:', error);
    res.status(500).json({ error: 'Failed to fetch live metrics' });
  }
});

app.get('/api/analytics/popular-queries', (req, res) => {
  try {
    if (!chatAgent) {
      return res.status(503).json({ error: 'Chat agent not initialized' });
    }
    
    const snapshot = chatAgent.getAnalyticsSnapshot();
    res.json(snapshot.popularQueries);
  } catch (error) {
    console.error('❌ Error fetching popular queries:', error);
    res.status(500).json({ error: 'Failed to fetch popular queries' });
  }
});

app.get('/api/analytics/content-performance', (req, res) => {
  try {
    if (!chatAgent) {
      return res.status(503).json({ error: 'Chat agent not initialized' });
    }
    
    const snapshot = chatAgent.getAnalyticsSnapshot();
    res.json(snapshot.contentTypePerformance);
  } catch (error) {
    console.error('❌ Error fetching content performance:', error);
    res.status(500).json({ error: 'Failed to fetch content performance' });
  }
});

app.get('/api/analytics/health', (req, res) => {
  try {
    if (!chatAgent) {
      return res.status(503).json({ 
        status: 'unhealthy', 
        message: 'Chat agent not initialized' 
      });
    }
    
    const snapshot = chatAgent.getAnalyticsSnapshot();
    const liveMetrics = chatAgent.getLiveMetrics();
    
    res.json({
      status: 'healthy',
      totalQueries: snapshot.totalQueries,
      queriesPerMinute: liveMetrics.queriesPerMinute,
      activeSessions: liveMetrics.activeSessions,
      errorRate: liveMetrics.errorRate
    });
  } catch (error) {
    console.error('❌ Error in health check:', error);
    res.status(500).json({ 
      status: 'unhealthy', 
      message: 'Internal server error' 
    });
  }
});

// Reset analytics (optional - for testing)
app.post('/api/analytics/reset', (req, res) => {
  try {
    if (!chatAgent) {
      return res.status(503).json({ error: 'Chat agent not initialized' });
    }
    
    // This would require adding a reset method to your analytics tracker
    // chatAgent.resetAnalytics();
    res.json({ message: 'Analytics reset would occur here' });
  } catch (error) {
    console.error('❌ Error resetting analytics:', error);
    res.status(500).json({ error: 'Failed to reset analytics' });
  }
});




// Start server
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