import type { Presentation, Asset } from '@flideck/shared';

/**
 * Computes the visual order of assets as displayed in the sidebar.
 * This order is used for keyboard navigation (Cmd+←/→).
 *
 * Order:
 * 1. Index asset (if exists)
 * 2. Root-level assets (no group property)
 * 3. Grouped assets - sorted by group definition order
 *
 * @param presentation The presentation to compute order for
 * @returns Assets array in sidebar visual order
 */
export function getSidebarOrder(presentation: Presentation | undefined): Asset[] {
  if (!presentation) return [];

  const groups = presentation.groups || {};
  const result: Asset[] = [];

  // 1. Index asset first
  const indexAsset = presentation.assets.find((a) => a.isIndex);
  if (indexAsset) {
    result.push(indexAsset);
  }

  // 2. Root-level assets (no group, excluding index)
  const rootAssets = presentation.assets.filter((a) => !a.isIndex && !a.group);
  result.push(...rootAssets);

  // 3. Group assets by their group property
  const assetsByGroup = new Map<string, Asset[]>();
  for (const asset of presentation.assets) {
    if (asset.isIndex || !asset.group) continue;
    if (!assetsByGroup.has(asset.group)) {
      assetsByGroup.set(asset.group, []);
    }
    assetsByGroup.get(asset.group)!.push(asset);
  }

  // Sort groups by their defined order
  const sortedGroupIds = Object.entries(groups)
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
