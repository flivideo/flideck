import type { ManifestTemplate, FlideckManifest } from '@flideck/shared';

/**
 * Built-in manifest templates for common presentation structures.
 * These templates provide starting points for agents creating presentations.
 */
export const MANIFEST_TEMPLATES: ManifestTemplate[] = [
  {
    id: 'simple',
    name: 'Simple Presentation',
    description: 'Flat list with no grouping - ideal for small presentations',
    structure: {
      meta: {
        displayMode: 'flat',
      },
      groups: {},
      slides: [],
    },
  },
  {
    id: 'tutorial',
    name: 'Tutorial Series',
    description: 'Grouped by chapter - ideal for step-by-step guides',
    structure: {
      meta: {
        displayMode: 'grouped',
      },
      groups: {
        intro: {
          label: 'Introduction',
          order: 1,
        },
        basics: {
          label: 'Basics',
          order: 2,
        },
        advanced: {
          label: 'Advanced',
          order: 3,
        },
        summary: {
          label: 'Summary',
          order: 4,
        },
      },
      slides: [],
    },
  },
  {
    id: 'persona-tabs',
    name: 'Persona-Based Tabs',
    description: 'Tabbed by persona/audience - ideal for multi-audience content',
    structure: {
      meta: {
        displayMode: 'tabbed',
      },
      groups: {
        developer: {
          label: 'Developer',
          order: 1,
          tab: true,
        },
        designer: {
          label: 'Designer',
          order: 2,
          tab: true,
        },
        manager: {
          label: 'Manager',
          order: 3,
          tab: true,
        },
      },
      slides: [],
    },
  },
  {
    id: 'api-docs',
    name: 'API Documentation',
    description: 'Structured for API reference documentation',
    structure: {
      meta: {
        displayMode: 'grouped',
      },
      groups: {
        overview: {
          label: 'Overview',
          order: 1,
        },
        authentication: {
          label: 'Authentication',
          order: 2,
        },
        endpoints: {
          label: 'Endpoints',
          order: 3,
        },
        examples: {
          label: 'Examples',
          order: 4,
        },
        reference: {
          label: 'Reference',
          order: 5,
        },
      },
      slides: [],
    },
  },
  {
    id: 'component-library',
    name: 'Component Library',
    description: 'Organized for UI component showcases',
    structure: {
      meta: {
        displayMode: 'grouped',
      },
      groups: {
        foundation: {
          label: 'Foundation',
          order: 1,
        },
        components: {
          label: 'Components',
          order: 2,
        },
        patterns: {
          label: 'Patterns',
          order: 3,
        },
        templates: {
          label: 'Templates',
          order: 4,
        },
      },
      slides: [],
    },
  },
];

/**
 * Get all available templates.
 */
export function getTemplates(): ManifestTemplate[] {
  return MANIFEST_TEMPLATES;
}

/**
 * Get a template by ID.
 * @param id - Template ID
 * @returns Template or undefined if not found
 */
export function getTemplateById(id: string): ManifestTemplate | undefined {
  return MANIFEST_TEMPLATES.find((t) => t.id === id);
}

/**
 * Apply a template to an existing manifest.
 * @param currentManifest - Current manifest (can be empty)
 * @param template - Template to apply
 * @param merge - If true, merge with existing; if false, replace
 * @returns New manifest with template applied
 */
export function applyTemplate(
  currentManifest: FlideckManifest | null,
  template: ManifestTemplate,
  merge: boolean = true
): FlideckManifest {
  if (!merge || !currentManifest) {
    // Replace mode - return template structure with current slides
    return {
      ...template.structure,
      slides: currentManifest?.slides || [],
    };
  }

  // Merge mode - combine template groups with existing manifest
  const mergedManifest: FlideckManifest = {
    meta: {
      ...template.structure.meta,
      ...currentManifest.meta,
    },
    groups: {
      ...template.structure.groups,
      ...currentManifest.groups,
    },
    slides: currentManifest.slides || [],
    stats: currentManifest.stats,
  };

  return mergedManifest;
}
