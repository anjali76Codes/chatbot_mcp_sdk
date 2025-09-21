
# LLM Backend with Model Context Protocol (MCP)

A powerful backend service that connects Large Language Models (LLMs) with Contentstack content via the Model Context Protocol. This service enables intelligent chat agents that can query and respond with relevant content from your Contentstack stack.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Contentstack account with API credentials
- LLM API key (Google, OpenAI, Anthropic, or Groq)

### Installation

1. **Navigate to the backend directory**
   ```bash
   cd llm-backend-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   PORT=3000
   CONTENTSTACK_API_KEY=your_api_key_here
   CONTENTSTACK_MANAGEMENT_TOKEN=your_management_token_here
   CONTENTSTACK_ENVIRONMENT=production
   CONTENTSTACK_REGION=us
   LLM_PROVIDER=google
   LLM_API_KEY=your_llm_api_key_here
   LLM_MODEL=gemini-2.5-flash
   LLM_TEMPERATURE=0.7
   ```

4. **Start the server**
   ```bash
   npm run dev
   ```
   Server runs at: `http://localhost:3000`

5. **Verify the server is running**
   ```bash
   curl http://localhost:3000/health
   ```

## 📁 Project Structure

```
llm-backend-mcp/
├── src/
│   ├── types/
│   │   ├── analytics.ts          # Analytics data types
│   │   └── contentstack.ts       # Contentstack interfaces
│   ├── analytics-tracker.ts      # Analytics tracking system
│   ├── chat-agent.ts             # Main chat agent logic
│   ├── dynamic-content-router.ts # Content routing system
│   ├── index.ts                  # Application entry point
│   ├── mcp-client.ts             # Contentstack MCP client
│   ├── server.ts                 # Express server setup
│   └── test-analytics.ts         # Analytics testing utilities
├── cache/
│   └── content_index.json        # Cached content index
├── package.json
└── tsconfig.json
```

## 🔌 API Endpoints

### Chat Endpoints

#### POST `/v1/chat`
Standard chat endpoint (non-streaming)

**Request:**
```json
{
  "message": "What tours are available for Italy?"
}
```

**Response:**
```json
{
  "response": "Based on our content, we have several Italy tours available...",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "responseTime": 1200
}
```

#### POST `/v1/chat/stream`
Streaming chat endpoint for real-time responses

**Request:**
```json
{
  "message": "What tours are available for Italy?"
}
```

**Response (SSE Stream):**
```
data: {"chunk": "Based"}
data: {"chunk": " on"}
data: {"chunk": " our"}
...
data: [DONE]
```

### Configuration Endpoint

#### GET `/v1/config`
Get current server configuration

**Response:**
```json
{
  "contentstack": {
    "apiKey": "your_api_key",
    "managementToken": "your_token",
    "environment": "production",
    "region": "us"
  },
  "llm": {
    "provider": "google",
    "model": "gemini-2.5-flash",
    "temperature": 0.7
  }
}
```

### Analytics Endpoints

#### GET `/api/analytics/overview`
Get comprehensive analytics overview

**Response:**
```json
{
  "totalQueries": 150,
  "averageResponseTime": 1.2,
  "successRate": 0.95,
  "popularQueries": [...],
  "contentTypePerformance": [...]
}
```

#### GET `/api/analytics/live-metrics`
Get real-time metrics

**Response:**
```json
{
  "queriesPerMinute": 12,
  "activeSessions": 8,
  "errorRate": 0.02,
  "uptime": "5h 23m"
}
```

#### GET `/api/analytics/popular-queries`
Get most frequent user queries

#### GET `/api/analytics/content-performance`
Get content type performance metrics

#### GET `/api/analytics/health`
Get analytics system health status

### Utility Endpoints

#### GET `/health`
Health check endpoint

**Response:**
```json
{
  "status": "OK",
  "chatAgentInitialized": true,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

#### POST `/v1/clear-cache`
Clear conversation cache

**Response:**
```json
{
  "status": "Cache cleared"
}
```

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | `3000` |
| `CONTENTSTACK_API_KEY` | Contentstack API Key | Yes | - |
| `CONTENTSTACK_MANAGEMENT_TOKEN` | Contentstack Management Token | Yes | - |
| `CONTENTSTACK_ENVIRONMENT` | Contentstack Environment | Yes | - |
| `CONTENTSTACK_REGION` | Contentstack Region (us/eu/azure-na) | Yes | `us` |
| `LLM_PROVIDER` | LLM Provider (google/openai/anthropic/groq) | Yes | `google` |
| `LLM_API_KEY` | LLM API Key | Yes | - |
| `LLM_MODEL` | LLM Model Name | No | Provider-specific default |
| `LLM_TEMPERATURE` | Creativity level (0.0-1.0) | No | `0.7` |

### Supported LLM Providers

- **Google**: Gemini models (gemini-2.5-flash, gemini-pro)
- **OpenAI**: GPT models (gpt-4o-mini, gpt-4)
- **Anthropic**: Claude models (claude-3-haiku, claude-3-sonnet)
- **Groq**: Llama models (llama-3.1-8b-instant)

## 🔧 How It Works

1. **User Query Processing**: Incoming messages are analyzed for intent and entities
2. **Content Retrieval**: Relevant content is fetched from Contentstack via MCP using management token
3. **LLM Integration**: The retrieved content is sent to the LLM for response generation
4. **Response Streaming**: Responses are streamed back to the client in real-time
5. **Analytics Tracking**: All interactions are tracked for insights and improvements

## 📊 Analytics Features

The backend includes comprehensive analytics tracking:

- Conversation metrics and statistics
- Response time monitoring
- Popular query tracking
- Content retrieval performance
- Error rate tracking
- Real-time live metrics

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```



## 🆘 Troubleshooting

### Common Issues

1. **Connection refused errors**
   - Verify Contentstack API credentials
   - Check management token permissions

2. **Content not found**
   - Ensure content types exist in Contentstack
   - Verify environment configuration

3. **LLM API errors**
   - Check API key validity
   - Verify quota limits

### Getting Help

- Check server logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure Contentstack content is published and accessible

## 📄 License

This project is licensed under the MIT License.
