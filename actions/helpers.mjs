import cssValidator from 'w3c-css-validator';
import chalk from 'chalk';
import { SVG_PROPERTIES, DEFAULT_CSS_VALIDATOR_OPTIONS } from './constants.mjs';

// Перевірка, чи є помилка SVG-специфічною
export function isSvgSpecificError(error) {
  return SVG_PROPERTIES.some(prop => error.message.includes(prop));
}

// Перевірка, чи є файл SVG-файлом
export function isSvgFile(filePath) {
  return filePath.includes('SVG-main');
}

// Фільтрація помилок, пов'язаних з SVG-властивостями
export function filterSvgErrors(errors) {
  if (!errors || !errors.length) return errors;
  
  return errors.filter(error => !isSvgSpecificError(error));
}

// Виведення заголовка для валідації
export function printTitle(log, count, msg) {
  log(count
    ? chalk.bgBlue(` Тестування ${count} файлів ${msg} \n`)
    : chalk.inverse(` ${msg} файлів немає, перевірка не виконувалася `)
  );
}

// Виконує запит до валідатора з заданими параметрами
export async function validateWithCssValidator(data, options) {
  const result = await cssValidator.validateText(data, options || DEFAULT_CSS_VALIDATOR_OPTIONS);
  
  // Фільтруємо SVG-специфічні помилки
  if (result.errors && result.errors.length) {
    result.errors = filterSvgErrors(result.errors);
    
    // Якщо всі помилки відфільтровані, вважаємо файл валідним
    if (result.errors.length === 0) {
      result.valid = true;
    }
  }
  
  return result;
}

// Валідація CSS даних
export async function validateCSS(data) {
  if (!data) return { valid: true, errors: [] };
  
  try {
    return await validateWithCssValidator(data);
  } catch (error) {
    // Додаємо затримку при помилці Too Many Requests
    if (error.statusCode === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунди затримки
      
      // Повторна спроба
      try {
        return await validateWithCssValidator(data);
      } catch (retryError) {
        throw retryError;
      }
    }
    throw error;
  }
}

// Виключення файлів з перевірки
export function excludeFiles(files, excludePatterns) {
  return files
    .sort()
    .filter((file) => !excludePatterns.some((str) => file.includes(str)));
} 
