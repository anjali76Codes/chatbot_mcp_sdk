export interface QueryMetrics {
  query: string;
  count: number;
  averageResponseTime: number;
  successRate: number;
  lastUpdated?: Date;
}

export interface ContentTypeMetrics {
  contentType: string;
  hitCount: number;
  averageResponseTime: number;
  lastUpdated?: Date;
}

export interface AnalyticsSnapshot {
  timestamp: Date;
  totalQueries: number;
  successfulResponses: number;
  fallbackResponses: number;
  averageResponseTime: number;
  popularQueries: QueryMetrics[];
  contentTypePerformance: ContentTypeMetrics[];
  errorCount: number;
  errorRate: number;
}

export interface AnalyticsTimeSeries {
  snapshots: AnalyticsSnapshot[];
  timeRange: {
    start: Date;
    end: Date;
  };
}

// For real-time dashboard
export interface LiveMetrics {
  queriesPerMinute: number;
  currentResponseTime: number;
  activeSessions: number;
  errorRate: number;
}