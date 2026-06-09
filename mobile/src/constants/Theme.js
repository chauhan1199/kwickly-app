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
    sm: 4,
    md: 8,
    lg: 12,
    xl: 16,
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
    }
  }
};

export const DarkTheme = {
  ...common,
  colors: {
    primary: '#43e3eb',
    primaryDark: '#0e9aa7',
    secondary: '#7ed957',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#070b14',
    card: '#101826',
    surface: '#101826',
    surface2: '#0a121e',
    border: '#1c2738',
    text: '#e8eef7',
    textMuted: '#8a99ad',
    textDim: '#5b6776',
    white: '#ffffff',
    black: '#000000',
    navy: '#0a1530',
  }
};

export const LightTheme = {
  ...common,
  colors: {
    primary: '#0e9aa7',
    primaryDark: '#07737e',
    secondary: '#43e3eb',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    background: '#f6f8fb',
    card: '#ffffff',
    surface: '#ffffff',
    surface2: '#f1f4f8',
    border: '#e5eaf0',
    text: '#0b1422',
    textMuted: '#5b6776',
    textDim: '#8a99ad',
    white: '#ffffff',
    black: '#000000',
    navy: '#0f1b3d',
  }
};

export default DarkTheme;
