// src/performance-monitor.ts
export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();

  startTimer(label: string): () => void {
    const start = performance.now();
    return () => {
      const duration = performance.now() - start;
      this.recordMetric(label, duration);
    };
  }

  recordMetric(label: string, value: number): void {
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(value);
  }

  getStats(label: string): { avg: number; min: number; max: number; count: number } {
    const values = this.metrics.get(label) || [];
    if (values.length === 0) return { avg: 0, min: 0, max: 0, count: 0 };

    const sum = values.reduce((a, b) => a + b, 0);
    return {
      avg: sum / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length
    };
  }

  logSlowQueries(threshold: number = 1000): void {
    console.log('🐌 Slow queries:');
    for (const [label, values] of this.metrics) {
      const slowCount = values.filter(v => v > threshold).length;
      if (slowCount > 0) {
        console.log(`  ${label}: ${slowCount} slow calls`);
      }
    }
  }
}

// Use in your chat agent
const perfMonitor = new PerformanceMonitor();

// Wrap expensive operations
const endTimer = perfMonitor.startTimer('sendMessage');
// ... your code ...
endTimer();