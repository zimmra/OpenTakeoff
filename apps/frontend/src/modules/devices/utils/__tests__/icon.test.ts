/**
 * Icon Utilities Tests
 * Tests for icon configuration parsing, serialization, and MDI icon utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseIconKey,
  serializeIconConfig,
  getMdiIconPath,
  getAllMdiIcons,
  DEFAULT_ICON_CATEGORIES,
  ICON_MODIFIERS,
  type IconConfig,
} from '../icon';

describe('parseIconKey', () => {
  describe('with null or undefined', () => {
    it('should return null for null input', () => {
      expect(parseIconKey(null)).toBeNull();
    });

    it('should return null for undefined input', () => {
      expect(parseIconKey(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseIconKey('')).toBeNull();
    });
  });

  describe('with JSON config', () => {
    it('should parse valid JSON IconConfig', () => {
      const config: IconConfig = {
        provider: 'mdi',
        name: 'ceiling-light',
      };
      const result = parseIconKey(JSON.stringify(config));

      expect(result).toEqual(config);
    });

    it('should parse JSON with all properties', () => {
      const config: IconConfig = {
        provider: 'mdi',
        name: 'ceiling-light',
        modifier: 'signal-variant',
        modPos: 'top-right',
        flip: true,
        flipX: true,
        flipY: false,
        modFlipX: true,
        modFlipY: false,
        text: 'A',
        textPos: 'sub',
        modX: 10,
        modY: -5,
        textX: 0,
        textY: 0,
      };
      const result = parseIconKey(JSON.stringify(config));

      expect(result).toEqual(config);
    });

    it('should return Tabler config for invalid JSON', () => {
      const result = parseIconKey('{invalid json}');

      expect(result).toEqual({
        provider: 'tabler',
        name: '{invalid json}',
      });
    });

    it('should return Tabler config for JSON without required fields', () => {
      const result = parseIconKey(JSON.stringify({ foo: 'bar' }));

      expect(result).toEqual({
        provider: 'tabler',
        name: '{"foo":"bar"}',
      });
    });
  });

  describe('with legacy Tabler key', () => {
    it('should create Tabler config for plain string', () => {
      const result = parseIconKey('IconHome');

      expect(result).toEqual({
        provider: 'tabler',
        name: 'IconHome',
      });
    });

    it('should create Tabler config for any non-JSON string', () => {
      const result = parseIconKey('some-icon-name');

      expect(result).toEqual({
        provider: 'tabler',
        name: 'some-icon-name',
      });
    });
  });
});

describe('serializeIconConfig', () => {
  it('should return just the name for simple Tabler icon', () => {
    const config: IconConfig = {
      provider: 'tabler',
      name: 'IconHome',
    };

    expect(serializeIconConfig(config)).toBe('IconHome');
  });

  it('should return JSON for Tabler icon with modifier', () => {
    const config: IconConfig = {
      provider: 'tabler',
      name: 'IconHome',
      modifier: 'signal',
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });

  it('should return JSON for Tabler icon with flip', () => {
    const config: IconConfig = {
      provider: 'tabler',
      name: 'IconHome',
      flip: true,
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });

  it('should return JSON for Tabler icon with flipX', () => {
    const config: IconConfig = {
      provider: 'tabler',
      name: 'IconHome',
      flipX: true,
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });

  it('should return JSON for Tabler icon with flipY', () => {
    const config: IconConfig = {
      provider: 'tabler',
      name: 'IconHome',
      flipY: true,
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });

  it('should return JSON for Tabler icon with text', () => {
    const config: IconConfig = {
      provider: 'tabler',
      name: 'IconHome',
      text: 'A',
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });

  it('should return JSON for MDI icon', () => {
    const config: IconConfig = {
      provider: 'mdi',
      name: 'ceiling-light',
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });

  it('should return JSON for complex config', () => {
    const config: IconConfig = {
      provider: 'mdi',
      name: 'ceiling-light',
      modifier: 'signal-variant',
      modPos: 'bottom-right',
      text: 'B',
      textPos: 'super',
    };

    expect(serializeIconConfig(config)).toBe(JSON.stringify(config));
  });
});

describe('getMdiIconPath', () => {
  it('should return path for valid MDI icon', () => {
    const path = getMdiIconPath('home');

    expect(path).toBeTruthy();
    expect(typeof path).toBe('string');
    // MDI paths are SVG path data strings
    expect(path).toMatch(/^M/); // SVG paths typically start with M (moveto)
  });

  it('should return path for kebab-case icon name', () => {
    const path = getMdiIconPath('account-circle');

    expect(path).toBeTruthy();
    expect(typeof path).toBe('string');
  });

  it('should return null for non-existent icon', () => {
    const path = getMdiIconPath('this-icon-does-not-exist-xyz123');

    expect(path).toBeNull();
  });

  it('should handle common lighting icons', () => {
    expect(getMdiIconPath('lightbulb')).toBeTruthy();
    expect(getMdiIconPath('ceiling-light')).toBeTruthy();
  });
});

describe('getAllMdiIcons', () => {
  let iconList: string[];

  beforeEach(() => {
    iconList = getAllMdiIcons();
  });

  it('should return an array of icon names', () => {
    expect(Array.isArray(iconList)).toBe(true);
    expect(iconList.length).toBeGreaterThan(0);
  });

  it('should return icons in kebab-case format', () => {
    // All icons should be lowercase kebab-case
    iconList.slice(0, 100).forEach((icon) => {
      expect(icon).toBe(icon.toLowerCase());
      expect(icon).not.toMatch(/[A-Z]/); // No uppercase
    });
  });

  it('should include common icons', () => {
    expect(iconList).toContain('home');
    expect(iconList).toContain('account');
  });

  it('should cache results', () => {
    const firstCall = getAllMdiIcons();
    const secondCall = getAllMdiIcons();

    // Should return the same array reference (cached)
    expect(firstCall).toBe(secondCall);
  });

  it('should return thousands of icons', () => {
    // MDI has several thousand icons
    expect(iconList.length).toBeGreaterThan(1000);
  });
});

describe('DEFAULT_ICON_CATEGORIES', () => {
  it('should have expected categories', () => {
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Basic');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Lighting');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Wallbox');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('A/V');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Network');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Interfaces');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Surveillance');
    expect(DEFAULT_ICON_CATEGORIES).toHaveProperty('Environment');
  });

  it('should have icons in each category', () => {
    Object.entries(DEFAULT_ICON_CATEGORIES).forEach(([category, icons]) => {
      expect(icons.length).toBeGreaterThan(0);
      icons.forEach((item) => {
        expect(item).toHaveProperty('icon');
        expect(item).toHaveProperty('name');
        expect(typeof item.icon).toBe('string');
        expect(typeof item.name).toBe('string');
      });
    });
  });

  it('should have valid MDI icon references in Lighting category', () => {
    const lightingIcons = DEFAULT_ICON_CATEGORIES['Lighting'];
    expect(lightingIcons).toBeDefined();

    // Check that at least some icons are valid MDI icons
    const ceilingLight = lightingIcons?.find((i) => i.icon === 'ceiling-light');
    expect(ceilingLight).toBeDefined();
    expect(getMdiIconPath('ceiling-light')).toBeTruthy();
  });
});

describe('ICON_MODIFIERS', () => {
  it('should contain modifier definitions', () => {
    expect(ICON_MODIFIERS.length).toBeGreaterThan(0);
  });

  it('should have icon and name for each modifier', () => {
    ICON_MODIFIERS.forEach((modifier) => {
      expect(modifier).toHaveProperty('icon');
      expect(modifier).toHaveProperty('name');
      expect(typeof modifier.icon).toBe('string');
      expect(typeof modifier.name).toBe('string');
    });
  });

  it('should include common modifiers', () => {
    const iconNames = ICON_MODIFIERS.map((m) => m.icon);
    expect(iconNames).toContain('signal-variant');
    expect(iconNames).toContain('ethernet');
    expect(iconNames).toContain('lightning-bolt');
  });
});
