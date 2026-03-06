import type { Presentation, DisplayMode, GroupDefinition } from '@flideck/shared';

/**
 * Detect the appropriate display mode based on slide count and group structure
 */
export function detectDisplayMode(presentation: Presentation | null | undefined): DisplayMode {
  if (!presentation) return 'flat';

  // Check for explicit displayMode in manifest
  if (presentation.meta?.displayMode) {
    return presentation.meta.displayMode;
  }

  const slideCount = presentation.assets.length;
  const groupCount = Object.keys(presentation.groups || {}).length;
  const hasTabGroups = Object.values(presentation.groups || {}).some((g: GroupDefinition) => g.tab);

  // FR-25: If container tabs exist, use grouped if groups exist, otherwise flat
  const hasContainerTabs = presentation.tabs && presentation.tabs.length > 0;
  if (hasContainerTabs) {
    return groupCount > 0 ? 'grouped' : 'flat';
  }

  // Use grouped for large presentations or when tab groups exist
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
    default:
      return mode;
  }
}
