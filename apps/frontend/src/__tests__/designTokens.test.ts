import { describe, it, expect } from 'vitest';
// @ts-expect-error - Tailwind config is a JS file
import tailwindConfig from '../../tailwind.config.js';
import resolveConfig from 'tailwindcss/resolveConfig';

describe('Design Tokens', () => {
  const fullConfig = resolveConfig(tailwindConfig);

  it('should have primary color palette defined', () => {
    const colors = fullConfig.theme['colors'] as Record<string, Record<string, string>>;
    expect(colors['primary']).toBeDefined();
    expect(colors['primary']?.['600']).toBe('#0284c7');
  });

  it('should have secondary color palette defined', () => {
    const colors = fullConfig.theme['colors'] as Record<string, Record<string, string>>;
    expect(colors['secondary']).toBeDefined();
    expect(colors['secondary']?.['600']).toBe('#475569');
  });

  it('should have success, warning, and danger colors defined', () => {
    const colors = fullConfig.theme['colors'] as Record<string, unknown>;
    expect(colors['success']).toBeDefined();
    expect(colors['warning']).toBeDefined();
    expect(colors['danger']).toBeDefined();
  });

  it('should have glass effect background colors', () => {
    const colors = fullConfig.theme['colors'] as Record<string, Record<string, string>>;
    expect(colors['glass']).toBeDefined();
    expect(colors['glass']?.['white']).toBe('rgba(255, 255, 255, 0.75)');
  });

  it('should have extended spacing values', () => {
    const spacing = fullConfig.theme['spacing'] as Record<string, string>;
    expect(spacing['18']).toBe('4.5rem');
    expect(spacing['88']).toBe('22rem');
    expect(spacing['100']).toBe('25rem');
    expect(spacing['112']).toBe('28rem');
    expect(spacing['128']).toBe('32rem');
  });

  it('should have custom glass shadows', () => {
    const boxShadow = fullConfig.theme['boxShadow'] as Record<string, string>;
    expect(boxShadow['glass']).toBeDefined();
    expect(boxShadow['glass-lg']).toBeDefined();
  });

  it('should have extended backdrop blur', () => {
    const backdropBlur = fullConfig.theme['backdropBlur'] as Record<string, string>;
    expect(backdropBlur['xs']).toBe('2px');
  });
});
