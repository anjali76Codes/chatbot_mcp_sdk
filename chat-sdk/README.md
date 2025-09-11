
```markdown
# Angupta Chat SDK

A plug-and-play React SDK for embedding AI-powered chat agents that connect to your Contentstack content. Build custom chat experiences in minutes, not days.
```
## Features

- 🤖 **AI-Powered**: Integrates with major LLM providers (OpenAI, Anthropic, Google, Azure)
- 📦 **Plug & Play**: Embed with just a few lines of code
- 🔌 **Contentstack Integration**: Automatically queries your Contentstack content
- ⚡ **Streaming Support**: Real-time response streaming
- 🎨 **Customizable**: Flexible UI and configuration options
- 🛡️ **TypeSafe**: Full TypeScript support
- 📱 **Responsive**: Works on all devices

## Installation

```bash
npm install angupta-chat-sdk
# or
yarn add angupta-chat-sdk
```

## Quick Start

```typescript
import React from 'react';
import { ChatWindow } from 'angupta-chat-sdk'; // ← FIXED IMPORT

const App = () => {
  const config = {
    apiBaseUrl: 'https://your-backend-api.com',
    contentstack: {
      apiKey: 'your-contentstack-api-key',
      deliveryToken: 'your-delivery-token',
      environment: 'production',
      region: 'us' // optional
    },
    llm: {
      provider: 'openai',
      apiKey: 'your-llm-api-key',
      model: 'gpt-4',
      temperature: 0.7
    }
  };

  return (
    <div>
      <h1>My Website</h1>
      <ChatWindow config={config} />
    </div>
  );
};

export default App;
```

## Configuration

### ChatConfig Object

```typescript
interface ChatConfig {
  apiBaseUrl: string;          // Your backend API URL
  contentstack: {
    apiKey: string;           // Contentstack API Key
    deliveryToken: string;    // Contentstack Delivery Token
    environment: string;      // Contentstack Environment
    region?: string;          // Optional: 'us' or 'eu'
  };
  llm: {
    provider: 'openai' | 'anthropic' | 'google' | 'azure' | 'custom';
    apiKey: string;           // LLM Provider API Key
    model?: string;           // Model name (e.g., 'gpt-4')
    temperature?: number;     // 0-1, default: 0.7
    maxTokens?: number;       // Maximum response tokens
  };
}
```

### Component Props

```typescript
<ChatWindow
  config={chatConfig}         // Required: Configuration object
  title="AI Assistant"        // Optional: Chat window title
  position="bottom-right"     // Optional: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
  streaming={true}           // Optional: Enable streaming responses
  showHeader={true}          // Optional: Show/hide header
  placeholder="Ask me anything..." // Optional: Input placeholder
  showResetButton={true}     // Optional: Show clear conversation button
  className="custom-class"   // Optional: Additional CSS class
/>
```

## Hook Usage

For more control, use the `useChatAgent` hook directly:

```typescript
import React from 'react';
import { useChatAgent } from 'angupta-chat-sdk'; // ← FIXED IMPORT

const CustomChat = () => {
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    conversationId
  } = useChatAgent(config);

  const handleSend = async () => {
    try {
      const response = await sendMessage('Hello!', {
        stream: true,
        onChunk: (chunk) => console.log('Received:', chunk)
      });
      console.log('Complete response:', response);
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <div>
      {/* Your custom chat UI */}
      <button onClick={handleSend} disabled={isLoading}>
        Send Message
      </button>
    </div>
  );
};
```

## API Reference

### useChatAgent Hook

Returns an object with:

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `ChatMessage[]` | Array of chat messages |
| `isLoading` | `boolean` | True when request is in progress |
| `error` | `string \| null` | Error message if any |
| `conversationId` | `string` | Current conversation ID |
| `sendMessage` | `(message: string, options?) => Promise<SendMessageResponse>` | Send a message |
| `clearMessages` | `() => void` | Clear all messages and errors |
| `cancelRequest` | `() => void` | Cancel ongoing request |
| `canCancel` | `boolean` | True if request can be cancelled |

### SendMessageOptions

```typescript
interface SendMessageOptions {
  conversationId?: string;    // Continue existing conversation
  resetConversation?: boolean; // Start new conversation
  stream?: boolean;           // Enable streaming
  onChunk?: (chunk: string) => void; // Stream chunk callback
  metadata?: Record<string, any>; // Additional metadata
}
```

## Examples

### E-commerce Product Assistant

```typescript
const ecommerceConfig = {
  apiBaseUrl: 'https://api.example.com',
  contentstack: {
    apiKey: 'cs123456789',
    deliveryToken: 'blt123456789',
    environment: 'production'
  },
  llm: {
    provider: 'openai',
    apiKey: 'sk-123456789',
    model: 'gpt-4',
    temperature: 0.3 // More deterministic for product info
  }
};

<ChatWindow 
  config={ecommerceConfig}
  title="Product Helper"
  placeholder="Ask about our products..."
/>
```

### Customer Support Bot

```typescript
<ChatWindow
  config={supportConfig}
  title="Support Assistant"
  position="bottom-right"
  streaming={true}
  showResetButton={false}
/>
```

## Backend Requirements

Your backend API must implement:

**POST /v1/chat**
```typescript
// Request Body
{
  message: string;
  config: ChatConfig;
  conversationId?: string;
  resetConversation?: boolean;
  stream?: boolean;
}

// Response (non-streaming)
{
  response: string;
  conversationId: string;
  metadata?: any;
}

// Response (streaming) - Server-Sent Events
data: { content: "Hello", conversationId: "conv_123" }
data: { content: " how", conversationId: "conv_123" }
data: { content: " can I help?" }
data: [DONE]
```

## Troubleshooting

### Common Issues

1. **CORS Errors**: Ensure your backend allows requests from your domain
2. **Invalid API Keys**: Verify Contentstack and LLM API keys are correct
3. **Network Errors**: Check `apiBaseUrl` is accessible

### Error Handling

```typescript
try {
  await sendMessage('Hello');
} catch (error) {
  if (error.name === 'AbortError') {
    // Request was cancelled
  } else {
    // Other errors
    console.error('Chat error:', error);
  }
}
```

## Browser Support

- Chrome ≥ 60
- Firefox ≥ 55
- Safari ≥ 12
- Edge ≥ 79

## License

MIT

## Support

For issues and questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Create an issue on GitHub
3. Contact support@example.com

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.
```

