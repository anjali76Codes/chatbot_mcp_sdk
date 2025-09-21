# Chat Agent Demo Website

This demo website showcases how to integrate and use the Contentstack Chat Agent in a real-world application. It demonstrates a plug-and-play chat agent that can be easily embedded into any Contentstack-powered website.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ installed
- Contentstack account with appropriate permissions
- Running LLM Backend server (from the `llm-backend-mcp` folder)

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd demo-website
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:
   ```env
   VITE_API_BASE_URL=http://localhost:3000
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   Navigate to `http://localhost:5173` to see the demo website.

## 📁 Project Structure

```
demo-website/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── FAQsSection.tsx
│   │   ├── Header.tsx
│   │   ├── HeroSection.tsx
│   │   ├── PoliciesSection.tsx
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   └── RichTextRenderer.tsx
│   ├── pages/              # Page components
│   │   ├── FAQsPage.tsx
│   │   ├── HomePage.tsx
│   │   ├── PoliciesPage.tsx
│   │   └── ShopPage.tsx
│   ├── services/           # Contentstack API services
│   │   ├── faqService.ts
│   │   ├── policyService.ts
│   │   └── productServices.ts
│   ├── types/              # TypeScript type definitions
│   │   ├── faq.ts
│   │   ├── policy.ts
│   │   └── product.ts
│   ├── App.tsx             # Main application component
│   ├── main.tsx            # Application entry point
│   └── useChatAgent.ts     # Custom hook for chat functionality
├── package.json
├── vite.config.ts          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── tsconfig.json          # TypeScript configuration
```

## 🤖 Embed Chat Agent to Your Website

### Step 1: Install the Chat SDK

```bash
npm install angupta-chat-sdk@latest
```

### Step 2: Import and Use the Chat Component

```tsx
import { ChatWindow } from 'angupta-chat-sdk';

function MyWebsite() {
  return (
    <div>
      {/* Your website content */}
      <ChatWindow 
        apiBaseUrl={import.meta.env.VITE_API_BASE_URL}
        streaming={true}
        title="Your Assistant"
      />
    </div>
  );
}
```

### Example Implementation

Here's how the chat is embedded in the demo website:

```tsx
// In your main App component
import { ChatWindow } from 'angupta-chat-sdk';

function App() {
  return (
    <div className="min-h-screen">
      {/* Your application routes and content */}
      
      {/* Floating Chat Window - appears on all pages */}
      <div className="fixed bottom-6 right-6 z-50">
        <ChatWindow 
          apiBaseUrl={import.meta.env.VITE_API_BASE_URL}
          streaming={true}
          title="Jewelry Assistant"
          position="bottom-right"
        />
      </div>
    </div>
  );
}
```

## 🛠️ Customization

### Styling

The chat component uses Tailwind CSS and can be customized:

```css
.chat-container {
  @apply fixed bottom-4 right-4 w-96 bg-white rounded-lg shadow-lg;
}

.chat-message {
  @apply p-3 rounded-lg max-w-xs;
}

.user-message {
  @apply bg-blue-100 text-blue-800;
}

.assistant-message {
  @apply bg-gray-100 text-gray-800;
}
```

## 📋 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_BASE_URL` | URL of your LLM backend API | Yes |

## 🚀 Deployment

### Build for Production

```bash
npm run build
```

### Deploy to Contentstack Launch

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Upload to Contentstack Launch**
   - Navigate to your Contentstack stack
   - Go to Launch settings
   - Upload the built files from the `dist` folder
   - Configure your environment variables in Launch settings

## 🆘 Troubleshooting

### Common Issues

1. **Chat not loading**
   - Check if the API_BASE_URL environment variable is set correctly
   - Verify the LLM backend server is running

2. **No responses from chat**
   - Ensure the LLM backend is running
   - Check network connectivity to the LLM API

### Getting Help

- Check the browser console for error messages
- Verify the environment variable is set correctly
- Ensure the LLM backend server is running

## 📄 License

This project is licensed under the MIT License.