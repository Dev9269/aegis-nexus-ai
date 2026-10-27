import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "./store";

describe("auth store", () => {
  beforeEach(() => useAuthStore.setState({ sessionNotice: false }));

  it("tracks an expired-session notice", () => {
    useAuthStore.getState().setSessionNotice(true);
    expect(useAuthStore.getState().sessionNotice).toBe(true);
  });
});
