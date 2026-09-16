export type BoardSearchColumn = { key: string };

export function selectedBoardSearchColumns(
  allColumnsSelected: boolean,
  selectedColumns: ReadonlySet<string>,
  availableColumns: BoardSearchColumn[],
) {
  return allColumnsSelected
    ? new Set(availableColumns.map((column) => column.key))
    : new Set(selectedColumns);
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
  return Object.fromEntries(groupIds.map((id) => [id, false])) as Record<
    string,
    boolean
  >;
}

export function visibleSearchGroups<T extends { clients: unknown[] }>(
  groups: T[],
  searchActive: boolean,
) {
  return searchActive
    ? groups.filter((group) => group.clients.length > 0)
    : groups;
}
