import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast, useToastStore } from "./store";

describe("toast store", () => {
  beforeEach(() => {
    useToastStore.setState({ items: [] });
    vi.useFakeTimers();
  });

  it("caps visible toasts and removes them after five seconds", () => {
    toast.info("one");
    toast.info("two");
    toast.info("three");
    toast.info("four");
    toast.info("five");
    expect(useToastStore.getState().items).toHaveLength(4);
    vi.advanceTimersByTime(5200);
    expect(useToastStore.getState().items).toHaveLength(0);
    vi.useRealTimers();
  });
});
