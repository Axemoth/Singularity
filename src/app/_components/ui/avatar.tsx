'use client';

interface AvatarProps {
  src?: string;
  name: string;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  showStatus?: boolean;
  isOnline?: boolean;
}

const sizeMap = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-11 w-11 text-sm',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 60%, 55%)`;
}

export function Avatar({
  src,
  name,
  size = 'md',
  color,
  showStatus,
  isOnline,
}: AvatarProps) {
  const bgColor = color || stringToColor(name);

  return (
    <div className="relative inline-flex shrink-0">
      {src ? (
        <img
          src={src}
          alt={name}
          className={`${sizeMap[size]} rounded-full object-cover ring-2 ring-bg-base`}
        />
      ) : (
        <div
          className={`${sizeMap[size]} flex items-center justify-center rounded-full font-semibold text-white ring-2 ring-bg-base`}
          style={{ backgroundColor: bgColor }}
        >
          {getInitials(name)}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full ring-2 ring-bg-base ${
            isOnline ? 'bg-accent-success' : 'bg-text-tertiary'
          }`}
        />
      )}
    </div>
  );
}
