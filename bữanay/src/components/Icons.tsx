import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

const baseProps = (size: number): SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
});

export function HomeIcon({ size = 22, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V19a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9.5" />
      <path d="M9.5 21v-6a2.5 2.5 0 0 1 5 0v6" />
    </svg>
  );
}

export function ChartBarIcon({ size = 22, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M4 20h16" />
      <rect x="6" y="12" width="3" height="8" rx="1" />
      <rect x="11" y="7" width="3" height="13" rx="1" />
      <rect x="16" y="4" width="3" height="16" rx="1" />
    </svg>
  );
}

export function CameraIcon({ size = 22, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M4 8a2 2 0 0 1 2-2h2l1.5-2h5L16 6h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function ClockIcon({ size = 22, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function UserIcon({ size = 22, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function BellIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M6 9a6 6 0 0 1 12 0c0 4.5 2 6 2 6H4s2-1.5 2-6Z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function WaterDropIcon({ size = 24, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M12 2.5C12 2.5 6 9.5 6 14a6 6 0 0 0 12 0c0-4.5-6-11.5-6-11.5Z" />
      <path d="M9.5 14.5a2.5 2.5 0 0 0 2.5 2.5" />
    </svg>
  );
}

export function ArrowLeftIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </svg>
  );
}

export function CheckIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M5 12.5l4.5 4.5L19 7" />
    </svg>
  );
}

export function TrashIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function PlusIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function UtensilsIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M6 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3" />
      <path d="M8 3v18" />
      <path d="M16 3v18" />
      <path d="M16 3c2 0 3 2.5 3 5.5S18 13 16 13" />
    </svg>
  );
}

export function BookOpenIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M2 5.5A2.5 2.5 0 0 1 4.5 3H12v17H4.5A2.5 2.5 0 0 0 2 21V5.5Z" />
      <path d="M22 5.5A2.5 2.5 0 0 0 19.5 3H12v17h7.5a2.5 2.5 0 0 1 2.5 1V5.5Z" />
    </svg>
  );
}

export function SwapIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M7 7h12l-3-3" />
      <path d="M17 17H5l3 3" />
    </svg>
  );
}

export function DownloadIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M12 4v11" />
      <path d="M7.5 10.5 12 15l4.5-4.5" />
      <path d="M5 17v1.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V17" />
    </svg>
  );
}

export function IOSShareIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M12 3v12" />
      <path d="M8 7l4-4 4 4" />
      <path d="M5 11v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
    </svg>
  );
}

export function IOSAddHomeIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

export function IOSMoreDotsIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="12" r="0.8" fill="currentColor" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
      <circle cx="15.5" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

export function AndroidMenuDotsIcon({ size = 20, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <circle cx="12" cy="5.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />
    </svg>
  );
}

export function EditIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...baseProps(size)} {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

