import { describe, expect, it } from "vitest";
import {
  formatPercent,
  humanizeAction,
  initials,
  riskTone,
  titleCase,
  truncateId,
} from "./utils";

describe("riskTone", () => {
  it("maps score bands to the four risk categories", () => {
    expect(riskTone(0)).toBe("LOW");
    expect(riskTone(29.9)).toBe("LOW");
    expect(riskTone(30)).toBe("MEDIUM");
    expect(riskTone(54.9)).toBe("MEDIUM");
    expect(riskTone(55)).toBe("HIGH");
    expect(riskTone(79.9)).toBe("HIGH");
    expect(riskTone(80)).toBe("CRITICAL");
    expect(riskTone(100)).toBe("CRITICAL");
  });
});

describe("format helpers", () => {
  it("formats labels and identifiers", () => {
    expect(titleCase("SECURITY_ADMIN")).toBe("Security Admin");
    expect(initials("Maya Chen")).toBe("MC");
    expect(initials("  Avery   Cole  ")).toBe("AC");
    expect(humanizeAction("READ_SENSITIVE")).toBe("Read Sensitive");
    expect(truncateId("0123456789abcdef", 8)).toBe("01234567…");
    expect(truncateId(null)).toBe("—");
  });

  it("formats percentages without re-scaling backend values", () => {
    expect(formatPercent(50)).toBe("50%");
    expect(formatPercent(0.907, 2)).toBe("0.91%");
  });
});
