import { 
  QueryMetrics, 
  ContentTypeMetrics, 
  AnalyticsSnapshot, 
  LiveMetrics 
} from './types/analytics';

interface QueryData {
  count: number;
  totalResponseTime: number;
  successCount: number;
  lastResponseTime: number;
  lastUpdated: Date;
}

interface ContentTypeData {
  hitCount: number;
  totalResponseTime: number;
  lastResponseTime: number;
  lastUpdated: Date;
}

export class AnalyticsTracker {
  private queryCount: number = 0;
  private successfulResponses: number = 0;
  private fallbackResponses: number = 0;
  private totalResponseTime: number = 0;
  private errorCount: number = 0;
  
  private queryMap: Map<string, QueryData> = new Map();
  private contentTypeMap: Map<string, ContentTypeData> = new Map();
  private responseTimeHistory: number[] = [];
  private recentQueryTimes: { timestamp: Date, responseTime: number }[] = [];
  
  private snapshots: AnalyticsSnapshot[] = [];
  private activeSessions: Set<string> = new Set();
  
  // Track a new query
  trackQuery(
    userMessage: string, 
    responseTime: number, 
    wasSuccessful: boolean, 
    usedFallback: boolean = false,
    contentType?: string,
    sessionId?: string
  ): void {
    this.queryCount++;
    this.totalResponseTime += responseTime;
    this.responseTimeHistory.push(responseTime);
    this.recentQueryTimes.push({ timestamp: new Date(), responseTime });
    
    // Keep only last 1000 response times to prevent memory issues
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-1000);
    }
    if (this.recentQueryTimes.length > 100) {
      this.recentQueryTimes = this.recentQueryTimes.slice(-100);
    }
    
    if (wasSuccessful) {
      this.successfulResponses++;
    }
    
    if (usedFallback) {
      this.fallbackResponses++;
    }
    
    if (!wasSuccessful) {
      this.errorCount++;
    }
    
    // Track query frequency and response time per query
    const cleanQuery = userMessage.toLowerCase().trim();
    const queryData = this.queryMap.get(cleanQuery) || { 
      count: 0, 
      totalResponseTime: 0, 
      successCount: 0,
      lastResponseTime: 0,
      lastUpdated: new Date()
    };
    
    queryData.count++;
    queryData.totalResponseTime += responseTime;
    queryData.lastResponseTime = responseTime;
    queryData.lastUpdated = new Date();
    
    if (wasSuccessful) {
      queryData.successCount++;
    }
    this.queryMap.set(cleanQuery, queryData);
    
    // Track content type usage and response time
    if (contentType) {
      const contentTypeData = this.contentTypeMap.get(contentType) || { 
        hitCount: 0, 
        totalResponseTime: 0,
        lastResponseTime: 0,
        lastUpdated: new Date()
      };
      contentTypeData.hitCount++;
      contentTypeData.totalResponseTime += responseTime;
      contentTypeData.lastResponseTime = responseTime;
      contentTypeData.lastUpdated = new Date();
      this.contentTypeMap.set(contentType, contentTypeData);
    }
    
    // Track active sessions
    if (sessionId) {
      this.activeSessions.add(sessionId);
    }
  }
  
  // Get current analytics snapshot
  getCurrentSnapshot(): AnalyticsSnapshot {
    const popularQueries = Array.from(this.queryMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageResponseTime: data.count > 0 ? data.totalResponseTime / data.count : 0,
        successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
        lastUpdated: data.lastUpdated
      }));
    
    const contentTypePerformance = Array.from(this.contentTypeMap.entries())
      .map(([contentType, data]) => ({
        contentType,
        hitCount: data.hitCount,
        averageResponseTime: data.hitCount > 0 ? data.totalResponseTime / data.hitCount : 0,
        lastUpdated: data.lastUpdated
      }))
      .sort((a, b) => b.hitCount - a.hitCount);
    
    return {
      timestamp: new Date(),
      totalQueries: this.queryCount,
      successfulResponses: this.successfulResponses,
      fallbackResponses: this.fallbackResponses,
      averageResponseTime: this.queryCount > 0 ? this.totalResponseTime / this.queryCount : 0,
      popularQueries,
      contentTypePerformance,
      errorCount: this.errorCount,
      errorRate: this.queryCount > 0 ? (this.errorCount / this.queryCount) * 100 : 0
    };
  }
  
  // Get live metrics for real-time dashboard
  getLiveMetrics(): LiveMetrics {
    return {
      queriesPerMinute: this.calculateQueriesPerMinute(),
      currentResponseTime: this.getCurrentResponseTime(),
      activeSessions: this.activeSessions.size,
      errorRate: this.queryCount > 0 ? (this.errorCount / this.queryCount) * 100 : 0
    };
  }
  
  // Get response time statistics for a specific query
  getQueryMetrics(query: string): QueryMetrics | null {
    const cleanQuery = query.toLowerCase().trim();
    const data = this.queryMap.get(cleanQuery);
    
    if (!data) return null;
    
    return {
      query: cleanQuery,
      count: data.count,
      averageResponseTime: data.count > 0 ? data.totalResponseTime / data.count : 0,
      successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
      lastUpdated: data.lastUpdated
    };
  }
  
  // Get the most recent response time for a specific query
  getQueryLastResponseTime(query: string): number | null {
    const cleanQuery = query.toLowerCase().trim();
    const data = this.queryMap.get(cleanQuery);
    
    if (!data) return null;
    
    return data.lastResponseTime;
  }
  
  // Get performance metrics for a specific content type
  getContentTypeMetrics(contentType: string): ContentTypeMetrics | null {
    const data = this.contentTypeMap.get(contentType);
    
    if (!data) return null;
    
    return {
      contentType,
      hitCount: data.hitCount,
      averageResponseTime: data.hitCount > 0 ? data.totalResponseTime / data.hitCount : 0,
      lastUpdated: data.lastUpdated
    };
  }
  
  // Get the most recent response time for a specific content type
  getContentTypeLastResponseTime(contentType: string): number | null {
    const data = this.contentTypeMap.get(contentType);
    
    if (!data) return null;
    
    return data.lastResponseTime;
  }
  
  // Save current snapshot (call this periodically)
  saveSnapshot(): void {
    this.snapshots.push(this.getCurrentSnapshot());
    // Keep only last 1000 snapshots to prevent memory issues
    if (this.snapshots.length > 1000) {
      this.snapshots = this.snapshots.slice(-1000);
    }
  }
  
  // Clear old sessions (call this periodically)
  cleanupSessions(): void {
    // This would normally check session ages, but for simplicity:
    this.activeSessions.clear();
  }
  
  // Calculate queries per minute based on recent activity
  private calculateQueriesPerMinute(): number {
    if (this.recentQueryTimes.length < 2) return 0;
    
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    
    // Count queries from the last minute
    const recentQueries = this.recentQueryTimes.filter(
      qt => qt.timestamp >= oneMinuteAgo
    );
    
    return recentQueries.length;
  }
  
  // Get current average response time (based on recent queries)
  private getCurrentResponseTime(): number {
    if (this.recentQueryTimes.length === 0) return 0;
    
    // Calculate average of recent response times (last 10 queries or all if less)
    const recentCount = Math.min(this.recentQueryTimes.length, 10);
    const recentTimes = this.recentQueryTimes.slice(-recentCount);
    const totalRecentTime = recentTimes.reduce((sum, qt) => sum + qt.responseTime, 0);
    
    return totalRecentTime / recentCount;
  }
  
  // Get response time distribution
  getResponseTimeDistribution(): { range: string, count: number }[] {
    const ranges = [
      { min: 0, max: 100, label: '0-100ms' },
      { min: 101, max: 300, label: '101-300ms' },
      { min: 301, max: 500, label: '301-500ms' },
      { min: 501, max: 1000, label: '501-1000ms' },
      { min: 1001, max: Infinity, label: '1001ms+' }
    ];
    
    return ranges.map(range => ({
      range: range.label,
      count: this.responseTimeHistory.filter(rt => rt >= range.min && rt <= range.max).length
    }));
  }
  
  // Get top performing queries (fastest response times)
  getTopPerformingQueries(limit: number = 5): QueryMetrics[] {
    return Array.from(this.queryMap.entries())
      .filter(([_, data]) => data.count >= 3) // Only include queries with at least 3 occurrences
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageResponseTime: data.count > 0 ? data.totalResponseTime / data.count : 0,
        successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
        lastUpdated: data.lastUpdated
      }))
      .sort((a, b) => a.averageResponseTime - b.averageResponseTime)
      .slice(0, limit);
  }
  
  // Get slowest queries
  getSlowestQueries(limit: number = 5): QueryMetrics[] {
    return Array.from(this.queryMap.entries())
      .filter(([_, data]) => data.count >= 3) // Only include queries with at least 3 occurrences
      .map(([query, data]) => ({
        query,
        count: data.count,
        averageResponseTime: data.count > 0 ? data.totalResponseTime / data.count : 0,
        successRate: data.count > 0 ? (data.successCount / data.count) * 100 : 0,
        lastUpdated: data.lastUpdated
      }))
      .sort((a, b) => b.averageResponseTime - a.averageResponseTime)
      .slice(0, limit);
  }
  
  // Reset analytics
  reset(): void {
    this.queryCount = 0;
    this.successfulResponses = 0;
    this.fallbackResponses = 0;
    this.totalResponseTime = 0;
    this.errorCount = 0;
    this.queryMap.clear();
    this.contentTypeMap.clear();
    this.responseTimeHistory = [];
    this.recentQueryTimes = [];
    this.snapshots = [];
    this.activeSessions.clear();
  }
}