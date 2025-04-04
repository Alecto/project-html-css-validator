// SVG-специфічні властивості для перевірки
export const SVG_PROPERTIES = [
  'Property "fill" doesn\'t exist',
  'Property "stroke" doesn\'t exist',
  'Property "stroke-width" doesn\'t exist'
];

// Налаштування CSS валідатора за замовчуванням
export const DEFAULT_CSS_VALIDATOR_OPTIONS = { 
  medium: 'all', 
  timeout: 5000,
  profile: 'css3',
  warning: 'no',
  level: 'css3',
  output: 'json',
  lang: 'en',
  charset: 'utf-8',
  doctype: 'HTML5'
}; 

// Патерни пошуку файлів
export const HTML_FILES_PATTERN = "./**/*.html";
export const CSS_FILES_PATTERN = "./**/*.css";
export const IGNORE_PATTERNS = ["node_modules", "libs", "bootstrap", "bootstrap-5", "normalize.css", "bootstrap.", "reset.css"]; 
