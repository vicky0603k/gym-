import "@testing-library/jest-dom";
import { vi } from "vitest";

// Next.js ships its own React build with `cache`, and a request-scoped data cache;
// in plain unit tests both are pass-throughs (every call reaches the mocked database).
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
vi.mock("next/cache", () => ({
  unstable_cache: <T,>(fn: T) => fn,
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
}));
