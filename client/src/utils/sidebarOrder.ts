import type { Presentation, Asset } from '@flideck/shared';

/**
 * Computes the visual order of assets as displayed in the sidebar.
 * This order is used for keyboard navigation (Cmd+←/→).
 *
 * Order:
 * 1. Index asset (if exists) - only in non-tab mode
 * 2. Root-level assets (no group property)
 * 3. Grouped assets - sorted by group definition order
 *
 * @param presentation The presentation to compute order for
 * @param activeContainerTabId Optional tab ID to filter assets by
 * @returns Assets array in sidebar visual order
 */
export function getSidebarOrder(
  presentation: Presentation | undefined,
  activeContainerTabId?: string | null
): Asset[] {
  if (!presentation) return [];

  const groups = presentation.groups || {};
  const result: Asset[] = [];

  // Build set of tab index filenames to exclude
  const tabIndexFiles = new Set(
    (presentation.tabs || []).map((t) => t.file)
  );

  // Helper: Check if an asset should be included based on active tab
  const shouldIncludeAsset = (asset: Asset): boolean => {
    // Exclude index asset and tab index files
    if (asset.isIndex) return false;
    if (tabIndexFiles.has(asset.filename)) return false;

    // If no active tab, include all
    if (!activeContainerTabId) return true;

    // Ungrouped assets appear in all tabs
    if (!asset.group) return true;

    // Check if asset's group belongs to active tab
    const groupDef = groups[asset.group];
    if (!groupDef) return true; // Unknown group, show it

    // Get effective tabId (inherit from parent if not set directly)
    let effectiveTabId = groupDef.tabId;
    if (!effectiveTabId && groupDef.parent && groups[groupDef.parent]) {
      effectiveTabId = groups[groupDef.parent].tabId;
    }

    // If no tabId (direct or inherited), show in all tabs
    if (!effectiveTabId) return true;

    return effectiveTabId === activeContainerTabId;
  };

  // 1. Index asset first (only in non-tab mode)
  if (!activeContainerTabId) {
    const indexAsset = presentation.assets.find((a) => a.isIndex);
    if (indexAsset) {
      result.push(indexAsset);
    }
  }

  // 2. Root-level assets (no group, excluding index and tab index files)
  const rootAssets = presentation.assets.filter(
    (a) => !a.isIndex && !a.group && !tabIndexFiles.has(a.filename)
  );
  result.push(...rootAssets);

  // 3. Group assets by their group property
  const assetsByGroup = new Map<string, Asset[]>();
  for (const asset of presentation.assets) {
    if (!shouldIncludeAsset(asset)) continue;
    if (!asset.group) continue; // Root assets already added above
    if (!assetsByGroup.has(asset.group)) {
      assetsByGroup.set(asset.group, []);
    }
    assetsByGroup.get(asset.group)!.push(asset);
  }

  // Sort groups by their defined order, filtering by active tab
  const sortedGroupIds = Object.entries(groups)
    .filter(([, def]) => {
      // Skip tab container groups (they're tabs, not sidebar groups)
      if (def.tab) return false;
      // If no active tab, include all groups
      if (!activeContainerTabId) return true;
      // Get effective tabId (inherit from parent if not set directly)
      let effectiveTabId = def.tabId;
      if (!effectiveTabId && def.parent && groups[def.parent]) {
        effectiveTabId = groups[def.parent].tabId;
      }
      // Include groups with no tabId (show in all tabs)
      if (!effectiveTabId) return true;
      // Include groups matching active tab
      return effectiveTabId === activeContainerTabId;
    })
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id]) => id);

  // Add assets from each group in order
  for (const groupId of sortedGroupIds) {
    const groupAssets = assetsByGroup.get(groupId) || [];
    result.push(...groupAssets);
    assetsByGroup.delete(groupId);
  }

  // Add any remaining groups (not defined but referenced by assets)
  const remainingGroups = Array.from(assetsByGroup.keys()).sort();
  for (const groupId of remainingGroups) {
    const groupAssets = assetsByGroup.get(groupId) || [];
    result.push(...groupAssets);
  }

  return result;
}
