class Metrics {
  private counters: Map<string, { labels: Record<string, string>; value: number }[]> = new Map();
  private histograms: Map<string, { labels: Record<string, string>; values: number[] }[]> = new Map();
  private gauges: Map<string, { labels: Record<string, string>; value: number }[]> = new Map();

  incCounter(name: string, labels: Record<string, string> = {}, value: number = 1) {
    const entries = this.counters.get(name) ?? [];
    const existing = entries.find((e) => JSON.stringify(e.labels) === JSON.stringify(labels));
    if (existing) {
      existing.value += value;
    } else {
      entries.push({ labels, value });
    }
    this.counters.set(name, entries);
  }

  observeHistogram(name: string, labels: Record<string, string> = {}, value: number) {
    const entries = this.histograms.get(name) ?? [];
    const existing = entries.find((e) => JSON.stringify(e.labels) === JSON.stringify(labels));
    if (existing) {
      existing.values.push(value);
    } else {
      entries.push({ labels, values: [value] });
    }
    this.histograms.set(name, entries);
  }

  setGauge(name: string, labels: Record<string, string> = {}, value: number) {
    const entries = this.gauges.get(name) ?? [];
    const existing = entries.find((e) => JSON.stringify(e.labels) === JSON.stringify(labels));
    if (existing) {
      existing.value = value;
    } else {
      entries.push({ labels, value });
    }
    this.gauges.set(name, entries);
  }

  incGauge(name: string, labels: Record<string, string> = {}, value: number = 1) {
    const entries = this.gauges.get(name) ?? [];
    const existing = entries.find((e) => JSON.stringify(e.labels) === JSON.stringify(labels));
    if (existing) {
      existing.value += value;
    } else {
      entries.push({ labels, value });
    }
    this.gauges.set(name, entries);
  }

  decGauge(name: string, labels: Record<string, string> = {}, value: number = 1) {
    this.incGauge(name, labels, -value);
  }

  format(): string {
    const lines: string[] = [];

    for (const [name, entries] of this.counters) {
      lines.push(`# HELP ${name} ${name} counter`);
      lines.push(`# TYPE ${name} counter`);
      for (const entry of entries) {
        const labelStr = Object.entries(entry.labels).map(([k, v]) => `${k}="${v}"`).join(",");
        lines.push(`${name}{${labelStr}} ${entry.value}`);
      }
    }

    for (const [name, entries] of this.histograms) {
      lines.push(`# HELP ${name} ${name} histogram`);
      lines.push(`# TYPE ${name} histogram`);
      const buckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];
      for (const entry of entries) {
        const labelStr = Object.entries(entry.labels).map(([k, v]) => `${k}="${v}"`).join(",");
        let sum = 0;
        let count = 0;
        for (const v of entry.values) {
          sum += v;
          count++;
          for (const b of buckets) {
            if (v <= b) {
              lines.push(`${name}_bucket{le="${b}",${labelStr}} ${entry.values.filter((x) => x <= b).length}`);
            }
          }
        }
        lines.push(`${name}_bucket{le="+Inf",${labelStr}} ${count}`);
        lines.push(`${name}_sum{${labelStr}} ${sum}`);
        lines.push(`${name}_count{${labelStr}} ${count}`);
      }
    }

    for (const [name, entries] of this.gauges) {
      lines.push(`# HELP ${name} ${name} gauge`);
      lines.push(`# TYPE ${name} gauge`);
      for (const entry of entries) {
        const labelStr = Object.entries(entry.labels).map(([k, v]) => `${k}="${v}"`).join(",");
        lines.push(`${name}{${labelStr}} ${entry.value}`);
      }
    }

    return lines.join("\n") + "\n";
  }

  reset() {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }
}

export const metrics = new Metrics();

export function recordHttpRequest(method: string, path: string, status: number, durationMs: number) {
  const cleanPath = path.replace(/\/[0-9a-f-]{36}/g, "/:id").replace(/\/\d+/g, "/:num");
  metrics.incCounter("ecommerce_http_requests_total", { method, path: cleanPath, status: String(status) });
  metrics.observeHistogram("ecommerce_http_request_duration_seconds", { method, path: cleanPath }, durationMs / 1000);
}

export function recordOrderEvent(status: string) {
  metrics.incCounter("ecommerce_orders_total", { status });
}

export function recordPaymentEvent(provider: string, status: string) {
  metrics.incCounter("ecommerce_payments_total", { provider, status });
}

export function recordOutboxEvent(status: string) {
  metrics.incCounter("ecommerce_outbox_events_processed_total", { status });
}

export function setOutboxPending(count: number) {
  metrics.setGauge("ecommerce_outbox_pending", {}, count);
}
