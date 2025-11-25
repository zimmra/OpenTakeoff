import { useMemo } from 'react';
import Icon from '@mdi/react';
import * as TablerIcons from '@tabler/icons-react';
import { parseIconKey, getMdiIconPath } from '../utils/icon';

interface DeviceIconProps {
  iconKey?: string | null | undefined;
  color?: string | null | undefined;
  size?: number;
  className?: string;
}

export function DeviceIcon({ iconKey, color, size = 24, className = '' }: DeviceIconProps) {
  const config = useMemo(() => parseIconKey(iconKey), [iconKey]);
  
  if (!config) {
    return (
      <div 
        className={`bg-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold text-[10px] ${className}`}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  const commonProps = {
    color: color ?? 'currentColor',
    className,
  };

  if (config.provider === 'tabler') {
    const icons = TablerIcons as Record<string, unknown>;
    const IconComponent = icons[config.name] as React.ComponentType<{ size: number; stroke: number; color?: string; className?: string }> | undefined;
    return IconComponent ? (
      <IconComponent 
        size={size} 
        stroke={1.5} 
        {...commonProps} 
      />
    ) : (
      <TablerIcons.IconQuestionMark size={size} stroke={1.5} {...commonProps} />
    );
  }

  // MDI
  const path = getMdiIconPath(config.name);
  if (!path) {
    return (
       <div 
        className={`bg-slate-200 rounded-full flex items-center justify-center text-slate-400 font-bold text-[10px] ${className}`}
        style={{ width: size, height: size }}
      >
        ?
      </div>
    );
  }

  const activeModifiers = config.modifiers ?? (config.modifier ? [config.modifier] : []);

  // Determine text position styles
  const textStyle: React.CSSProperties = {
    fontSize: size * 0.4,
  };
  
  // Determine base positions based on config or defaults
  // Default modPos to top-right if not specified
  const modPos = config.modPos ?? 'top-right';
  
  const modStyleContainer: React.CSSProperties = {
     height: size * 0.6,
  };

  if (modPos === 'top-right') {
    modStyleContainer.top = '-10%';
    modStyleContainer.right = '-10%';
  } else {
    // bottom-right
    modStyleContainer.bottom = '-10%';
    modStyleContainer.right = '-10%';
  }

  // Ensure modifier is always right-aligned unless specifically centered or moved
  modStyleContainer.justifyContent = 'flex-end'; // Align icons to right if multiple

  if (config.modX || config.modY) {
    modStyleContainer.transform = `translate(${config.modX ?? 0}%, ${-(config.modY ?? 0)}%)`;
  }

  let textTransform = '';
  // Default textPos to bottom-right if not specified and not legacy
  const textPos = config.textPos ?? 'bottom-right';

  if (textPos === 'center') {
    textStyle.top = '50%';
    textStyle.left = '50%';
    textTransform = 'translate(-50%, -50%)';
    textStyle.color = 'white'; // Matches DeviceIcon logic roughly
  } else if (textPos === 'sub') {
    textStyle.bottom = 0;
    textStyle.left = 0;
  } else if (textPos === 'bottom-right') {
    textStyle.bottom = 0;
    textStyle.right = 0;
    textStyle.textAlign = 'right'; // Ensure right alignment
  } else { // super or top-right (default)
    textStyle.top = 0;
    textStyle.right = 0;
    textStyle.textAlign = 'right'; // Ensure right alignment
  }

  if (config.textX || config.textY) {
    textTransform += ` translate(${config.textX ?? 0}%, ${-(config.textY ?? 0)}%)`;
  }

  if (textTransform) {
    textStyle.transform = textTransform;
  }

  const flipX = config.flipX;
  const flipY = config.flipY ?? config.flip;
  const iconTransform = [
    flipX ? 'scale-x-[-1]' : '',
    flipY ? 'scale-y-[-1]' : ''
  ].filter(Boolean).join(' ');

  const modFlipX = config.modFlipX;
  const modFlipY = config.modFlipY;
  const modIconTransform = [
    modFlipX ? 'scale-x-[-1]' : '',
    modFlipY ? 'scale-y-[-1]' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={`relative inline-flex items-center justify-center select-none ${className}`} 
      style={{ width: size, height: size, color: color ?? 'currentColor' }}
    >
      <Icon 
        path={path} 
        size={size / 24} 
        className={iconTransform}
      />
      
      {activeModifiers.length > 0 && (
        <div 
          className="absolute bg-white rounded-full flex items-center justify-center px-0.5 shadow-sm border border-slate-100 gap-0.5"
          style={modStyleContainer}
        >
          {activeModifiers.map((modName, idx) => {
             const mPath = getMdiIconPath(modName);
             if (!mPath) return null;
             return (
               <Icon 
                 key={modName + idx}
                 path={mPath} 
                 size={(size * 0.5) / 24} 
                 className={modIconTransform}
               />
             );
          })}
        </div>
      )}

      {config.text && (
          <div 
            className={`absolute font-bold leading-none select-none pointer-events-none flex items-center justify-center`} 
            style={textStyle}
          >
            {config.text}
          </div>
        )}
    </div>
  );
}

// Export for use in Canvas/PDF generation where we need pure SVG
export function DeviceIconSvg({ iconKey, color, secondaryColor, size = 24 }: Omit<DeviceIconProps, 'className'> & { secondaryColor?: string }) {
  const config = useMemo(() => parseIconKey(iconKey), [iconKey]);
  if (!config) return null;

  const resolvedColor = color ?? 'currentColor';
  const resolvedSecondaryColor = secondaryColor ?? resolvedColor;

  if (config.provider === 'tabler') {
     const icons = TablerIcons as Record<string, unknown>;
     const IconComponent = icons[config.name] as React.ComponentType<{ size?: number; color?: string; stroke?: number }> | undefined;
     return IconComponent ? <IconComponent size={size} color={resolvedColor} stroke={1.5} /> : null;
  }

  const mainPath = getMdiIconPath(config.name);
  if (!mainPath) return null;

  const activeModifiers = config.modifiers ?? (config.modifier ? [config.modifier] : []);

  // Calculate modifier offset in viewbox units (24x24)
  const modOffsetX = (config.modX ?? 0) * 0.24;
  const modOffsetY = -(config.modY ?? 0) * 0.24;
  
  // Align modifier to the right edge (22) to match text position
  const modTransX = 22 + modOffsetX;
  
  // Determine base Y for modifier
  const modPos = config.modPos ?? 'top-right';
  const baseModY = modPos === 'top-right' ? 0 : 12;
  const modTransY = baseModY + modOffsetY;

  // Text position logic for SVG
  let textX = 22;
  let textY = 10;
  let textAnchor: "end" | "middle" | "start" | "inherit" | undefined = "end";
  let textDominantBaseline: "auto" | "central" | "text-before-edge" | "text-after-edge" | "ideographic" | "alphabetic" | "hanging" | "mathematical" | "inherit" | "middle" | "use-script" | "no-change" | "reset-size" | undefined = "auto";
  let textColor = resolvedSecondaryColor;

  if (config.textPos === 'center') {
    textX = 12;
    textY = 12;
    textAnchor = "middle";
    textDominantBaseline = "central";
    textColor = 'white';
  } else if (config.textPos === 'sub') {
    textX = 2;
    textY = 20;
    textAnchor = "start";
  } else if (config.textPos === 'bottom-right') {
    textX = 22;
    textY = 20;
    textAnchor = "end";
  }

  // Apply text offsets
  textX += (config.textX ?? 0) * 0.24;
  textY -= (config.textY ?? 0) * 0.24;

  const getFlipTransform = (flipX?: boolean, flipY?: boolean) => {
    const sx = flipX ? -1 : 1;
    const sy = flipY ? -1 : 1;
    if (sx === 1 && sy === 1) return "";
    const tx = flipX ? -24 : 0;
    const ty = flipY ? -24 : 0;
    return `scale(${sx}, ${sy}) translate(${tx}, ${ty})`;
  };

  const mainTransform = getFlipTransform(config.flipX, config.flipY ?? config.flip);
  const modFlipTransform = getFlipTransform(config.modFlipX, config.modFlipY);

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="-12 -12 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform={mainTransform}>
        <path d={mainPath} fill={resolvedColor} />
      </g>
      
      {activeModifiers.length > 0 && (
        <g transform={`translate(${modTransX}, ${modTransY}) scale(0.5)`}>
           <g transform={modFlipTransform}>
             {/* Background */}
             <rect 
                x={-activeModifiers.length * 24} 
                y="0" 
                width={activeModifiers.length * 24} 
                height="24" 
                rx="12" 
                fill="white" 
             />
             
             {activeModifiers.map((mod, i) => {
                const p = getMdiIconPath(mod);
                if (!p) return null;
                // Stack from right to left. i=0 is leftmost, i=length-1 is rightmost.
                // Rightmost should be at -24.
                const shiftX = -(activeModifiers.length - i) * 24;
                return (
                    <g key={i} transform={`translate(${shiftX}, 0)`}>
                        <path d={p} fill={resolvedSecondaryColor} />
                    </g>
                );
             })}
           </g>
        </g>
      )}

      {config.text && (
        <text
          x={textX}
          y={textY}
          fontSize="10"
          fontWeight="900"
          fill={textColor}
          textAnchor={textAnchor}
          dominantBaseline={textDominantBaseline}
          stroke={config.textPos === 'center' ? 'none' : 'white'} 
          strokeWidth={config.textPos === 'center' ? '0' : '0.5'}
          style={{ fontFamily: 'sans-serif' }}
        >
          {config.text}
        </text>
      )}
    </svg>
  );
}
