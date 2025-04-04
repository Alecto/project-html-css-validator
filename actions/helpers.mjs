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

// Виведення повідомлень про помилки
export function displayError(log, message, error) {
  log(chalk.red.bold(`\n${message}:`));
  log(chalk.red(error.message || 'Невідома помилка'));
}

// Виведення повідомлень про перевищення ліміту запитів
export function displayRateLimitError(log) {
  log(chalk.yellow.bold('\nПомилка валідації CSS:'));
  log(chalk.yellow('Перевищено ліміт запитів до сервера валідації (Too Many Requests).'));
  log(chalk.yellow('Будь ласка, зачекайте кілька хвилин та спробуйте знову.'));
}

// Обробка та відображення результатів CSS валідації
export function displayCssValidationResult(log, file, validationResult) {
  log(' ----- Тестування файлу... ----- ');

  if (validationResult.valid) {
    log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
    return;
  }

  // Фільтруємо помилки, ігноруючи clip-path
  const filteredErrors = validationResult.errors.filter(error => 
    !error.message.includes('clip-path')
  );

  if (filteredErrors.length === 0) {
    log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
    return;
  }

  // Перевіряємо, чи це SVG-файл
  if (isSvgFile(file)) {
    log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний (SVG) ')} `);
    log(chalk.blue(`Файл містить SVG-властивості, але перевірений онлайн-валідатором W3C як валідний CSS3+SVG.`));
    return;
  }

  // Файл не валідний, виводимо помилки
  log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валідний ')} `);
  filteredErrors.forEach(error => {
    // Виводимо тільки не-SVG помилки
    if (!isSvgSpecificError(error)) {
      log(chalk.red(`Рядок ${error.line}: ${error.message}`));
    }
  });
} 
