// src/index.ts
import { ContentstackChatAgent } from './chat-agent.js';
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

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

  const chatAgent = new ContentstackChatAgent();
  
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

      let response: string;

      // ✅ Route specific requests to the right tool
     if (cleaned.includes('assets')) {
  const toolResult = await chatAgent.callTool('get_all_assets', {});
  response = await chatAgent.sendMessage(
    `Here is the raw tool output: ${toolResult}. Please summarize and present it in a user-friendly way.`
  );
} else if (cleaned.includes('content types')) {
  const toolResult = await chatAgent.getContentTypes();
  response = await chatAgent.sendMessage(
    `Here is the raw tool output: ${toolResult}. Please explain it in a clear and conversational way.`
  );
} else if (cleaned.includes('entries')) {
  const toolResult = await chatAgent.callTool('get_all_entries', { content_type_uid: 'page' });
  response = await chatAgent.sendMessage(
    `Here is the raw tool output: ${toolResult}. Please summarize the entries for the user.`
  );
} else {
  response = await chatAgent.sendMessage(userInput);
}

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
