/**
 * Playwright Script Transformer
 *
 * Automatically fixes common issues with Playwright scripts generated via `playwright codegen`.
 * The main issue is autocomplete/dropdown interactions that are timing-sensitive and often fail.
 *
 * Transformations applied:
 * 1. Replace `getByRole('option', { name: '...' }).click()` with keyboard Enter
 * 2. Replace `getByRole('listbox').getByRole('option', ...).click()` with keyboard Enter
 * 3. Add small waits after fill() calls that precede option clicks
 */

/**
 * Transform a Playwright script to fix common autocomplete issues
 */
export function transformPlaywrightScript(script: string): string {
  if (!script) return script;

  console.log('[PlaywrightTransformer] Input script length:', script.length);
  console.log('[PlaywrightTransformer] Script preview:', script.substring(0, 500));

  let transformed = script;

  // Pattern 1: Direct option click - page.getByRole('option', { name: '...' }).click()
  // This pattern is often used after typing in an autocomplete field
  // Replace with keyboard Enter press
  // Made more flexible: handles any spacing, quotes, and object content
  const pattern1 = /await\s+page\.getByRole\(\s*['"`]option['"`]\s*,\s*\{[^}]*\}\s*\)\.click\(\s*\)\s*;?/g;
  const matches1 = script.match(pattern1);
  console.log('[PlaywrightTransformer] Pattern 1 matches:', matches1);
  transformed = transformed.replace(
    pattern1,
    'await page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\');'
  );

  // Pattern 2: Nested option click - .getByRole('listbox').getByRole('option', ...).click()
  const pattern2 = /await\s+page\.getByRole\(\s*['"`]listbox['"`]\s*\)\.getByRole\(\s*['"`]option['"`]\s*,\s*\{[^}]*\}\s*\)\.click\(\s*\)\s*;?/g;
  const matches2 = script.match(pattern2);
  console.log('[PlaywrightTransformer] Pattern 2 matches:', matches2);
  transformed = transformed.replace(
    pattern2,
    'await page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\');'
  );

  // Pattern 3: Locator chained option click - locator.getByRole('option', ...).click()
  // This catches things like: page.locator('...').getByRole('option', ...).click()
  const pattern3 = /\.getByRole\(\s*['"`]option['"`]\s*,\s*\{[^}]*\}\s*\)\.click\(\s*\)/g;
  const matches3 = script.match(pattern3);
  console.log('[PlaywrightTransformer] Pattern 3 matches:', matches3);
  transformed = transformed.replace(
    pattern3,
    ';\nawait page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\')'
  );

  // Pattern 4: getByText on options/suggestions (common in autocomplete)
  // e.g., page.getByText('demo').click() when selecting from suggestions
  // Only transform if it looks like an autocomplete selection (single word, after a fill)
  // This is more conservative - only transform if the text looks like a suggestion
  transformed = transformed.replace(
    /await\s+page\.locator\(\s*['"]\.autocomplete[^'"]*['"]\s*\)\.getByText\([^)]+\)\.click\(\s*\)\s*;?/g,
    'await page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\');'
  );

  // Pattern 5: Click on combobox option
  transformed = transformed.replace(
    /await\s+page\.getByRole\(\s*['"]combobox['"]\s*\)\.getByRole\(\s*['"]option['"]\s*,\s*\{[^}]*\}\s*\)\.click\(\s*\)\s*;?/g,
    'await page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\');'
  );

  // Pattern 6: First() on option and click
  transformed = transformed.replace(
    /await\s+page\.getByRole\(\s*['"]option['"]\s*,\s*\{[^}]*\}\s*\)\.first\(\s*\)\.click\(\s*\)\s*;?/g,
    'await page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\');'
  );

  // Pattern 7: nth() on option and click
  transformed = transformed.replace(
    /await\s+page\.getByRole\(\s*['"]option['"]\s*,\s*\{[^}]*\}\s*\)\.nth\(\s*\d+\s*\)\.click\(\s*\)\s*;?/g,
    'await page.waitForTimeout(500);\nawait page.keyboard.press(\'Enter\');'
  );

  // Clean up any double awaits or malformed statements that might have been created
  transformed = transformed.replace(/await\s+await/g, 'await');

  // Clean up any empty lines created by replacements (more than 2 consecutive newlines)
  transformed = transformed.replace(/\n{3,}/g, '\n\n');

  return transformed;
}

/**
 * Check if script contains autocomplete patterns that were transformed
 */
export function hasAutocompletePatterns(script: string): boolean {
  const patterns = [
    /getByRole\(\s*['"]option['"]/,
    /getByRole\(\s*['"]listbox['"]\)\.getByRole\(\s*['"]option['"]/,
    /getByRole\(\s*['"]combobox['"]\)\.getByRole\(\s*['"]option['"]/,
  ];

  return patterns.some(pattern => pattern.test(script));
}

/**
 * Get transformation info for logging purposes
 */
export function getTransformationInfo(originalScript: string, transformedScript: string): {
  wasTransformed: boolean;
  patternsReplaced: number;
} {
  const wasTransformed = originalScript !== transformedScript;

  // Count how many keyboard.press('Enter') were added (rough estimate)
  const originalEnterCount = (originalScript.match(/keyboard\.press\(['"]Enter['"]\)/g) || []).length;
  const transformedEnterCount = (transformedScript.match(/keyboard\.press\(['"]Enter['"]\)/g) || []).length;

  return {
    wasTransformed,
    patternsReplaced: transformedEnterCount - originalEnterCount,
  };
}
