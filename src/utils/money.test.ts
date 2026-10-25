// @vitest-environment node
import { describe, it, expect } from "vitest";
import { gstIncluded } from "./money";

describe("gstIncluded", () => {
  it.each([
    [1180, 1000, 180],
    [1000, 847, 153],
    [2250, 1907, 343],
    [0, 0, 0],
  ])("₹%i → taxable ₹%i + GST ₹%i, adding back to the total", (amount, taxable, gst) => {
    expect(gstIncluded(amount)).toEqual({ taxable, gst });
    expect(taxable + gst).toBe(amount);
  });
});
