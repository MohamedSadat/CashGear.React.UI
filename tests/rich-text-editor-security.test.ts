import { describe, expect, it } from 'vitest';
import { safeUrl, sanitize } from '../src/vendor/rich-text-editor/editor.js';

describe('rich-text editor content boundary', () => {
  it('retains supported structure and safe styles while removing executable content', () => {
    const html = sanitize('<h2 dir="rtl" onclick="alert(1)" style="color: rgb(1, 2, 3); position:fixed; background-image:url(x)">Title</h2><script>alert(1)</script><iframe src="https://bad"></iframe><p><strong>Safe</strong></p>');
    expect(html).toContain('<h2 dir="rtl" style="color: rgb(1, 2, 3);">Title</h2>');
    expect(html).toContain('<strong>Safe</strong>');
    expect(html).not.toMatch(/script|iframe|onclick|position|background-image/i);
  });

  it('enforces separate link and image URL policies', () => {
    expect(safeUrl('https://example.com/a')).toBe(true);
    expect(safeUrl('/images/a.png', true)).toBe(true);
    expect(safeUrl('mailto:team@example.com')).toBe(true);
    expect(safeUrl('tel:+2012345')).toBe(true);
    expect(safeUrl('mailto:team@example.com', true)).toBe(false);
    for (const value of ['http://example.com', '//example.com/a', 'javascript:alert(1)', 'data:image/png;base64,abc', 'https:\\example.com']) {
      expect(safeUrl(value, true)).toBe(false);
    }
    const cleaned = sanitize('<a href="javascript:alert(1)" target="_blank">bad</a><a href="https://example.com">good</a><img src="data:image/png;base64,abc"><img src="/safe.png" onerror="x">');
    expect(cleaned).toContain('<a rel="noopener noreferrer">bad</a>');
    expect(cleaned).toContain('href="https://example.com"');
    expect(cleaned).toContain('src="/safe.png"');
    expect(cleaned).not.toMatch(/data:image|onerror|target=/i);
  });
});
