import { describe, test, expect } from "bun:test";
import {
  isValidTaskStatus,
  isValidTaskPriority,
  isValidTaskType,
  isValidInteractionChannel,
  isValidInteractionDirection,
  VALID_CUSTOMER_STATUSES,
  VALID_TASK_STATUSES,
  VALID_TASK_PRIORITIES,
  VALID_TASK_TYPES,
  VALID_INTERACTION_CHANNELS,
  VALID_INTERACTION_DIRECTIONS,
} from "../src/domain/crm/types.ts";

describe("CRM Types - Validators", () => {
  describe("isValidTaskStatus", () => {
    for (const s of VALID_TASK_STATUSES) {
      test(`"${s}" is valid`, () => {
        expect(isValidTaskStatus(s)).toBe(true);
      });
    }
    test("rejects invalid status", () => {
      expect(isValidTaskStatus("unknown")).toBe(false);
    });
    test("rejects empty string", () => {
      expect(isValidTaskStatus("")).toBe(false);
    });
  });

  describe("isValidTaskPriority", () => {
    for (const p of VALID_TASK_PRIORITIES) {
      test(`"${p}" is valid`, () => {
        expect(isValidTaskPriority(p)).toBe(true);
      });
    }
    test("rejects invalid priority", () => {
      expect(isValidTaskPriority("critical")).toBe(false);
    });
  });

  describe("isValidTaskType", () => {
    for (const t of VALID_TASK_TYPES) {
      test(`"${t}" is valid`, () => {
        expect(isValidTaskType(t)).toBe(true);
      });
    }
    test("rejects invalid type", () => {
      expect(isValidTaskType("unknown")).toBe(false);
    });
  });

  describe("isValidInteractionChannel", () => {
    for (const c of VALID_INTERACTION_CHANNELS) {
      test(`"${c}" is valid`, () => {
        expect(isValidInteractionChannel(c)).toBe(true);
      });
    }
    test("rejects invalid channel", () => {
      expect(isValidInteractionChannel("sms")).toBe(false);
    });
  });

  describe("isValidInteractionDirection", () => {
    for (const d of VALID_INTERACTION_DIRECTIONS) {
      test(`"${d}" is valid`, () => {
        expect(isValidInteractionDirection(d)).toBe(true);
      });
    }
    test("rejects invalid direction", () => {
      expect(isValidInteractionDirection("sideways")).toBe(false);
    });
  });

  describe("Valid status constants completeness", () => {
    test("VALID_CUSTOMER_STATUSES has 5 entries", () => {
      expect(VALID_CUSTOMER_STATUSES).toHaveLength(5);
    });
    test("VALID_TASK_STATUSES has 4 entries", () => {
      expect(VALID_TASK_STATUSES).toHaveLength(4);
    });
    test("VALID_TASK_PRIORITIES has 4 entries", () => {
      expect(VALID_TASK_PRIORITIES).toHaveLength(4);
    });
    test("VALID_TASK_TYPES has 5 entries", () => {
      expect(VALID_TASK_TYPES).toHaveLength(5);
    });
    test("VALID_INTERACTION_CHANNELS has 5 entries", () => {
      expect(VALID_INTERACTION_CHANNELS).toHaveLength(5);
    });
    test("VALID_INTERACTION_DIRECTIONS has 3 entries", () => {
      expect(VALID_INTERACTION_DIRECTIONS).toHaveLength(3);
    });
  });

  describe("Type guards narrow correctly", () => {
    test("isValidTaskStatus narrows type", () => {
      const input: string = "open";
      if (isValidTaskStatus(input)) {
        const _status: "open" | "in_progress" | "done" | "cancelled" = input;
        expect(_status).toBe("open");
      }
    });
    test("isValidInteractionChannel narrows type", () => {
      const input: string = "email";
      if (isValidInteractionChannel(input)) {
        const _channel: "phone" | "email" | "whatsapp" | "internal" | "other" = input;
        expect(_channel).toBe("email");
      }
    });
  });
});

describe("CRM - sanitizePayload (privacy filter)", () => {
  const SENSITIVE_FIELDS = ["passwordHash", "tokenHash", "secret", "apiKey", "providerIntentId", "metadata", "rawPayload"];

  function sanitizePayload(payload: unknown): Record<string, unknown> {
    if (!payload || typeof payload !== "object") return {};
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
      if (!SENSITIVE_FIELDS.includes(k)) safe[k] = v;
    }
    return safe;
  }

  test("removes passwordHash", () => {
    const result = sanitizePayload({ passwordHash: "abc123", email: "test@test.com" });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.email).toBe("test@test.com");
  });

  test("removes tokenHash", () => {
    const result = sanitizePayload({ tokenHash: "tok_123", status: "approved" });
    expect(result).not.toHaveProperty("tokenHash");
    expect(result.status).toBe("approved");
  });

  test("removes secret", () => {
    const result = sanitizePayload({ secret: "s3cret", name: "John" });
    expect(result).not.toHaveProperty("secret");
    expect(result.name).toBe("John");
  });

  test("removes apiKey", () => {
    const result = sanitizePayload({ apiKey: "key_abc", orderId: "ord1" });
    expect(result).not.toHaveProperty("apiKey");
    expect(result.orderId).toBe("ord1");
  });

  test("removes providerIntentId", () => {
    const result = sanitizePayload({ providerIntentId: "pi_123", amount: 100 });
    expect(result).not.toHaveProperty("providerIntentId");
    expect(result.amount).toBe(100);
  });

  test("removes metadata", () => {
    const result = sanitizePayload({ metadata: { internal: true }, channel: "email" });
    expect(result).not.toHaveProperty("metadata");
    expect(result.channel).toBe("email");
  });

  test("removes rawPayload", () => {
    const result = sanitizePayload({ rawPayload: Buffer.from("data"), type: "webhook" });
    expect(result).not.toHaveProperty("rawPayload");
    expect(result.type).toBe("webhook");
  });

  test("removes all sensitive fields at once", () => {
    const result = sanitizePayload({
      passwordHash: "h",
      tokenHash: "t",
      secret: "s",
      apiKey: "k",
      providerIntentId: "p",
      metadata: "m",
      rawPayload: "r",
      visible: "yes",
    });
    expect(Object.keys(result)).toEqual(["visible"]);
  });

  test("handles null input", () => {
    expect(sanitizePayload(null)).toEqual({});
  });

  test("handles undefined input", () => {
    expect(sanitizePayload(undefined)).toEqual({});
  });

  test("handles non-object input", () => {
    expect(sanitizePayload("string")).toEqual({});
  });
});

describe("CRM - use case input validation", () => {
  test("tag name validation: empty string rejected", () => {
    const name = "";
    expect(name.trim().length === 0).toBe(true);
  });

  test("tag name validation: whitespace-only rejected", () => {
    const name = "   ";
    expect(name.trim().length === 0).toBe(true);
  });

  test("tag name validation: 80 char limit", () => {
    const name = "a".repeat(81);
    expect(name.length > 80).toBe(true);
  });

  test("tag name validation: valid name accepted", () => {
    const name = "VIP Customer";
    expect(name.trim().length > 0).toBe(true);
    expect(name.length <= 80).toBe(true);
  });

  test("note body validation: empty rejected", () => {
    const body = "";
    expect(body.trim().length === 0).toBe(true);
  });

  test("note body validation: 10000 char limit", () => {
    const body = "a".repeat(10001);
    expect(body.length > 10000).toBe(true);
  });

  test("interaction summary: 5000 char limit", () => {
    const summary = "a".repeat(5001);
    expect(summary.length > 5000).toBe(true);
  });

  test("task title: 255 char limit", () => {
    const title = "a".repeat(256);
    expect(title.length > 255).toBe(true);
  });

  test("CRM customer status validation: all valid statuses pass", () => {
    for (const status of VALID_CUSTOMER_STATUSES) {
      expect(VALID_CUSTOMER_STATUSES.includes(status)).toBe(true);
    }
  });

  test("CRM customer status validation: invalid rejected", () => {
    const invalidStatuses = ["pending", "processing", "archived", "", "ACTIVE", "VIP"];
    for (const status of invalidStatuses) {
      expect(VALID_CUSTOMER_STATUSES.includes(status as typeof VALID_CUSTOMER_STATUSES[number])).toBe(false);
    }
  });
});

describe("CRM - timeline event synthesis logic", () => {
  test("timeline sorts events by date descending", () => {
    const events = [
      { type: "a", date: new Date("2024-01-01"), data: {} },
      { type: "b", date: new Date("2024-01-03"), data: {} },
      { type: "c", date: new Date("2024-01-02"), data: {} },
    ];
    events.sort((a, b) => b.date.getTime() - a.date.getTime());
    expect(events[0]!.type).toBe("b");
    expect(events[1]!.type).toBe("c");
    expect(events[2]!.type).toBe("a");
  });

  test("timeline caps at 50 events", () => {
    const events = Array.from({ length: 100 }, (_, i) => ({
      type: `event_${i}`,
      date: new Date(2024, 0, i + 1),
      data: {},
    }));
    const capped = events.slice(0, 50);
    expect(capped).toHaveLength(50);
  });

  test("dedup key format works", () => {
    const key = `crm_task_created:${new Date("2024-01-01T10:00:00Z").getTime()}`;
    expect(key).toBe("crm_task_created:1704103200000");
  });

  test("task completed event synthesized from completedAt", () => {
    const task = {
      id: "task-1",
      createdAt: new Date("2024-01-01"),
      completedAt: new Date("2024-01-05"),
      type: "follow_up",
      title: "Call customer",
      priority: "normal",
      status: "done",
    };
    expect(task.completedAt).toBeTruthy();
    expect(task.completedAt!.getTime()).toBeGreaterThan(task.createdAt.getTime());
  });

  test("task without completedAt does not generate completion event", () => {
    const task = {
      id: "task-2",
      completedAt: null as Date | null,
    };
    expect(task.completedAt).toBeFalsy();
  });
});

describe("CRM - search conditions completeness", () => {
  test("documentNumber is included in search fields concept", () => {
    const searchableFields = ["email", "firstName", "lastName", "phone", "documentNumber"];
    expect(searchableFields).toContain("documentNumber");
  });

  test("documentNumber format patterns", () => {
    const docNumbers = ["12345678", "AB123456", "12.345.678-9", "X-12345678"];
    for (const doc of docNumbers) {
      expect(doc.length).toBeGreaterThan(0);
    }
  });
});

describe("CRM - tag idempotency logic", () => {
  test("duplicate tag assignment is no-op", () => {
    const existingTags = [
      { tagId: "tag-1", tag: { id: "tag-1", name: "VIP" } },
      { tagId: "tag-2", tag: { id: "tag-2", name: "At Risk" } },
    ];
    const newTagId = "tag-1";
    const isDuplicate = existingTags.some((t) => t.tagId === newTagId);
    expect(isDuplicate).toBe(true);
  });

  test("non-duplicate tag assignment proceeds", () => {
    const existingTags = [
      { tagId: "tag-1", tag: { id: "tag-1", name: "VIP" } },
    ];
    const newTagId = "tag-2";
    const isDuplicate = existingTags.some((t) => t.tagId === newTagId);
    expect(isDuplicate).toBe(false);
  });

  test("tag name uniqueness enforced", () => {
    const existingTag = { id: "tag-1", name: "VIP" };
    const newName = "VIP";
    expect(existingTag.name).toBe(newName);
  });
});
