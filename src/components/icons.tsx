import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
});

export const Store = (p: P) => (
  <svg {...base(p)}><path d="M3 9l1.5-5h15L21 9M3 9v10a1 1 0 001 1h16a1 1 0 001-1V9M3 9h18M8 9v3a2 2 0 01-4 0M12 9v3a2 2 0 01-4 0M16 9v3a2 2 0 01-4 0M20 9v3a2 2 0 01-4 0" /></svg>
);
export const Sparkles = (p: P) => (
  <svg {...base(p)}><path d="M12 3l1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM19 14l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2zM5 15l.6 1.5 1.5.6-1.5.6L5 19.7l-.6-1.5L2.9 17.6l1.5-.6L5 15z" /></svg>
);
export const Printer = (p: P) => (
  <svg {...base(p)}><path d="M6 9V3h12v6M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2M6 14h12v7H6z" /></svg>
);
export const Sliders = (p: P) => (
  <svg {...base(p)}><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" /></svg>
);
export const ArrowRight = (p: P) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);
export const ArrowLeft = (p: P) => (
  <svg {...base(p)}><path d="M19 12H5M11 18l-6-6 6-6" /></svg>
);
export const Check = (p: P) => (
  <svg {...base(p)}><path d="M20 6L9 17l-5-5" /></svg>
);
export const X = (p: P) => (
  <svg {...base(p)}><path d="M18 6L6 18M6 6l12 12" /></svg>
);
export const Grip = (p: P) => (
  <svg {...base(p)}><circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" /></svg>
);
export const External = (p: P) => (
  <svg {...base(p)}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" /></svg>
);
export const Image = (p: P) => (
  <svg {...base(p)}><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>
);
export const Spinner = (p: P) => (
  <svg {...base({ className: 'animate-spin', ...p })}><path d="M21 12a9 9 0 11-6.2-8.6" /></svg>
);
export const Download = (p: P) => (
  <svg {...base(p)}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
);
export const Alert = (p: P) => (
  <svg {...base(p)}><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L14.7 3.9a2 2 0 00-3.4 0z" /></svg>
);
