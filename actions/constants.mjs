// Налаштування CSS валідатора за замовчуванням
export const DEFAULT_CSS_VALIDATOR_OPTIONS = {
  medium: 'all',
  timeout: 5000,
  profile: 'css3svg',
  warningLevel: 0
};

// Патерни пошуку файлів
export const HTML_FILES_PATTERN = './**/*.html';
export const CSS_FILES_PATTERN = './**/*.css';
export const IGNORE_PATTERNS = [
  'node_modules',
  'libs',
  'bootstrap',
  'bootstrap-5',
  'normalize.css',
  'bootstrap.',
  'reset.css'
];
