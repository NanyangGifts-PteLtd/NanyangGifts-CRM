import { describe, expect, it } from "vitest";
import {
  expandedGroupsForSearch,
  matchesBoardSearchValues,
  selectedBoardSearchColumns,
  setAllSearchColumns,
  setSearchColumnsSelection,
  visibleSearchGroups,
} from "./board-search";

describe("board search helpers", () => {
  it("matches case-insensitively and ignores empty values", () => {
    expect(matchesBoardSearchValues("acme", [null, "ACME Gifts"])).toBe(true);
    expect(matchesBoardSearchValues("acme", ["Different client"])).toBe(false);
  });

  it("uses every column when All columns is enabled, otherwise only selected columns", () => {
    const columns = [{ key: "client:name" }, { key: "subitem:name" }];
    expect([...selectedBoardSearchColumns(true, new Set(), columns)]).toEqual([
      "client:name",
      "subitem:name",
    ]);
    expect([
      ...selectedBoardSearchColumns(false, new Set(["subitem:name"]), columns),
    ]).toEqual(["subitem:name"]);
  });

  it("supports deselecting all columns and selecting a category afterwards", () => {
    const noneSelected = setAllSearchColumns(false);
    expect(noneSelected).toEqual({
      allColumnsSelected: false,
      selectedColumns: new Set(),
    });
    expect(
      setSearchColumnsSelection(
        noneSelected,
        ["subitem:name", "subitem:status"],
        true,
        ["client:name", "subitem:name", "subitem:status"],
      ),
    ).toEqual({
      allColumnsSelected: false,
      selectedColumns: new Set(["subitem:name", "subitem:status"]),
    });
  });

  it("turns an All columns selection into explicit choices before deselecting one", () => {
    expect(
      setSearchColumnsSelection(
        setAllSearchColumns(true),
        ["client:name"],
        false,
        ["client:name", "subitem:name"],
      ),
    ).toEqual({
      allColumnsSelected: false,
      selectedColumns: new Set(["subitem:name"]),
    });
  });

  it("expands all groups during a search and preserves an already-expanded state", () => {
    expect(expandedGroupsForSearch(["a", "b"], { a: true, b: false })).toEqual({
      a: false,
      b: false,
    });
    const alreadyExpanded = { a: false, b: false };
    expect(expandedGroupsForSearch(["a", "b"], alreadyExpanded)).toBe(
      alreadyExpanded,
    );
  });

  it("hides only empty groups while a search is active", () => {
    const groups = [{ clients: ["match"] }, { clients: [] }];
    expect(visibleSearchGroups(groups, true)).toEqual([{ clients: ["match"] }]);
    expect(visibleSearchGroups(groups, false)).toEqual(groups);
  });
});
