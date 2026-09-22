// mobile/constants/Colors.ts
export const Colors = {
  light: {
    background: '#ffffff',
    text: '#111827',
    primary: '#ef4444', // Çöp kırmızısı
    inputBg: '#f3f4f6',
    inputBorder: '#d1d5db',
    mutedText: '#6b7280',
    overlay: 'rgba(17, 24, 39, 0.35)'
  },
  dark: {
    background: '#111827',
    text: '#ffffff',
    primary: '#ef4444',
    inputBg: '#1f2937',
    inputBorder: '#374151',
    mutedText: '#9ca3af',
    overlay: 'rgba(0, 0, 0, 0.7)'
  }
};
// Şimdilik default olarak dark temayı kullanalım
export const currentTheme = Colors.dark;
