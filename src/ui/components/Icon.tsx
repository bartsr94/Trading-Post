// Single-color line icons (tinted via currentColor) — replaces raw emoji in
// nav/expedition markers so they stay inside the amber/dark palette instead
// of pulling in OS-controlled full-color emoji glyphs.

import type { CSSProperties, ReactElement } from 'react';

export type IconName =
  | 'post'
  | 'assignments'
  | 'characters'
  | 'build'
  | 'people'
  | 'map'
  | 'market'
  | 'caravan'
  | 'explore'
  | 'diplomacy'
  | 'heart';

const PATHS: Record<IconName, ReactElement> = {
  post: (
    <>
      <path d="M12 4 L20 20 H4 Z" />
      <path d="M12 4 L12 20" />
    </>
  ),
  assignments: (
    <>
      <rect x="5" y="4" width="14" height="16" rx="2" />
      <line x1="8" y1="9" x2="16" y2="9" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </>
  ),
  characters: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M4 20 V18 A5 5 0 0 1 14 18 V20" />
      <path d="M16 5.5 A3 3 0 0 1 16 11" />
      <path d="M16.5 13.5 A5 5 0 0 1 20 18 V20" />
    </>
  ),
  build: (
    <>
      <rect x="3" y="6" width="18" height="12" rx="1" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="9" y1="6" x2="9" y2="12" />
      <line x1="15" y1="12" x2="15" y2="18" />
    </>
  ),
  people: (
    <>
      <circle cx="7" cy="9" r="2.5" />
      <circle cx="16" cy="9" r="2.5" />
      <path d="M2.5 19 V17.5 A4 4 0 0 1 11 17.5 V19" />
      <path d="M13 19 V17.5 A4 4 0 0 1 21.5 17.5 V19" />
    </>
  ),
  map: (
    <>
      <path d="M9 4 L4 6 V20 L9 18 L15 20 L20 18 V4 L15 6 L9 4 Z" />
      <line x1="9" y1="4" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="20" />
    </>
  ),
  market: (
    <>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="5" y1="7" x2="19" y2="7" />
      <path d="M5 7 L2 13 A3 3 0 0 0 8 13 Z" />
      <path d="M19 7 L16 13 A3 3 0 0 0 22 13 Z" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </>
  ),
  caravan: (
    <>
      <rect x="3" y="8" width="14" height="8" rx="1" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="15" cy="18" r="2" />
      <line x1="17" y1="10" x2="21" y2="6" />
    </>
  ),
  explore: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9 L10 10.5 L9 15 L14 13.5 Z" />
    </>
  ),
  diplomacy: (
    <>
      <line x1="6" y1="3" x2="6" y2="21" />
      <path d="M6 4 L18 7 L6 11 Z" />
    </>
  ),
  heart: (
    <path d="M12 20 C12 20 4 14.5 4 8.8 A4 4 0 0 1 12 6.5 A4 4 0 0 1 20 8.8 C20 14.5 12 20 12 20 Z" />
  ),
};

export function Icon({
  name,
  size = 18,
  style,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none', ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}
