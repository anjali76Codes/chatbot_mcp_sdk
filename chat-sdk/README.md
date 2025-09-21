# Chat SDK - React Component for AI Chat Agents

A lightweight, customizable React SDK for embedding AI-powered chat agents in your applications. Easily connect to LLM backends with support for both streaming and non-streaming responses.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Basic Usage](#basic-usage)
- [Advanced Usage](#advanced-usage)
- [API Reference](#api-reference)
- [Backend Requirements](#backend-requirements)
- [Customization](#customization)
- [Examples](#examples)
- [Troubleshooting](#troubleshooting)
- [Browser Support](#browser-support)
- [Contributing](#contributing)
- [License](#license)

## Features

- 🚀 Easy integration with any React application
- 💬 Support for both streaming and non-streaming responses
- 🎨 Fully customizable UI and styling
- 🔧 TypeScript support with full type definitions
- ⚡ Lightweight and performant
- 🔄 Conversation management with persistence
- ❌ Error handling and recovery
- ⏹️ Request cancellation support
- 📱 Responsive design

## Installation

```bash
npm install angupta-chat-sdk 
```

### Peer Dependencies

This package requires the following peer dependencies:

- React 16.8 or higher (for hooks support)
- React Icons (for default icons)

## Quick Start

### 1. Add the Chat Component to Your App

```tsx
import React from 'react';
import { ChatWindow } from 'angupta-chat-sdk';

function App() {
  return (
    <div className="app">
      <h1>My Website</h1>
      {/* Your application content */}
      <ChatWindow 
        apiBaseUrl="https://your-backend-api.com"
        title="Customer Support"
      />
    </div>
  );
}

export default App;
```

### 2. Set Up Your Backend

Your backend should implement the required API endpoints. See [Backend Requirements](#backend-requirements) for details.

## Basic Usage

### Using the Pre-built ChatWindow Component

The `ChatWindow` component provides a complete chat interface out of the box:

```tsx
import React from 'react';
import { ChatWindow } from 'angupta-chat-sdk';

function Website() {
  return (
    <div>
      <header>My Website Header</header>
      <main>Website Content</main>
      <ChatWindow 
        apiBaseUrl="https://api.example.com/chat"
        title="Support Assistant"
        position="bottom-right"
        streaming={true}
        placeholder="How can I help you today?"
      />
    </div>
  );
}
```

### Component Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `apiBaseUrl` | `string` | **(required)** | Base URL of your chat backend API |
| `title` | `string` | "Jewelry Assistant" | Title displayed in the chat header |
| `position` | `'bottom-right' \| 'bottom-left' \| 'top-right' \| 'top-left'` | "bottom-right" | Position of the chat window |
| `showHeader` | `boolean` | `true` | Whether to show the chat header |
| `streaming` | `boolean` | `false` | Enable streaming responses |
| `className` | `string` | `""` | Additional CSS classes for custom styling |
| `placeholder` | `string` | "Ask about our jewelry collection..." | Input placeholder text |
| `showResetButton` | `boolean` | `true` | Show reset conversation button |

## Advanced Usage

### Using the Hook for Custom UI

For complete control over the UI, use the `useChatAgent` hook directly:

```tsx
import React, { useState } from 'react';
import { useChatAgent } from 'angupta-chat-sdk';

function CustomChatInterface() {
  const [input, setInput] = useState('');
  const { 
    messages, 
    isLoading, 
    error, 
    sendMessage, 
    clearMessages 
  } = useChatAgent('https://your-backend-api.com');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      try {
        await sendMessage(input);
        setInput('');
      } catch (error) {
        console.error('Failed to send message:', error);
      }
    }
  };

  return (
    <div className="custom-chat">
      <div className="chat-header">
        <h3>Custom Chat</h3>
        <button onClick={clearMessages}>Clear</button>
      </div>
      
      <div className="messages">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.role}`}>
            <span className="message-content">{msg.content}</span>
            <span className="message-time">
              {msg.timestamp?.toLocaleTimeString()}
            </span>
          </div>
        ))}
      </div>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="message-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your message..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading || !input.trim()}>
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
```

### Streaming Responses

To use streaming responses, set the `streaming` prop to `true`:

```tsx
<ChatWindow
  apiBaseUrl="https://api.example.com/chat"
  streaming={true}
  title="AI Assistant"
/>
```

Or with the hook:

```tsx
const { sendMessageStream } = useChatAgent(apiBaseUrl);

// Usage
await sendMessageStream(message, {
  onChunk: (chunk) => {
    console.log('Received chunk:', chunk.content);
  }
});
```

## API Reference

### useChatAgent Hook

The `useChatAgent` hook returns an object with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `ChatMessage[]` | Array of chat messages |
| `isLoading` | `boolean` | Whether a request is in progress |
| `error` | `string \| null` | Error message if any |
| `conversationId` | `string` | Current conversation ID |
| `isInitializing` | `boolean` | Whether the chat is initializing |
| `config` | `BackendConfig \| null` | Backend configuration |
| `sendMessage` | `function` | Send a message (non-streaming) |
| `sendMessageStream` | `function` | Send a message with streaming response |
| `clearMessages` | `function` | Clear all messages and reset conversation |
| `cancelRequest` | `function` | Cancel the current request |
| `isInitialized` | `boolean` | Whether the chat is initialized |
| `hasMessages` | `boolean` | Whether there are any messages |
| `canCancel` | `boolean` | Whether the current request can be canceled |

### Type Definitions

The package includes full TypeScript definitions. Key types include:

```typescript
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: Date;
  isStreaming?: boolean;
  metadata?: Record<string, any>;
}

interface SendMessageOptions {
  conversationId?: string;
  resetConversation?: boolean;
  metadata?: Record<string, any>;
  contentTypes?: string[];
  format?: 'text' | 'markdown' | 'html';
  language?: string;
}

interface StreamingChunk {
  content: string;
  done: boolean;
  conversationId?: string;
}
```

## Backend Requirements

Your backend should implement the following endpoints:

### 1. Configuration Endpoint
**GET** `/v1/config`
Returns configuration information about the chat agent.

### 2. Chat Endpoint (Non-streaming)
**POST** `/v1/chat`
Handles regular chat messages.

**Request Body:**
```json
{
  "message": "user message",
  "conversationId": "optional-conversation-id",
  "resetConversation": false,
  "metadata": {},
  "contentTypes": ["faq", "products"],
  "format": "text",
  "language": "en"
}
```

**Response:**
```json
{
  "response": "assistant response",
  "conversationId": "conversation-id",
  "metadata": {},
  "usage": {
    "promptTokens": 10,
    "completionTokens": 20
  },
  "latency": 500
}
```

### 3. Streaming Endpoint
**POST** `/v1/chat/stream`
Handles streaming chat messages using Server-Sent Events.

**Request Body:** Same as non-streaming endpoint

**Response:** Server-Sent Events stream with JSON data:
```
data: {"chunk": "Hello", "conversationId": "conv123"}
data: {"chunk": " there", "conversationId": "conv123"}
data: {"done": true, "conversationId": "conv123"}
```

## Customization

### Styling

The ChatWindow component accepts a `className` prop for custom styling:

```tsx
<ChatWindow
  apiBaseUrl="https://api.example.com/chat"
  className="my-custom-chat-styles"
/>
```

With CSS:
```css
.my-custom-chat-styles {
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 2px solid #e5e7eb;
}

.my-custom-chat-styles .chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}
```

### Theming with CSS Variables

You can customize the appearance using CSS variables:

```css
:root {
  --chat-primary-color: #4f46e5;
  --chat-secondary-color: #6366f1;
  --chat-background: #ffffff;
  --chat-text-color: #374151;
  --chat-border-radius: 12px;
}

.my-chat-theme {
  --chat-primary-color: #dc2626;
  --chat-secondary-color: #ef4444;
}
```

## Examples

### Basic Implementation
```tsx
<ChatWindow
  apiBaseUrl="https://api.example.com/chat"
  title="Support Bot"
  placeholder="How can I help you today?"
/>
```

### Advanced Implementation with Streaming
```tsx
<ChatWindow
  apiBaseUrl="https://api.example.com/chat"
  title="AI Assistant"
  streaming={true}
  position="bottom-left"
  showResetButton={false}
  className="custom-chat-theme"
/>
```

### Custom UI with Hook
```tsx
import { useChatAgent } from 'angupta-chat-sdk';

function MinimalChat() {
  const { messages, isLoading, sendMessage } = useChatAgent(apiBaseUrl);
  
  // Implement your minimal UI
  return (
    <div>
      {/* Your custom UI implementation */}
    </div>
  );
}
```

## Troubleshooting

### Common Issues

1. **CORS errors**: Ensure your backend allows requests from your domain
2. **Streaming not working**: Verify your backend supports Server-Sent Events
3. **Icons not displaying**: Make sure react-icons is installed
4. **Initialization errors**: Check that your backend `/v1/config` endpoint is accessible

### Debug Mode

Enable browser developer tools to see detailed logs of network requests and state changes.

## Browser Support

The SDK supports all modern browsers that implement:
- ES6+ features
- Fetch API
- AbortController
- TextDecoder (for streaming responses)

## Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check this documentation
2. Search existing GitHub issues
3. Create a new issue with a detailed description


