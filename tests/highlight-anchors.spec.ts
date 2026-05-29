import { test, expect } from "@playwright/test";
import { findTextItemRangeForChunk } from "../src/lib/rag/highlight-anchors";

test("finds text item range for a chunk on the same pdf.js item stream", () => {
  const pageItems = [[
    { text: "Machine Learning Fundamentals" },
    { text: "Supervised learning uses labeled training data to learn a mapping from inputs to outputs. Common" },
    { text: "algorithms include linear regression, logistic regression, decision trees, and neural networks." },
    { text: "Unsupervised learning finds patterns in data without labeled examples." },
  ]];

  const range = findTextItemRangeForChunk({
    page: 1,
    text: "Supervised learning uses labeled training data to learn a mapping from inputs to outputs. Common algorithms include linear regression, logistic regression, decision trees",
  }, pageItems);

  expect(range).toEqual({ page: 1, start: 1, end: 3 });
});

test("strips section prefixes when anchoring chunks", () => {
  const pageItems = [[
    { text: "Introduction" },
    { text: "Transfer learning allows models trained on one task to be adapted for different tasks." },
  ]];

  const range = findTextItemRangeForChunk({
    page: 1,
    text: "[Introduction]\nTransfer learning allows models trained on one task to be adapted for different tasks.",
  }, pageItems);

  expect(range).toEqual({ page: 1, start: 1, end: 2 });
});
