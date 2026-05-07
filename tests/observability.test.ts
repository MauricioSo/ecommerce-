import { describe, test, expect, beforeEach } from "bun:test";
import { createLogger, runWithContext, getCorrelationId } from "../src/shared/infrastructure/logger/index.ts";
import { metrics, recordHttpRequest, recordOrderEvent, recordPaymentEvent, recordOutboxEvent, setOutboxPending } from "../src/shared/infrastructure/metrics.ts";

describe("Logger", () => {
  test("correlation ID propagates via AsyncLocalStorage", () => {
    runWithContext({ correlationId: "test-123" }, () => {
      expect(getCorrelationId()).toBe("test-123");
    });
    expect(getCorrelationId()).toBeUndefined();
  });

  test("nested context preserves correlation ID", () => {
    runWithContext({ correlationId: "outer" }, () => {
      expect(getCorrelationId()).toBe("outer");
      runWithContext({ correlationId: "inner" }, () => {
        expect(getCorrelationId()).toBe("inner");
      });
      expect(getCorrelationId()).toBe("outer");
    });
  });

  test("logger includes correlation ID in output", () => {
    const lines: string[] = [];
    const origLog = console.log;
    console.log = (line: string) => lines.push(line);
    try {
      const logger = createLogger("debug");
      runWithContext({ correlationId: "corr-abc" }, () => {
        logger.info("test message", { key: "value" });
      });
      expect(lines.length).toBe(1);
      const parsed = JSON.parse(lines[0]!);
      expect(parsed.correlationId).toBe("corr-abc");
      expect(parsed.message).toBe("test message");
      expect(parsed.key).toBe("value");
    } finally {
      console.log = origLog;
    }
  });

  test("logger without context omits correlationId", () => {
    const lines: string[] = [];
    const origLog = console.log;
    console.log = (line: string) => lines.push(line);
    try {
      const logger = createLogger("debug");
      logger.info("no context");
      const parsed = JSON.parse(lines[0]!);
      expect(parsed.correlationId).toBeUndefined();
    } finally {
      console.log = origLog;
    }
  });

  test("info level filters debug", () => {
    const lines: string[] = [];
    const origLog = console.log;
    console.log = (line: string) => lines.push(line);
    try {
      const logger = createLogger("info");
      logger.debug("should not appear");
      logger.info("should appear");
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]!).message).toBe("should appear");
    } finally {
      console.log = origLog;
    }
  });

  test("error logs to stderr", () => {
    const lines: string[] = [];
    const origErr = console.error;
    console.error = (line: string) => lines.push(line);
    try {
      const logger = createLogger("error");
      logger.info("should not appear");
      logger.error("should appear");
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]!).message).toBe("should appear");
    } finally {
      console.error = origErr;
    }
  });

  test("warn logs to stderr via console.warn", () => {
    const lines: string[] = [];
    const origWarn = console.warn;
    console.warn = (line: string) => lines.push(line);
    try {
      const logger = createLogger("warn");
      logger.info("should not appear");
      logger.warn("should appear");
      expect(lines.length).toBe(1);
      expect(JSON.parse(lines[0]!).message).toBe("should appear");
    } finally {
      console.warn = origWarn;
    }
  });
});

describe("Metrics", () => {
  beforeEach(() => {
    metrics.reset();
  });

  test("counter increments", () => {
    metrics.incCounter("test_counter", { label: "a" });
    metrics.incCounter("test_counter", { label: "a" });
    metrics.incCounter("test_counter", { label: "b" });
    const output = metrics.format();
    expect(output).toContain("test_counter");
    expect(output).toContain("test_counter{label=\"a\"} 2");
    expect(output).toContain("test_counter{label=\"b\"} 1");
  });

  test("gauge sets value", () => {
    metrics.setGauge("test_gauge", {}, 42);
    metrics.setGauge("test_gauge", {}, 99);
    const output = metrics.format();
    expect(output).toContain("test_gauge{} 99");
  });

  test("gauge inc/dec", () => {
    metrics.incGauge("test_gauge", {}, 5);
    metrics.decGauge("test_gauge", {}, 2);
    const output = metrics.format();
    expect(output).toContain("test_gauge{} 3");
  });

  test("histogram records observations", () => {
    metrics.observeHistogram("test_hist", { method: "GET" }, 0.1);
    metrics.observeHistogram("test_hist", { method: "GET" }, 0.5);
    const output = metrics.format();
    expect(output).toContain("test_hist_count{method=\"GET\"} 2");
    expect(output).toContain("test_hist_sum{method=\"GET\"} 0.6");
  });

  test("format output is valid Prometheus text", () => {
    metrics.incCounter("http_requests", { method: "GET", status: "200" });
    const output = metrics.format();
    expect(output).toContain("# HELP http_requests http_requests counter");
    expect(output).toContain("# TYPE http_requests counter");
    expect(output).toContain('http_requests{method="GET",status="200"} 1');
  });

  test("reset clears all metrics", () => {
    metrics.incCounter("a", {});
    metrics.setGauge("b", {}, 1);
    metrics.observeHistogram("c", {}, 1);
    metrics.reset();
    const output = metrics.format();
    expect(output.trim()).toBe("");
  });

  test("recordHttpRequest normalizes path with UUIDs", () => {
    recordHttpRequest("GET", "/admin/orders/550e8400-e29b-41d4-a716-446655440000", 200, 50);
    const output = metrics.format();
    expect(output).toContain('path="/admin/orders/:id"');
  });

  test("recordHttpRequest normalizes numeric IDs", () => {
    recordHttpRequest("GET", "/products/123/reviews", 200, 30);
    const output = metrics.format();
    expect(output).toContain('path="/products/:num/reviews"');
  });

  test("recordOrderEvent increments counter", () => {
    recordOrderEvent("created");
    const output = metrics.format();
    expect(output).toContain("ecommerce_orders_total{status=\"created\"} 1");
  });

  test("recordPaymentEvent increments counter", () => {
    recordPaymentEvent("webpay", "approved");
    const output = metrics.format();
    expect(output).toContain("ecommerce_payments_total{provider=\"webpay\",status=\"approved\"} 1");
  });

  test("recordOutboxEvent increments counter", () => {
    recordOutboxEvent("completed");
    recordOutboxEvent("failed");
    const output = metrics.format();
    expect(output).toContain("ecommerce_outbox_events_processed_total{status=\"completed\"} 1");
    expect(output).toContain("ecommerce_outbox_events_processed_total{status=\"failed\"} 1");
  });

  test("setOutboxPending sets gauge", () => {
    setOutboxPending(7);
    const output = metrics.format();
    expect(output).toContain("ecommerce_outbox_pending{} 7");
  });

  test("recordHttpRequest records duration in seconds", () => {
    recordHttpRequest("POST", "/checkout", 200, 250);
    const output = metrics.format();
    expect(output).toContain("ecommerce_http_request_duration_seconds");
    expect(output).toContain("0.25");
  });
});
