export const COLORS = {
  // Theme foundation
  background: '#0f172a', // Slate-900 (Dark background)
  surface: '#1e293b',    // Slate-800 (Card surfaces)
  surfaceLight: '#334155', // Slate-700 (Inputs, minor surfaces)
  border: '#475569',       // Slate-600 (Borders)
  text: '#f8fafc',         // Slate-50 (Primary text)
  textMuted: '#94a3b8',    // Slate-400 (Secondary text)

  // Brand primary
  primary: '#6366f1',      // Indigo-500
  primaryLight: '#818cf8', // Indigo-400
  primaryDark: '#4f46e5',  // Indigo-600
  accent: '#f43f5e',       // Rose-500

  // Status indicators
  success: '#10b981',      // Emerald-500 (Paid - Green)
  warning: '#f59e0b',      // Amber-500 (Partial - Yellow)
  error: '#ef4444',        // Red-500 (Pending - Red)
  info: '#3b82f6',         // Blue-500
};

export const TYPOGRAPHY = {
  fontFamily: 'System',
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 20,
    xxl: 24,
    jumbo: 32,
  },
  weights: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, y: 1 },
    shadowOpacity: 0.18,
    shadowRadius: 1.0,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, y: 3 },
    shadowOpacity: 0.27,
    shadowRadius: 4.65,
    elevation: 6,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, y: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 12.0,
    elevation: 12,
  },
};
