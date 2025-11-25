import * as mdiIcons from '@mdi/js';

export interface IconConfig {
  provider: 'mdi' | 'tabler';
  name: string;
  modifier?: string | undefined; // MDI icon name for modifier (Legacy, use modifiers)
  modifiers?: string[] | undefined; // Array of MDI icon names
  modPos?: 'top-right' | 'bottom-right' | undefined;
  flip?: boolean | undefined; // Legacy: Vertical flip
  flipX?: boolean | undefined;
  flipY?: boolean | undefined;
  
  // Modifier flips
  modFlipX?: boolean | undefined;
  modFlipY?: boolean | undefined;

  text?: string | undefined;
  textPos?: 'sub' | 'super' | 'center' | 'top-right' | 'bottom-right' | undefined;
  
  // Offsets in % of icon size. 0 = default position.
  modX?: number; 
  modY?: number;
  textX?: number;
  textY?: number;
}

export const DEFAULT_ICON_CATEGORIES: Record<string, { icon: string; name: string }[]> = {
  Basic: [
    { icon: 'circle-outline', name: 'Circle' },
    { icon: 'triangle-outline', name: 'Triangle' },
    { icon: 'square-outline', name: 'Square' },
    { icon: 'hexagon-outline', name: 'Hexagon' },
  ],
  Lighting: [
    { icon: 'ceiling-light', name: 'Pendant' },
    { icon: 'light-recessed', name: 'Downlight' },
    { icon: 'dome-light', name: 'Dome Light' },
    { icon: 'ceiling-fan', name: 'Ceiling Fan' },
    { icon: 'ceiling-fan-light', name: 'Ceiling Fan + Light' },
    { icon: 'chandelier', name: 'Chandelier' },
    { icon: 'led-strip', name: 'Led Strip' },
    { icon: 'lightbulb-variant', name: 'Light Bulb' },
    { icon: 'outdoor-lamp', name: 'Sconce' },
    { icon: 'wall-sconce', name: 'Sconce Variant' },
    { icon: 'track-light', name: 'Monopoint' },
  ],
  Wallbox: [
    { icon: 'ethernet', name: 'Ethernet' },
    { icon: 'power-socket-us', name: 'Receptacle' },
  ],
  'A/V': [
    { icon: 'television', name: 'Television' },
    { icon: 'projector', name: 'Projector' },
    { icon: 'speaker', name: 'Speaker' },
    { icon: 'soundbar', name: 'Soundbar' },
    { icon: 'audio-video', name: 'Receiver' },
    { icon: 'set-top-box', name: 'Device' },
  ],
  Network: [
    { icon: 'router-network', name: 'Router' },
    { icon: 'access-point-network', name: 'Access Point' },
    { icon: 'switch', name: 'Switch' },
  ],
  Interfaces: [
    { icon: 'remote-tv', name: 'TV Remote' },
    { icon: 'tablet-dashboard', name: 'Touch Panel' },
    { icon: 'alarm-panel-outline', name: 'Keypad' },
    { icon: 'light-switch', name: 'Light Switch' },
  ],
  Surveillance: [
    { icon: 'cctv', name: 'Camera' },
    { icon: 'webcam', name: 'Camera 2' },
    { icon: 'doorbell-video', name: 'Doorstation' },
  ],
  Environment: [
    { icon: 'motion-sensor', name: 'Motion Sensor' },
    { icon: 'curtains', name: 'Drape' },
    { icon: 'roller-shade-closed', name: 'Shade' },
    { icon: 'thermostat', name: 'Thermostat' },
  ],
};

export const ICON_MODIFIERS = [
  { icon: 'signal-variant', name: 'Wireless' },
  { icon: 'radio-tower', name: 'Wireless 2' },
  { icon: 'access-point', name: 'Wireless 3' },
  { icon: 'ethernet', name: 'Wired Network' },
  { icon: 'remote', name: 'Remote' },
  { icon: 'lightning-bolt', name: 'Powered' }, 
  { icon: 'battery', name: 'Battery Powered' },
  { icon: 'solar-power', name: 'Solar Powered' },
];

export function parseIconKey(key: string | null | undefined): IconConfig | null {
  if (!key) return null;

  // Try parsing as JSON
  if (key.startsWith('{')) {
    try {
      const config: unknown = JSON.parse(key);
      if (typeof config === 'object' && config !== null && 'provider' in config && 'name' in config) {
        return config as IconConfig;
      }
    } catch {
      // ignore
    }
  }

  // Legacy Tabler support
  // If it looks like a Tabler icon (PascalCase "Icon...") or just any string not starting with {
  return {
    provider: 'tabler',
    name: key,
  };
}

export function serializeIconConfig(config: IconConfig): string {
  // If it's a simple Tabler icon with no extras, just return the name for backward compat if needed?
  // But we want to migrate to MDI mostly.
  // If it is simple Tabler, return name?
  if (config.provider === 'tabler' && !config.modifier && !config.flip && !config.flipX && !config.flipY && !config.modFlipX && !config.modFlipY && !config.text) {
    return config.name;
  }
  return JSON.stringify(config);
}

export function getMdiIconPath(name: string): string | null {
  // Convert kebab-case to PascalCase and prepend 'mdi'
  // e.g. 'ceiling-light' -> 'mdiCeilingLight'
  const pascalName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  const mdiName = `mdi${pascalName}` as keyof typeof mdiIcons;
  
  return (mdiName in mdiIcons ? mdiIcons[mdiName] : null) ?? null;
}

// Cache for the icon list
let cachedIconList: string[] | null = null;

export function getAllMdiIcons(): string[] {
  if (cachedIconList) return cachedIconList;

  cachedIconList = Object.keys(mdiIcons)
    .filter(key => key.startsWith('mdi'))
    .map(key => {
      // Convert mdiPascalCase to kebab-case
      // Remove 'mdi' prefix
      const name = key.slice(3);
      // Insert hyphen before capital letters and lowercase
      return name
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase();
    });
    
  return cachedIconList;
}
