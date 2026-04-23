import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("returns a single class unchanged", () => {
    expect(cn("foo")).toBe("foo");
  });

  it("merges multiple classes", () => {
    expect(cn("foo", "bar")).toBe("foo bar");
  });

  it("resolves tailwind conflicts, keeping the last value", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  it("handles conditional classes via boolean short-circuit", () => {
    expect(cn("base", false && "hidden", "active")).toBe("base active");
  });

  it("handles object syntax", () => {
    expect(cn({ "text-red-500": true, "text-blue-500": false })).toBe("text-red-500");
  });

  it("handles array syntax", () => {
    expect(cn(["foo", "bar"])).toBe("foo bar");
  });

  it("handles empty input", () => {
    expect(cn()).toBe("");
  });

  it("filters out undefined and null entries", () => {
    expect(cn("foo", undefined, null, "bar")).toBe("foo bar");
  });

  it("merges responsive tailwind variants correctly", () => {
    expect(cn("md:p-2", "md:p-4")).toBe("md:p-4");
  });
});
