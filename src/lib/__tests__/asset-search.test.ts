/**
 * Unit tests for assetNameSearchPredicate (src/lib/asset-search.ts).
 *
 * Story: 6.14 — Asset Search Predicate Extraction
 */

import { describe, it, expect } from "vitest";
import { assetNameSearchPredicate } from "../asset-search";
import type { AssetSummary } from "@zoeplane/shared-types";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeAsset(overrides: Partial<AssetSummary>): AssetSummary {
  return {
    id: "test-id",
    name: "file-name",
    kind: "agent",
    scope: "global",
    path: "/some/path",
    frontMatter: undefined,
    provenance: null,
    ...overrides,
  } as unknown as AssetSummary;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("assetNameSearchPredicate", () => {
  describe("front-matter name takes priority over item.name", () => {
    it("matches against frontMatter.name when both frontMatter.name and item.name are present", () => {
      const asset = makeAsset({
        name: "unrelated-file-name",
        frontMatter: { name: "My Fancy Agent" },
      });
      // term matches frontMatter.name but NOT item.name
      expect(assetNameSearchPredicate(asset, "fancy")).toBe(true);
    });

    it("does not match item.name when frontMatter.name is present and search term only matches item.name", () => {
      const asset = makeAsset({
        name: "unrelated-file-name",
        frontMatter: { name: "My Fancy Agent" },
      });
      // "unrelated" matches item.name, but frontMatter.name takes priority
      expect(assetNameSearchPredicate(asset, "unrelated")).toBe(false);
    });
  });

  describe("falls back to item.name when frontMatter.name is absent or non-string", () => {
    it("uses item.name when frontMatter is undefined", () => {
      const asset = makeAsset({ name: "deploy-pipeline", frontMatter: undefined });
      expect(assetNameSearchPredicate(asset, "deploy")).toBe(true);
    });

    it("uses item.name when frontMatter is null", () => {
      const asset = makeAsset({ name: "deploy-pipeline", frontMatter: null as never });
      expect(assetNameSearchPredicate(asset, "pipeline")).toBe(true);
    });

    it("uses item.name when frontMatter.name is not a string (e.g. number)", () => {
      const asset = makeAsset({
        name: "deploy-pipeline",
        frontMatter: { name: 42 as unknown as string },
      });
      expect(assetNameSearchPredicate(asset, "deploy")).toBe(true);
    });
  });

  describe("case-insensitive matching", () => {
    it("matches when search term is lowercase and name is mixed-case", () => {
      const asset = makeAsset({ frontMatter: { name: "GitHub Actions Workflow" } });
      expect(assetNameSearchPredicate(asset, "github")).toBe(true);
    });

    it("matches when search term is uppercase and name is lowercase", () => {
      const asset = makeAsset({ frontMatter: { name: "deploy agent" } });
      expect(assetNameSearchPredicate(asset, "DEPLOY")).toBe(true);
    });

    it("returns false when term does not match regardless of case", () => {
      const asset = makeAsset({ frontMatter: { name: "Deploy Agent" } });
      expect(assetNameSearchPredicate(asset, "REVIEW")).toBe(false);
    });
  });

  describe("substring (not exact) matching", () => {
    it("matches a partial term within the name", () => {
      const asset = makeAsset({ frontMatter: { name: "Code Review Assistant" } });
      expect(assetNameSearchPredicate(asset, "review")).toBe(true);
    });

    it("returns false when partial term is not a substring of the name", () => {
      const asset = makeAsset({ frontMatter: { name: "Code Review Assistant" } });
      expect(assetNameSearchPredicate(asset, "deploy")).toBe(false);
    });
  });

  describe("empty term", () => {
    it("returns true for all items when term is empty (every string includes empty string)", () => {
      const assetWithFrontMatter = makeAsset({ frontMatter: { name: "Some Agent" } });
      const assetWithoutFrontMatter = makeAsset({ name: "file-name", frontMatter: undefined });
      expect(assetNameSearchPredicate(assetWithFrontMatter, "")).toBe(true);
      expect(assetNameSearchPredicate(assetWithoutFrontMatter, "")).toBe(true);
    });
  });
});
