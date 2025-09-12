// src/index.ts
import { ContentstackChatAgent, ChatMessage } from './chat-agent.js';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const history: ChatMessage[] = [];

async function main(): Promise<void> {
  const requiredEnvVars = [
    'GOOGLE_API_KEY', 
    'CONTENTSTACK_API_KEY', 
    'CONTENTSTACK_MANAGEMENT_TOKEN'
  ];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      throw new Error(`${envVar} environment variable is not set`);
    }
  }

  const rl = readline.createInterface({ input, output });
  console.log('🚀 Starting Contentstack Chat Agent...\n');

  const chatAgent = new ContentstackChatAgent({
    contentstack: {
      apiKey: process.env.CONTENTSTACK_API_KEY,
      deliveryToken: process.env.CONTENTSTACK_MANAGEMENT_TOKEN,
      environment: process.env.CONTENTSTACK_ENVIRONMENT || 'production',
      region: process.env.CONTENTSTACK_REGION || 'us'
    },
    llm: {
      provider: 'google',
      apiKey: process.env.GOOGLE_API_KEY,
      model: process.env.LLM_MODEL || 'gemini-1.5-flash',
      temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.3')
    }
  });
  
  try {
    await chatAgent.initialize();
    
    console.log('💬 Chat Agent is ready! Type your questions below.');
    console.log('Type "exit", "quit", or press Ctrl+C to end the conversation.\n');

    while (true) {
      const userInput = await rl.question('👤 You: ');
      const cleaned = userInput.toLowerCase().trim();

      if (['exit', 'quit', 'bye'].includes(cleaned)) {
        break;
      }

      if (cleaned === 'clear') {
        chatAgent.clearConversationHistory();
        console.log('🗑️ Conversation history cleared\n');
        continue;
      }

      console.log('🤖 Thinking...');
      const startTime = Date.now();

      // 🚀 LET THE CHAT AGENT HANDLE EVERYTHING AUTOMATICALLY
      const response = await chatAgent.sendMessage(userInput, history);

      // 🚀 UPDATE HISTORY EFFICIENTLY
      history.push({ role: 'user', content: userInput });
      history.push({ role: 'assistant', content: response });
      
      // Keep history manageable
      if (history.length > 10) {
        history.splice(0, history.length - 10);
      }

      console.log(`⚡ Response time: ${Date.now() - startTime}ms`);
      console.log(`\n🤖 Assistant: ${response}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await chatAgent.shutdown();
    rl.close();
    console.log('\n👋 Goodbye!');
  }
}

main().catch(console.error);