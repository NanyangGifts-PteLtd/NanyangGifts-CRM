export type BoardSearchColumn = { key: string };

// An empty column array is the database contract for "all columns". Send an
// impossible indexed key when the user explicitly selects none so that state
// cannot silently broaden into an all-field search.
export const NO_BOARD_SEARCH_COLUMN = "__no_board_search_columns__";

export function selectedBoardSearchColumns(
  allColumnsSelected: boolean,
  selectedColumns: ReadonlySet<string>,
  availableColumns: BoardSearchColumn[],
) {
  return allColumnsSelected
    ? new Set(availableColumns.map((column) => column.key))
    : new Set(selectedColumns);
}

export function boardSearchColumnsForQuery(
  allColumnsSelected: boolean,
  selectedColumns: ReadonlySet<string>,
) {
  if (allColumnsSelected) return [];
  if (!selectedColumns.size) return [NO_BOARD_SEARCH_COLUMN];
  return [...selectedColumns].sort();
}

export type SearchColumnSelection = {
  allColumnsSelected: boolean;
  selectedColumns: Set<string>;
};

export function setAllSearchColumns(selected: boolean): SearchColumnSelection {
  return { allColumnsSelected: selected, selectedColumns: new Set() };
}

export function setSearchColumnsSelection(
  current: SearchColumnSelection,
  columnKeys: string[],
  selected: boolean,
  allColumnKeys: string[],
): SearchColumnSelection {
  const next = current.allColumnsSelected
    ? new Set(allColumnKeys)
    : new Set(current.selectedColumns);
  columnKeys.forEach((key) => {
    if (selected) next.add(key);
    else next.delete(key);
  });
  return { allColumnsSelected: false, selectedColumns: next };
}

export function matchesBoardSearchValues(query: string, values: unknown[]) {
  const normalizedQuery = query.trim().toLowerCase();
  return (
    !normalizedQuery ||
    values.some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(normalizedQuery),
    )
  );
}

export function expandedGroupsForSearch(
  groupIds: string[],
  collapsedGroups: Record<string, boolean>,
) {
  if (groupIds.every((id) => !collapsedGroups[id])) return collapsedGroups;
  return {
    ...collapsedGroups,
    ...Object.fromEntries(groupIds.map((id) => [id, false])),
  } as Record<string, boolean>;
}

export function visibleSearchGroups<T extends { clients: unknown[] }>(
  groups: T[],
  searchActive: boolean,
) {
  return searchActive
    ? groups.filter((group) => group.clients.length > 0)
    : groups;
}
