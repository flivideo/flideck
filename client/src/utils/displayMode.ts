import type { Presentation, DisplayMode, GroupDefinition } from '@flideck/shared';

/**
 * Detect the appropriate display mode based on slide count and group structure
 */
export function detectDisplayMode(presentation: Presentation | null | undefined): DisplayMode {
  if (!presentation) return 'flat';

  // Check for explicit displayMode in manifest
  // BUG-5: Fall back to 'grouped' if manifest specifies obsolete 'tabbed' mode
  if (presentation.meta?.displayMode) {
    if (presentation.meta.displayMode === 'tabbed') {
      // Tabbed mode is obsolete (FR-24) - fall back to grouped
      return 'grouped';
    }
    return presentation.meta.displayMode;
  }

  const slideCount = presentation.assets.length;
  const groupCount = Object.keys(presentation.groups || {}).length;
  const hasTabGroups = Object.values(presentation.groups || {}).some((g: GroupDefinition) => g.tab);

  // BUG-5: Sidebar 'tabbed' mode is obsolete (removed in FR-24)
  // Container tabs replaced sidebar tabs. Never return 'tabbed' from auto-detection.
  // If user explicitly sets displayMode: 'tabbed' in manifest, fall back to 'grouped'

  // FR-25: If container tabs exist, never use 'tabbed' mode (container tabs handle tab UI)
  const hasContainerTabs = presentation.tabs && presentation.tabs.length > 0;
  if (hasContainerTabs) {
    // Use grouped if groups exist, otherwise flat
    return groupCount > 0 ? 'grouped' : 'flat';
  }

  // BUG-5 Fix: Never return 'tabbed' - it's obsolete
  // Old logic was: if (hasTabGroups || slideCount > 50) return 'tabbed'
  // New logic: Use grouped for large presentations or when tab groups exist
  if (hasTabGroups || slideCount > 50) {
    return groupCount > 0 ? 'grouped' : 'flat';
  }

  if (groupCount > 0 && slideCount > 15) {
    return 'grouped';
  }

  return 'flat';
}

/**
 * Get display mode label for UI
 */
export function getDisplayModeLabel(mode: DisplayMode): string {
  switch (mode) {
    case 'flat':
      return 'Flat List';
    case 'grouped':
      return 'Grouped';
    case 'tabbed':
      return 'Tabbed';
  }
}

/**
 * Check if a presentation has any tab groups defined
 */
export function hasTabGroups(presentation: Presentation | null | undefined): boolean {
  if (!presentation?.groups) return false;
  return Object.values(presentation.groups).some((g: GroupDefinition) => g.tab);
}

/**
 * Get tab groups (groups with tab: true)
 */
export function getTabGroups(presentation: Presentation | null | undefined): Array<{ id: string; def: GroupDefinition }> {
  if (!presentation?.groups) return [];

  return Object.entries(presentation.groups)
    .filter(([, def]) => def.tab)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, def]) => ({ id, def }));
}

/**
 * Get child groups for a parent tab
 */
export function getChildGroups(
  presentation: Presentation | null | undefined,
  parentId: string
): Array<{ id: string; def: GroupDefinition }> {
  if (!presentation?.groups) return [];

  return Object.entries(presentation.groups)
    .filter(([, def]) => def.parent === parentId)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, def]) => ({ id, def }));
}

/**
 * Get orphan groups (groups without parent and not tabs themselves)
 */
export function getOrphanGroups(presentation: Presentation | null | undefined): Array<{ id: string; def: GroupDefinition }> {
  if (!presentation?.groups) return [];

  return Object.entries(presentation.groups)
    .filter(([, def]) => !def.tab && !def.parent)
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([id, def]) => ({ id, def }));
}
