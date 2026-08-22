import { describe, it, expect } from "vitest";
import { stripSuggestionsTag } from "@/hooks/use-chat-streaming";

describe("stripSuggestionsTag", () => {
  it("removes complete <suggestions> tag with JSON array", () => {
    const input = "The answer is here.\n<suggestions>[\"Q1\", \"Q2\"]</suggestions>";
    expect(stripSuggestionsTag(input)).toBe("The answer is here.");
  });

  it("removes follow_up_questions alias", () => {
    const input = "Answer text.<follow_up_questions>[\"Q1\"]</follow_up_questions>";
    expect(stripSuggestionsTag(input)).toBe("Answer text.");
  });

  it("removes truncated closing tag (missing 's')", () => {
    const input = "Answer here.\n<suggestions>[\"Q1\", \"Q2\"]</uggestion";
    expect(stripSuggestionsTag(input)).toBe("Answer here.");
  });

  it("removes unclosed tag at end of message", () => {
    const input = "Answer here.\n<suggestions>[\"Q1\", \"Q2\"]";
    expect(stripSuggestionsTag(input)).toBe("Answer here.");
  });

  it("leaves text without suggestions untouched", () => {
    const input = "Just a plain answer with no tags.";
    expect(stripSuggestionsTag(input)).toBe("Just a plain answer with no tags.");
  });
});
