import React, { useState, useEffect } from 'react';

interface AnalyticsData {
  timestamp: string;
  totalQueries: number;
  successfulResponses: number;
  fallbackResponses: number;
  averageResponseTime: number;
  popularQueries: Array<{
    query: string;
    count: number;
    averageResponseTime: number;
    successRate: number;
  }>;
  contentTypePerformance: Array<{
    contentType: string;
    hitCount: number;
    averageResponseTime: number;
  }>;
  errorCount: number;
}

interface LiveMetrics {
  queriesPerMinute: number;
  currentResponseTime: number;
  activeSessions: number;
  errorRate: number;
}

const AnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);


// Add this function after your imports
const formatResponseTime = (ms: number): string => {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  } else {
    // Convert to seconds with 2 decimal places
    return `${(ms / 1000).toFixed(2)}s`;
  }
};


  const fetchAnalytics = async () => {
    try {
      const [analyticsResponse, liveResponse] = await Promise.all([
        fetch('http://localhost:3000/api/analytics/overview'),
        fetch('http://localhost:3000/api/analytics/live-metrics')
      ]);

      if (!analyticsResponse.ok || !liveResponse.ok) {
        throw new Error('Failed to fetch analytics data');
      }

      const analyticsData = await analyticsResponse.json();
      const liveData = await liveResponse.json();

      setAnalytics(analyticsData);
      setLiveMetrics(liveData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fcfbf8] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[#ecab13] mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-[#1b170d] mb-2">Loading Analytics</h2>
          <p className="text-[#6b6656]">Gathering your chat performance data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fcfbf8] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-[#d4af37] text-6xl mb-6">💎</div>
          <h2 className="text-3xl font-bold text-[#1b170d] mb-4">Unable to Load Analytics</h2>
          <p className="text-[#6b6656] mb-6 text-lg">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="bg-[#ecab13] text-[#1b170d] px-8 py-3 rounded-lg font-semibold hover:bg-[#d4af37] transition-colors shadow-lg"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics || !liveMetrics) {
    return (
      <div className="min-h-screen bg-[#fcfbf8] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#d4af37] text-6xl mb-4">📊</div>
          <h2 className="text-2xl font-bold text-[#1b170d] mb-2">No Data Available</h2>
          <p className="text-[#6b6656]">Start chatting to see analytics data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbf8] p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#1b170d] mb-4">Chat Analytics Dashboard</h1>
          <p className="text-xl text-[#6b6656]">Real-time insights into your Glimmer Jewels chat performance</p>
          <div className="w-24 h-1 bg-[#ecab13] mx-auto mt-4"></div>
        </div>

        {/* Live Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {/* Total Queries */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-[#f3f0e7]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#6b6656] uppercase tracking-wide">Total Queries</p>
                <p className="text-3xl font-bold text-[#1b170d] mt-2">{analytics.totalQueries}</p>
                <p className="text-sm text-[#6b6656] mt-1">All-time conversations</p>
              </div>
              <div className="bg-[#fff9e6] p-3 rounded-full">
                <span className="text-2xl text-[#ecab13]">💬</span>
              </div>
            </div>
          </div>

          {/* Response Time */}
          {/* Response Time */}
<div className="bg-white rounded-xl shadow-lg p-6 border border-[#f3f0e7]">
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm font-semibold text-[#6b6656] uppercase tracking-wide">Avg Response</p>
      <p className="text-3xl font-bold text-[#1b170d] mt-2 truncate">
        {formatResponseTime(analytics.averageResponseTime)}
      </p>
      <p className="text-sm text-[#6b6656] mt-1">Lightning fast</p>
    </div>
    <div className="bg-[#e8f5e8] p-3 rounded-full">
      <span className="text-2xl text-[#27ae60]">⚡</span>
    </div>
  </div>
</div>
          {/* Active Sessions */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-[#f3f0e7]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#6b6656] uppercase tracking-wide">Active Sessions</p>
                <p className="text-3xl font-bold text-[#1b170d] mt-2">{liveMetrics.activeSessions}</p>
                <p className="text-sm text-[#6b6656] mt-1">Live conversations</p>
              </div>
              <div className="bg-[#e3f2fd] p-3 rounded-full">
                <span className="text-2xl text-[#1976d2]">👥</span>
              </div>
            </div>
          </div>

          {/* Error Rate */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-[#f3f0e7]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-[#6b6656] uppercase tracking-wide">Error Rate</p>
                <p className="text-3xl font-bold text-[#1b170d] mt-2">{liveMetrics.errorRate.toFixed(1)}%</p>
                <p className="text-sm text-[#6b6656] mt-1">Smooth experience</p>
              </div>
              <div className="bg-[#ffebee] p-3 rounded-full">
                <span className="text-2xl text-[#d32f2f]">✅</span>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          {/* Popular Queries */}
        <div className="bg-white rounded-xl shadow-lg p-6 border border-[#f3f0e7]">
  <h2 className="text-2xl font-bold text-[#1b170d] mb-6 flex items-center">
    <span className="bg-[#ecab13] w-3 h-6 rounded-full mr-3"></span>
    Popular Customer Queries
  </h2>
  <div className="space-y-4">
    {analytics.popularQueries.slice(0, 6).map((query, index) => (
      <div key={index} className="p-4 bg-gradient-to-r from-[#faf9f5] to-[#f5f3ec] rounded-lg border border-[#f3f0e7] shadow-sm hover:shadow-md transition-all duration-200">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <span className="text-xs font-semibold text-[#ecab13] bg-[#fff9e6] px-2 py-1 rounded-full mr-2">
                #{index + 1}
              </span>
              <span className="text-xs font-medium text-[#6b6656] bg-[#f3f0e7] px-2 py-1 rounded-full">
                {query.count} {query.count === 1 ? 'time' : 'times'}
              </span>
            </div>
            <p className="font-serif text-lg text-[#1b170d] italic mb-3 leading-relaxed">
              "{query.query}"
            </p>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-[#6b6656] flex items-center">
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                {query.averageResponseTime}ms
              </span>
            </div>
          </div>
          <div className="text-right ml-4">
            <div className={`text-xl font-bold ${
              query.successRate >= 90 ? 'text-[#27ae60]' : 
              query.successRate >= 70 ? 'text-[#f39c12]' : 'text-[#e74c3c]'
            }`}>
              {query.successRate.toFixed(0)}%
            </div>
            <p className="text-xs text-[#6b6656] mt-1 tracking-wide font-medium uppercase">Success Rate</p>
          </div>
        </div>
      </div>
    ))}
    {analytics.popularQueries.length === 0 && (
      <div className="text-center py-12">
        <div className="text-4xl text-[#d4af37] mb-4">💎</div>
        <p className="text-[#6b6656] text-lg font-medium">No queries yet</p>
        <p className="text-sm text-[#6b6656] mt-1">Customer conversations will appear here</p>
      </div>
    )}
  </div>
</div>

          {/* Content Performance */}
          <div className="bg-white rounded-xl shadow-lg p-6 border border-[#f3f0e7]">
            <h2 className="text-2xl font-bold text-[#1b170d] mb-6 flex items-center">
              <span className="bg-[#ecab13] w-3 h-6 rounded-full mr-3"></span>
              Content Performance
            </h2>
            <div className="space-y-4">
              {analytics.contentTypePerformance.slice(0, 6).map((content, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-[#faf9f5] rounded-lg border border-[#f3f0e7]">
                  <div>
                    <p className="font-semibold text-[#1b170d] text-lg capitalize">
                      {content.contentType.replace(/_/g, ' ')}
                    </p>
                    <p className="text-sm text-[#6b6656] mt-1">{content.hitCount} engagements</p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-[#1b170d]">
                      {content.averageResponseTime}ms
                    </div>
                    <p className="text-xs text-[#6b6656]">avg response</p>
                  </div>
                </div>
              ))}
              {analytics.contentTypePerformance.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-4xl text-[#d4af37] mb-4">📦</div>
                  <p className="text-[#6b6656] text-lg">No content data</p>
                  <p className="text-sm text-[#6b6656]">Content engagements will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performance Summary */}
        <div className="bg-white rounded-xl shadow-lg p-8 border border-[#f3f0e7] mb-12">
          <h2 className="text-2xl font-bold text-[#1b170d] mb-8 text-center">
            Performance Overview
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-[#e8f5e8] rounded-lg border border-[#27ae60]">
              <div className="text-4xl font-bold text-[#27ae60] mb-2">{analytics.successfulResponses}</div>
              <p className="text-lg font-semibold text-[#1b170d]">Successful</p>
              <p className="text-sm text-[#6b6656]">Precise answers</p>
            </div>
            <div className="text-center p-6 bg-[#fff9e6] rounded-lg border border-[#f39c12]">
              <div className="text-4xl font-bold text-[#f39c12] mb-2">{analytics.fallbackResponses}</div>
              <p className="text-lg font-semibold text-[#1b170d]">Fallbacks</p>
              <p className="text-sm text-[#6b6656]">Basic responses</p>
            </div>
            <div className="text-center p-6 bg-[#ffebee] rounded-lg border border-[#e74c3c]">
              <div className="text-4xl font-bold text-[#e74c3c] mb-2">{analytics.errorCount}</div>
              <p className="text-lg font-semibold text-[#1b170d]">Errors</p>
              <p className="text-sm text-[#6b6656]">Needs attention</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <div className="bg-[#1b170d] text-[#ecab13] py-4 px-6 rounded-lg inline-block">
            <p className="text-sm font-semibold">
              Last updated: {new Date(analytics.timestamp).toLocaleString()}
            </p>
            <p className="text-xs text-[#d4af37] mt-1">Data refreshes every 10 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;