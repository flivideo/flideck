import AjvModule from 'ajv';
import type { ErrorObject } from 'ajv';
import addFormatsModule from 'ajv-formats';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { FlideckManifest } from '@flideck/shared';

// Handle both CommonJS and ESM imports
const Ajv = (AjvModule as any).default || AjvModule;
const addFormats = (addFormatsModule as any).default || addFormatsModule;

// Get current file directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load and cache the JSON Schema
// Try multiple paths to handle both dev (server/ cwd) and prod (root cwd) contexts
const possiblePaths = [
  join(process.cwd(), 'shared/schema/manifest.schema.json'),
  join(__dirname, '../../../shared/schema/manifest.schema.json'),
];

let schemaPath = possiblePaths[0];
for (const path of possiblePaths) {
  if (existsSync(path)) {
    schemaPath = path;
    break;
  }
}

const manifestSchema = JSON.parse(readFileSync(schemaPath, 'utf-8'));

// Configure AJV with formats support
const ajv = new Ajv({
  allErrors: true,
  verbose: true,
  strict: false, // Allow additional properties in stats
});
addFormats(ajv);

// Compile the schema once at startup
const validateManifest = ajv.compile(manifestSchema);

/**
 * Validation result with detailed error information
 */
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
}

/**
 * Structured validation error
 */
export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

/**
 * Validates a manifest object against the JSON Schema
 * @param manifest - The manifest object to validate
 * @returns ValidationResult with errors if invalid
 */
export function validate(manifest: unknown): ValidationResult {
  const valid = validateManifest(manifest);

  if (valid) {
    return { valid: true };
  }

  // Transform AJV errors into structured format
  const errors = (validateManifest.errors || []).map((err: ErrorObject) => ({
    field: err.instancePath || err.params?.missingProperty || 'root',
    message: err.message || 'Validation error',
    value: err.data,
  }));

  return { valid: false, errors };
}

/**
 * Returns the JSON Schema for the manifest
 */
export function getSchema() {
  return manifestSchema;
}

/**
 * Validates and throws if invalid (for use in request handlers)
 */
export function validateOrThrow(manifest: unknown): asserts manifest is FlideckManifest {
  const result = validate(manifest);

  if (!result.valid) {
    const errorMessages = result.errors
      ?.map(e => `${e.field}: ${e.message}`)
      .join(', ');

    throw new Error(`Manifest validation failed: ${errorMessages}`);
  }
}
