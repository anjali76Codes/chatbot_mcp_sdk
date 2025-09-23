# Chatbot MCP SDK - AI-Powered Contentstack Integration

<div align="center">

![Chatbot MCP SDK](https://img.shields.io/badge/Contentstack-MCP%20Integration-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-4.9+-3178C6?logo=typescript)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)

**Enterprise-grade AI chatbot SDK with seamless Contentstack CMS integration**


</div>

## 📋 Overview

The **Chatbot MCP SDK** is a comprehensive solution that integrates AI-powered chat capabilities with Contentstack's MCP (Multi-Channel Content Platform). This enterprise-ready toolkit enables dynamic, context-aware conversational experiences across websites and applications with **5-minute deployment** capability.

## 🏗️ Project Architecture

```
chatbot_mcp_sdk/
├── 📦 chat-sdk/                 # Reusable React Chat SDK (NPM Package)
├── 🌐 demo-website/            # Complete E-commerce Demo Site
└── ⚙️ llm-backend-mcp/         # AI Backend with MCP Integration
```

---

## 📦 1. Chat SDK (`chat-sdk/`)

### 🎯 Purpose
A reusable TypeScript SDK providing chatbot functionality with Contentstack MCP integration for React applications.

### ✨ Key Features

#### **Core Chat Functionality**
- **Real-time Messaging**: Bidirectional communication with text message support
- **Message History**: Persistent conversation storage with session management
- **Typing Indicators**: Visual feedback during AI response generation
- **Error Handling**: Robust error management with user-friendly messages



### 🚀 Quick Integration

```bash
npm install angupta-chat-sdk
```

```typescript
import { ChatWindow } from 'angupta-chat-sdk';

function App() {
  return (
    <ChatWindow
      apiKey="your-api-key"
      contentstackConfig={config}
      position="bottom-right"
    />
  );
}
```

### 🛠️ Tech Stack
- **Language**: TypeScript 4.9+
- **Framework**: React 18+
- **Build Tool**: Vite
- **Styling**: CSS Modules
- **Package Manager**: npm

---

## 🌐 2. Demo Website (`demo-website/`)

### 🎯 Purpose
A complete e-commerce jewelry storefront demonstrating the SDK's capabilities in a real-world scenario.

### ✨ Key Features

#### **E-commerce Functionality**
- **Product Catalog**: Dynamic product listings with search and filtering
- **Shopping Experience**: Complete user journey from browsing to checkout
- **Responsive Design**: Mobile-first approach with Tailwind CSS
- **Multi-Page Structure**: Home, Shop, FAQs, Policies, Analytics pages

#### **Contentstack CMS Integration**
- **Real-time Content Management**: Dynamic content updates without redeployment
- **Structured Content Types**: Products, FAQs, Policies with rich text support
- **Contentstack Launch**: One-command deployment pipeline

#### **AI Chat Integration**
- **Floating Chat Widget**: Non-intrusive, always-accessible AI assistant
- **Content-Aware Responses**: AI understands and references website content
- **Session Persistence**: Maintains conversation context across page navigation

### 🚀 Deployment

```bash
# Install dependencies
npm install

# Development
npm run dev

# Build for production
npm run build

# Deploy to Contentstack Launch
npm run deploy
```

### 🛠️ Tech Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **CMS**: Contentstack
- **Deployment**: Contentstack Launch
- **Testing**: ESLint, TypeScript compiler

---

## ⚙️ 3. LLM Backend MCP (`llm-backend-mcp/`)

### 🎯 Purpose
AI backend service handling conversation logic, Contentstack integration, and multi-LLM provider management.

### ✨ Key Features

#### **Multi-LLM Provider Integration**
- **Unified API Interface**: Standardized interface across different providers
- **Provider-Specific Optimization**: Special handling for Groq's token limitations
- **Easy Switching**: Seamless transition between OpenAI, Anthropic, Google, Groq
- **Fallback Mechanisms**: Automatic provider fallback on failures

#### **Intelligent Content Routing**
- **Dynamic Query Analysis**: Determines content needs vs general conversation
- **Automatic Content Type Selection**: Based on query context and intent
- **Smart Caching**: Response caching with TTL management for performance
- **Token Optimization**: Aware of limits and optimizes queries accordingly

#### **Advanced Conversation Management**
- **Ambiguous Reference Resolution**: Understands "this product", "that policy" from context
- **Conversation Buffer**: Maintains context across multiple interactions
- **Session Persistence**: Database-backed conversation history
- **Context-Aware Responses**: Prevents unnecessary API calls for small talk

### 🚀 API Usage

```typescript
// Initialize chat agent
const agent = new ChatAgent({
  llmProvider: 'openai',
  contentstackConfig: csConfig,
  cacheEnabled: true
});

// Stream responses
const stream = await agent.sendMessage(message, conversationHistory);
```

### 🛠️ Tech Stack
- **Runtime**: Node.js 18+
- **Language**: TypeScript
- **Framework**: Express.js
- **AI Providers**: OpenAI, Anthropic, Google AI, Groq
- **Cache**: Redis (optional)
- **Database**: MongoDB/PostgreSQL for sessions

---

## 🎯 Top 5  Features

### 1. **Contentstack CMS Integration**
- Real-time content sync and management
- Dynamic content updates without redeployment
- Structured content type support

### 2. **Plug-and-Play Chat SDK**
- Floating AI widget with minimal setup (5-minute integration)
- Customizable positioning and styling
- Zero-configuration content binding

### 3. **Multi-Page E-commerce Functionality**
- Complete jewelry storefront implementation
- Product catalog with search and filtering
- Responsive mobile-first design

### 4. **Contentstack Launch Deployment**
- One-command deployment pipeline
- Production-ready CI/CD integration
- Enterprise-grade deployment workflow

### 5. **Multi-LLM Provider Support**
- Unified interface across OpenAI, Anthropic, Google, Groq
- Provider-specific optimizations
- Easy configuration switching

---

## 💡 Top 5 Unique Aspects

### 1. **Ambiguous Reference Resolution**
```typescript
// Automatically understands context:
User: "Tell me more about this product"
AI: (Knows which product from conversation history)
```
- Resolves vague references like "this product" or "that policy"
- Uses conversation context without explicit mentions
- Reduces user friction in complex conversations

### 2. **5-Minute AI Integration**
- Actual rapid deployment demonstration
- Minimal configuration required
- Live content-to-AI synchronization

### 3. **Indian Market Localization**
```typescript
// Automatic currency conversion and localization
User: "What's the price?"
AI: "The necklace costs ₹15,999 (original $190)"
```
- Automatic currency conversion to ₹ (rupees)
- Cultural context awareness for Indian e-commerce
- Localized product recommendations

### 4. **Content-Aware Conversation Intelligence**
- Distinguishes between content queries and general conversation
- Prevents unnecessary content API calls for greetings/small talk
- Smart routing based on query intent analysis

### 5. **Enterprise Deployment Pipeline**
- Contentstack Launch integration out-of-the-box
- Production-ready analytics and monitoring
- Scalable architecture for high-traffic scenarios

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Contentstack account
- AI provider API key (OpenAI/Anthropic/Google/Groq)

### 1. Clone Repository
```bash
git clone https://github.com/your-org/chatbot_mcp_sdk.git
cd chatbot_mcp_sdk
```

### 2. Backend Setup
```bash
cd llm-backend-mcp
npm install
cp .env.example .env
# Configure your environment variables
npm run dev
```

### 3. Demo Website Setup
```bash
cd demo-website
npm install
npm run dev
```

### 4. SDK Integration (For Your Project)
```bash
npm install angupta-chat-sdk@latest
```

### Environment Configuration
```env
# LLM Backend
OPENAI_API_KEY=your_openai_key
CONTENTSTACK_API_KEY=your_cs_key
CONTENTSTACK_DELIVERY_TOKEN=your_delivery_token
CONTENTSTACK_ENVIRONMENT=production

# Frontend
VITE_API_BASE_URL=http://localhost:3000
VITE_CONTENTSTACK_CONFIG=your_config
```

---

## 📊 Analytics & Monitoring

### Built-in Analytics Dashboard
- Real-time conversation metrics
- User engagement tracking
- Content performance analytics
- Error rate monitoring

### Performance Metrics
- Response time tracking
- Token usage optimization
- Cache hit rates
- Provider performance comparison

---


## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

---


## 🧪 Test Queries - Feature Demonstration

### 1. **Context Persistence + Buffer Window**
```bash
"Show me your diamond collections"
# Then follow up with:
"What about gold ones?"
# Tests if chatbot remembers "collections" context without repetition
```
### 2. **Price Range Filtering**
```bash
"Show me products under 5000 rupees"
# Tests budget-based filtering and currency awareness
```
### 3. **Category-Based Filtering**
```bash
"Under rings category, tell which products you have"
# Tests content type filtering and categorization
```

### 4. **Price Comparison & Analysis**
```bash
"Under bracelets, which products come?"
# Follow up with:
"Which product has the least price among them?"
# Then: "And maximum price?"
# Tests comparative analysis within categories
```

### 5. **FAQ Integration - Returns Policy**
```bash
"Do you offer returns?"
# Tests automatic FAQ content fetching from Contentstack
```

### 6. **Contact Information Query**
```bash
"How can I contact you for custom jewelry designs?"
# Tests contact info retrieval from FAQs
```

### 7. **Shipping Policy Inquiry**
```bash
"What's your shipping policy?"
# Later in conversation:
"Can you remind me of that policy again?"
# Tests persistent memory across conversation
```

### 8. **Gift Services Inquiry**
```bash
"Do you offer gift wrapping services?"
# Tests specific service-related FAQ retrieval
```

### 9. **Collection Overview**
```bash
"What collections do you have total?"
# Tests broad content discovery and categorization
```

### 10. **Budget-Based Recommendations**
```bash
"If my budget is 200, suggest which product I can buy"
# Tests price filtering and recommendation logic
```

## 🔍 Feature Demonstration Flow

### **Demo Introduction Script:**
*"This chatbot is built for my jewelry website with three key features:*

1. **Persistent Memory** – Remembers what we discussed earlier
2. **Buffer Window for Context** – Understands follow-up questions without repetition  
3. **Real-time Content Knowledge** – Answers from Collections, FAQs, and Policies via Contentstack*

*Now, let me demonstrate these features in action..."*

### **Highlights:**

✅ **Context Retention**: Chatbot remembers "collections" context when asking about gold after diamonds   
✅ **Comparative Analysis**: Can compare prices within categories automatically  
✅ **FAQ Integration**: Fetches real-time policy information from Contentstack  
✅ **Memory Persistence**: Recalls shipping policy details later in conversation without re-querying  
✅ **Intelligent Filtering**: Filters products by category, price range, and material  
✅ **Natural Conversation Flow**: Handles follow-up questions seamlessly  

### **Testing Instructions:**
1. Start with product inquiries to test content discovery
2. Use follow-up questions to test context retention
3. Ask policy/FAQ questions to test Contentstack integration
4. Verify real-time content accuracy by checking against actual CMS data


## 🚀 Deployment Commands

### 1. Login to Contentstack
```bash
csdx auth:login
```

### 2. Build and Deploy to Launch
```bash
cd demo-website
csdx launch --type FileUpload --framework Other --build-command "npm run build" --out-dir "dist"
```

### 3. During Deployment Prompts:
- **Organization:** Select your organization
- **Project Name:** `Jewelry chatbot`
- **Environment Name:** `production` 
- **Framework Preset:** `OTHER`
- **Server Command:** (Leave empty - press Enter)
- **Environment Variables:** Select "Manually add custom variables to the list"
- **Enter Variables:** Provide in format: `KEY:value, KEY:value`



## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🏆 Acknowledgments
- **Contentstack** for the amazing MCP platform
- **OpenAI/Anthropic/Google/Groq** for LLM services
- **React & TypeScript** communities for excellent tooling

---

<div align="center">

**⭐ Star us on GitHub if this project helped you!**

[Return to Top](#chatbot-mcp-sdk---ai-powered-contentstack-integration)

</div>