const common = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  radius: {
    sm: 6,
    md: 10,
    lg: 14,
    xl: 18,
    xxl: 24,
    full: 999,
  },
  typography: {
    fontFamily: 'System',
    sizes: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    weights: {
      regular: '400',
      medium: '500',
      semiBold: '600',
      bold: '700',
      extraBold: '800',
      black: '900',
    }
  }
};

export const LightTheme = {
  ...common,
  mode: 'light',
  colors: {
    primary: '#6C47FF',
    primaryDark: '#5535d4',
    primaryLight: '#EDE9FE',
    secondary: '#8B6FFF',
    accent: '#06B6D4',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#F8F9FD',
    card: '#FFFFFF',
    surface: '#FFFFFF',
    surface2: '#F1F4F9',
    border: '#E2E8F0',
    borderLight: '#EDF2F7',
    text: '#0F172A',
    textMuted: '#64748B',
    textDim: '#94A3B8',
    white: '#FFFFFF',
    black: '#000000',
    navy: '#0F172A',
  }
};

export const DarkTheme = {
  ...common,
  mode: 'dark',
  colors: {
    primary: '#7C3AED',
    primaryDark: '#6D28D9',
    primaryLight: 'rgba(124, 58, 237, 0.15)',
    secondary: '#A78BFA',
    accent: '#22D3EE',
    success: '#10B981',
    warning: '#F59E0B',
    danger: '#EF4444',
    background: '#0B0F19',
    card: '#131B2E',
    surface: '#131B2E',
    surface2: '#1E293B',
    border: '#1E293B',
    borderLight: '#334155',
    text: '#F8FAFC',
    textMuted: '#94A3B8',
    textDim: '#64748B',
    white: '#FFFFFF',
    black: '#000000',
    navy: '#0B0F19',
  }
};

export default LightTheme;
