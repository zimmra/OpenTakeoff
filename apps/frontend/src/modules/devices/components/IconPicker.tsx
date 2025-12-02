/**
 * Icon Picker Component
 * Supports MDI icons (default) and legacy Tabler icons
 */

import { useState, useEffect, useMemo } from 'react';
import Icon from '@mdi/react';
import {
  mdiChevronDown,
  mdiChevronUp,
  mdiClose,
  mdiFlipHorizontal,
  mdiFlipVertical,
} from '@mdi/js';
import * as TablerIcons from '@tabler/icons-react';
import { Popover } from '@/components/ui/Popover';
import { Dialog } from '@/components/ui/Dialog';
import {
  DEFAULT_ICON_CATEGORIES,
  ICON_MODIFIERS,
  parseIconKey,
  serializeIconConfig,
  getMdiIconPath,
  getAllMdiIcons,
  type IconConfig,
} from '../utils/icon';

interface IconPickerProps {
  value: string;
  onChange: (iconKey: string) => void;
  label?: string;
  error?: string;
}

export function IconPicker({ value, onChange, label, error }: IconPickerProps) {
  // Parse initial value
  const [config, setConfig] = useState<IconConfig>(
    () =>
      parseIconKey(value) ?? {
        provider: 'mdi',
        name: 'circle-outline',
        modPos: 'top-right',
        textPos: 'bottom-right',
      },
  );

  const [conflictDetails, setConflictDetails] = useState<{
    type: 'text-moved' | 'mod-moved';
    conflictingPos: string;
    suggestedSwap: Partial<IconConfig>;
  } | null>(null);

  useEffect(() => {
    const parsed = parseIconKey(value);
    if (parsed) {
      setConfig(parsed);
    }
  }, [value]);

  // Track open categories
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  // Track if we should show search results
  const [showSearchResults, setShowSearchResults] = useState(false);

  const toggleCategory = (category: string) => {
    setOpenCategories((prev) => ({
      ...prev,
      [category]: !prev[category],
    }));
  };

  const allIcons = useMemo(() => getAllMdiIcons(), []);

  const searchResults = useMemo(() => {
    if (!config.name || config.name.length < 2) return [];
    const term = config.name.toLowerCase();
    return allIcons.filter((icon) => icon.includes(term)).slice(0, 50);
  }, [config.name, allIcons]);

  const handleConfigChange = (updates: Partial<IconConfig>) => {
    const nextConfig = { ...config, ...updates };

    // Check for conflicts if both modifier and text are present
    const hasModifiers = (nextConfig.modifiers?.length ?? 0) > 0 || !!nextConfig.modifier;
    if (hasModifiers && nextConfig.text) {
      // Normalize positions
      const getTextPos = (c: IconConfig) => {
        if (c.textPos === 'center') return 'center';
        // Treat sub as bottom-left (no conflict with bottom-right) or bottom-right?
        // Requirement implies we are moving to bottom-right.
        // If user explicitly selects 'bottom-right', it will be 'bottom-right'.
        if (c.textPos === 'bottom-right') return 'bottom-right';
        if (c.textPos === 'sub') return 'bottom-left';
        return 'top-right'; // default/super
      };

      const getModPos = (c: IconConfig) => c.modPos ?? 'bottom-right';

      const newTextPos = getTextPos(nextConfig);
      const newModPos = getModPos(nextConfig);

      if (newTextPos !== 'center' && newTextPos !== 'bottom-left' && newTextPos === newModPos) {
        // Conflict detected
        const isTextMove = 'textPos' in updates || ('text' in updates && !config.text);

        const suggestion: Partial<IconConfig> = { ...updates };
        const otherPos = newTextPos === 'top-right' ? 'bottom-right' : 'top-right';

        if (isTextMove) {
          // User moved text to X, modifier is at X. Suggest moving modifier to Y.
          suggestion.modPos = otherPos;
          setConflictDetails({
            type: 'text-moved',
            conflictingPos: newTextPos,
            suggestedSwap: suggestion,
          });
        } else {
          // User moved modifier to X, text is at X. Suggest moving text to Y.
          suggestion.textPos = otherPos;
          setConflictDetails({
            type: 'mod-moved',
            conflictingPos: newTextPos,
            suggestedSwap: suggestion,
          });
        }
        return; // Stop update
      }
    }

    setConfig(nextConfig);
    onChange(serializeIconConfig(nextConfig));
  };

  const renderIconPreview = (conf: IconConfig, size = 24) => {
    if (conf.provider === 'tabler') {
      const icons = TablerIcons as Record<string, unknown>;
      const IconComponent = icons[conf.name] as
        | React.ComponentType<{ size: number; stroke: number }>
        | undefined;
      return IconComponent ? <IconComponent size={size} stroke={1.5} /> : null;
    }

    // MDI
    const path = getMdiIconPath(conf.name);
    if (!path) return <div className="text-slate-400">?</div>;

    const activeModifiers = conf.modifiers ?? (conf.modifier ? [conf.modifier] : []);

    // Determine text position styles
    const textStyle: React.CSSProperties = {
      fontSize: size * 0.4,
    };

    // Apply offsets if present
    const modStyle: React.CSSProperties = {
      height: size * 0.6,
      justifyContent: 'flex-end', // Ensure right alignment
    };

    // Default modPos to top-right if not specified
    const modPos = conf.modPos ?? 'top-right';

    if (modPos === 'top-right') {
      modStyle.top = '-10%';
      modStyle.right = '-10%';
    } else {
      modStyle.bottom = '-10%';
      modStyle.right = '-10%';
    }

    if (conf.modX || conf.modY) {
      modStyle.transform = `translate(${conf.modX ?? 0}%, ${-(conf.modY ?? 0)}%)`;
    }

    let textTransform = '';
    if (conf.textPos === 'center') {
      textStyle.top = '50%';
      textStyle.left = '50%';
      textTransform = 'translate(-50%, -50%)';
      textStyle.color = 'white'; // Matches DeviceIcon logic roughly
    } else if (conf.textPos === 'sub') {
      textStyle.bottom = 0;
      textStyle.left = 0;
    } else if (conf.textPos === 'bottom-right') {
      textStyle.bottom = 0;
      textStyle.right = 0;
      textStyle.textAlign = 'right';
    } else {
      // super (default)
      textStyle.top = 0;
      textStyle.right = 0;
      textStyle.textAlign = 'right';
    }

    if (conf.textX || conf.textY) {
      textTransform += ` translate(${conf.textX ?? 0}%, ${-(conf.textY ?? 0)}%)`;
    }

    if (textTransform) {
      textStyle.transform = textTransform;
    }

    const flipX = conf.flipX;
    const flipY = conf.flipY ?? conf.flip;
    const iconTransform = [flipX ? 'scale-x-[-1]' : '', flipY ? 'scale-y-[-1]' : '']
      .filter(Boolean)
      .join(' ');

    const modFlipX = conf.modFlipX;
    const modFlipY = conf.modFlipY;
    const modIconTransform = [modFlipX ? 'scale-x-[-1]' : '', modFlipY ? 'scale-y-[-1]' : '']
      .filter(Boolean)
      .join(' ');

    return (
      <div
        className="relative flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Icon path={path} size={size / 24} className={iconTransform} />

        {/* Modifier */}
        {activeModifiers.length > 0 && (
          <div
            className="absolute bg-white rounded-full flex items-center justify-center px-0.5 shadow-sm border border-slate-100"
            style={modStyle}
          >
            {activeModifiers.map((modName, idx) => {
              const mPath = getMdiIconPath(modName);
              if (!mPath) return null;
              return (
                <Icon key={modName + idx} path={mPath} size={0.5} className={modIconTransform} />
              );
            })}
          </div>
        )}

        {/* Text */}
        {conf.text && (
          <div
            className={`absolute font-bold leading-none select-none flex items-center justify-center`}
            style={textStyle}
          >
            {conf.text}
          </div>
        )}
      </div>
    );
  };

  const isFlipY = config.flipY ?? config.flip;
  const activeModifiers = config.modifiers ?? (config.modifier ? [config.modifier] : []);

  return (
    <div className="space-y-2">
      {label && <label className="block text-sm font-medium text-slate-700">{label}</label>}

      <Popover
        trigger={
          <button
            type="button"
            className={`flex items-center gap-3 px-4 py-2 border rounded-lg hover:bg-slate-50 transition-colors w-full text-left ${
              error ? 'border-red-300' : 'border-slate-300'
            }`}
          >
            <div className="flex items-center justify-center w-8 h-8 text-slate-700 border border-slate-200 rounded bg-white">
              {renderIconPreview(config)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-900 truncate">{config.name}</div>
              <div className="text-xs text-slate-500 truncate">
                {config.provider === 'mdi' ? 'MDI Icon' : 'Tabler Icon'}
              </div>
            </div>
            <Icon path={mdiChevronDown} size={0.7} className="text-slate-400" />
          </button>
        }
      >
        <div className="w-96 max-h-[50vh] overflow-y-auto p-4 space-y-6 overscroll-contain">
          {/* Default Categories */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Categories
            </label>
            <div className="space-y-1">
              {Object.entries(DEFAULT_ICON_CATEGORIES).map(([category, icons]) => (
                <div key={category} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span>{category}</span>
                      {!openCategories[category] && (
                        <div className="flex items-center gap-1 opacity-50">
                          {icons.slice(0, 5).map((icon) => {
                            const path = getMdiIconPath(icon.icon);
                            if (!path) return null;
                            return (
                              <Icon
                                key={icon.icon}
                                path={path}
                                size={0.6}
                                className="text-slate-400"
                              />
                            );
                          })}
                          {icons.length > 5 && (
                            <span className="text-[10px] text-slate-400">...</span>
                          )}
                        </div>
                      )}
                    </div>
                    {openCategories[category] ? (
                      <Icon path={mdiChevronUp} size={0.6} />
                    ) : (
                      <Icon path={mdiChevronDown} size={0.6} />
                    )}
                  </button>

                  {openCategories[category] && (
                    <div className="p-2 grid grid-cols-6 gap-2 bg-white">
                      {icons.map((item) => (
                        <button
                          key={item.icon}
                          type="button"
                          onClick={() => {
                            handleConfigChange({ provider: 'mdi', name: item.icon });
                            setShowSearchResults(false);
                          }}
                          className={`p-1.5 rounded flex flex-col items-center gap-1 transition-colors ${
                            config.provider === 'mdi' && config.name === item.icon
                              ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                              : 'hover:bg-slate-100 text-slate-600'
                          }`}
                          title={item.name}
                        >
                          {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- icon from known category */}
                          <Icon path={getMdiIconPath(item.icon)!} size={1} />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Custom MDI Icon Search */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Search MDI Icons
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={config.name}
                  onChange={(e) => {
                    handleConfigChange({ provider: 'mdi', name: e.target.value });
                    setShowSearchResults(true);
                  }}
                  placeholder="Type to search (e.g. light)..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                {/* Search Results Dropdown */}
                {searchResults.length > 0 && showSearchResults && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-y-auto grid grid-cols-5 gap-1 p-2">
                    {searchResults.map((iconName) => (
                      <button
                        key={iconName}
                        type="button"
                        onClick={() => {
                          handleConfigChange({ provider: 'mdi', name: iconName });
                          setShowSearchResults(false);
                        }}
                        className={`p-1.5 rounded flex flex-col items-center justify-center gap-1 transition-colors ${
                          config.name === iconName
                            ? 'bg-primary-50 text-primary-700 ring-1 ring-primary-500'
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                        title={iconName}
                      >
                        {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- icon from search results */}
                        <Icon path={getMdiIconPath(iconName)!} size={1} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="w-10 h-10 flex-shrink-0 flex items-center justify-center bg-slate-100 rounded border border-slate-200">
                {renderIconPreview({
                  ...config,
                  modifier: undefined,
                  modifiers: undefined,
                  text: undefined,
                })}
              </div>
            </div>
            <p className="text-[10px] text-slate-500">
              {showSearchResults && searchResults.length > 0
                ? `Found ${searchResults.length}${searchResults.length === 50 ? '+' : ''} matching icons`
                : 'Enter 2+ characters to search MDI library'}
            </p>
          </div>

          {/* Modifiers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Modifiers
              </label>
              {activeModifiers.length > 0 && (
                <select
                  value={config.modPos ?? 'bottom-right'}
                  onChange={(e) =>
                    handleConfigChange({ modPos: e.target.value as 'top-right' | 'bottom-right' })
                  }
                  className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-slate-50"
                >
                  <option value="bottom-right">Bottom Right</option>
                  <option value="top-right">Top Right</option>
                </select>
              )}
            </div>
            <div className="grid grid-cols-8 gap-2">
              <button
                type="button"
                onClick={() => handleConfigChange({ modifier: undefined, modifiers: undefined })}
                className={`p-1.5 rounded flex items-center justify-center border transition-colors aspect-square ${
                  activeModifiers.length === 0
                    ? 'bg-primary-50 text-primary-700 border-primary-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-400'
                }`}
                title="None"
              >
                <Icon path={mdiClose} size={0.7} />
              </button>
              {ICON_MODIFIERS.map((mod) => (
                <button
                  key={mod.icon}
                  type="button"
                  onClick={() => {
                    const isSelected = activeModifiers.includes(mod.icon);
                    let newMods: string[];

                    if (isSelected) {
                      newMods = activeModifiers.filter((m) => m !== mod.icon);
                    } else {
                      if (activeModifiers.length >= 2) {
                        // Replace the last one
                        newMods = [...activeModifiers];
                        newMods.pop();
                        newMods.push(mod.icon);
                      } else {
                        newMods = [...activeModifiers, mod.icon];
                      }
                    }

                    handleConfigChange({
                      modifiers: newMods,
                      modifier: newMods.length > 0 ? newMods[0] : undefined,
                    });
                  }}
                  className={`p-1.5 rounded flex items-center justify-center border transition-colors aspect-square ${
                    activeModifiers.includes(mod.icon)
                      ? 'bg-primary-50 text-primary-700 border-primary-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                  }`}
                  title={mod.name}
                >
                  {/* eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- icon from known modifier */}
                  <Icon path={getMdiIconPath(mod.icon)!} size={0.8} />
                </button>
              ))}
            </div>
          </div>

          {/* Advanced Settings (Flip & Text) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-sm text-slate-700">Icon Flip</label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => handleConfigChange({ flipX: !config.flipX })}
                  className={`p-1.5 rounded transition-colors ${
                    config.flipX
                      ? 'bg-primary-100 text-primary-700'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="Flip Horizontal"
                >
                  <Icon path={mdiFlipHorizontal} size={0.8} />
                </button>
                <button
                  type="button"
                  onClick={() => handleConfigChange({ flipY: !isFlipY, flip: undefined })}
                  className={`p-1.5 rounded transition-colors ${
                    isFlipY
                      ? 'bg-primary-100 text-primary-700'
                      : 'hover:bg-slate-100 text-slate-600'
                  }`}
                  title="Flip Vertical"
                >
                  <Icon path={mdiFlipVertical} size={0.8} />
                </button>
              </div>
            </div>

            {activeModifiers.length > 0 && (
              <div className="flex items-center justify-between">
                <label className="text-sm text-slate-700">Modifier Flip</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => handleConfigChange({ modFlipX: !config.modFlipX })}
                    className={`p-1.5 rounded transition-colors ${
                      config.modFlipX
                        ? 'bg-primary-100 text-primary-700'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                    title="Flip Modifier Horizontal"
                  >
                    <Icon path={mdiFlipHorizontal} size={0.8} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfigChange({ modFlipY: !config.modFlipY })}
                    className={`p-1.5 rounded transition-colors ${
                      config.modFlipY
                        ? 'bg-primary-100 text-primary-700'
                        : 'hover:bg-slate-100 text-slate-600'
                    }`}
                    title="Flip Modifier Vertical"
                  >
                    <Icon path={mdiFlipVertical} size={0.8} />
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm text-slate-700">Label (Max 2 chars)</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={config.text ?? ''}
                  onChange={(e) => handleConfigChange({ text: e.target.value })}
                  placeholder="A1"
                  maxLength={2}
                  className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <select
                  value={
                    config.textPos === 'super' || !config.textPos ? 'top-right' : config.textPos
                  }
                  onChange={(e) =>
                    handleConfigChange({
                      textPos: e.target.value as 'top-right' | 'bottom-right' | 'center',
                    })
                  }
                  className="px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="top-right">Top Right</option>
                  <option value="bottom-right">Bottom Right</option>
                  <option value="center">Center</option>
                </select>
              </div>
            </div>

            {/* Offset Controls */}
            {(activeModifiers.length > 0 || config.text) && (
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Offsets
                </label>

                {/* Shared Horizontal Offset */}
                <div className="space-y-2">
                  <label className="text-xs text-slate-700 font-medium">Horizontal Offset</label>
                  <div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="10"
                      value={config.textX ?? config.modX ?? 0}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        handleConfigChange({
                          ...(config.text ? { textX: val } : {}),
                          ...(activeModifiers.length > 0 ? { modX: val } : {}),
                        });
                      }}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                      <span>-10</span>
                      <span>0</span>
                      <span>10</span>
                    </div>
                  </div>
                </div>

                {/* Vertical Offsets */}
                <div className="grid grid-cols-2 gap-2">
                  {activeModifiers.length > 0 && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-700 font-medium">
                        Modifier Vertical
                      </label>
                      <div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="10"
                          value={config.modY ?? 0}
                          onChange={(e) => handleConfigChange({ modY: Number(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                          <span>-10</span>
                          <span>0</span>
                          <span>10</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {config.text && (
                    <div className="space-y-2">
                      <label className="text-xs text-slate-700 font-medium">Label Vertical</label>
                      <div>
                        <input
                          type="range"
                          min="-100"
                          max="100"
                          step="10"
                          value={config.textY ?? 0}
                          onChange={(e) => handleConfigChange({ textY: Number(e.target.value) })}
                          className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                        />
                        <div className="flex justify-between text-[10px] text-slate-400 px-1 mt-1">
                          <span>-10</span>
                          <span>0</span>
                          <span>10</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </Popover>

      {/* Conflict Dialog */}
      <Dialog
        open={!!conflictDetails}
        onOpenChange={(open) => !open && setConflictDetails(null)}
        title="Position Conflict"
        description={`The ${conflictDetails?.type === 'text-moved' ? 'text label' : 'modifier icon'} is colliding with the existing ${conflictDetails?.type === 'text-moved' ? 'modifier icon' : 'text label'}.`}
        footer={
          <div className="flex gap-2 justify-end w-full">
            <button
              type="button"
              onClick={() => setConflictDetails(null)}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                if (conflictDetails) {
                  const newConfig = { ...config, ...conflictDetails.suggestedSwap };
                  setConfig(newConfig);
                  onChange(serializeIconConfig(newConfig));
                  setConflictDetails(null);
                }
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-md"
            >
              {conflictDetails?.type === 'text-moved' ? 'Move Modifier' : 'Move Label'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Would you like to move the{' '}
          {conflictDetails?.type === 'text-moved' ? 'modifier icon' : 'text label'} to the{' '}
          {conflictDetails?.suggestedSwap.modPos === 'top-right' ||
          conflictDetails?.suggestedSwap.textPos === 'top-right'
            ? 'top right'
            : 'bottom right'}{' '}
          corner?
        </p>
      </Dialog>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
