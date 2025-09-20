import { ContentstackChatAgent } from './chat-agent.js';

async function testAnalytics() {
  const agent = new ContentstackChatAgent();
  
  // Send some test messages
  await agent.sendMessage("Hello there!");
  await agent.sendMessage("What products do you have?");
  await agent.sendMessage("Tell me about your return policy");
  
  // Check analytics
  const analytics = agent.getAnalyticsSnapshot();
  console.log('📊 Analytics Snapshot:');
  console.log('Total queries:', analytics.totalQueries);
  console.log('Successful responses:', analytics.successfulResponses);
  console.log('Average response time:', analytics.averageResponseTime + 'ms');
  
  console.log('\n🔥 Live Metrics:');
  const liveMetrics = agent.getLiveMetrics();
  console.log('Queries per minute:', liveMetrics.queriesPerMinute);
  console.log('Active sessions:', liveMetrics.activeSessions);
  
  console.log('\n📈 Popular Queries:');
  analytics.popularQueries.forEach((query, index) => {
    console.log(`${index + 1}. "${query.query}" - ${query.count} times`);
  });
}

testAnalytics().catch(console.error);