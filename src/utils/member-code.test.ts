// @vitest-environment node
import { describe, it, expect } from "vitest";
import { formatMemberCode, gymInitials, memberIdPrefix, parseMemberCode } from "./member-code";

describe("gymInitials", () => {
  it.each([
    ["Fit Life", "FL"],
    ["Iron & Volt Fitness", "IVF"],
    ["The Muscle Factory Gym Club", "TMFG"],
    ["Powerhouse", "PO"],
    ["  gold's   gym  ", "GG"],
    ["24 Seven Fitness", "SF"],
    ["", "GYM"],
    ["123", "GYM"],
  ])("%j → %s", (name, initials) => {
    expect(gymInitials(name)).toBe(initials);
  });
});

describe("memberIdPrefix", () => {
  it("uses the letters the owner chose", () => {
    expect(memberIdPrefix({ member_id_prefix: "FL", gym_name: "Iron Temple" })).toBe("FL");
  });
  it("falls back to the gym's initials when none are set", () => {
    expect(memberIdPrefix({ member_id_prefix: null, gym_name: "Iron Temple" })).toBe("IT");
  });
});

describe("formatMemberCode", () => {
  it("joins the letters and the 6 digits", () => {
    expect(formatMemberCode("FL", 346587)).toBe("FL-346587");
  });
});

describe("parseMemberCode", () => {
  it.each([
    ["FL-346587", 346587],
    ["fl-346587", 346587],
    ["FL346587", 346587],
    [" FL 346587 ", 346587],
    ["346587", 346587],
  ])("reads %j", (input, code) => {
    expect(parseMemberCode(input)).toBe(code);
  });

  it.each(["", "Neha", "34658", "3465871", "099999", "FL-34658", "9876543210", "FL-34-6587"])("ignores %j", (input) => {
    expect(parseMemberCode(input)).toBeNull();
  });
});
