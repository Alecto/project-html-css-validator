import cssValidator from 'w3c-css-validator';
import chalk from 'chalk';
import { DEFAULT_CSS_VALIDATOR_OPTIONS } from './constants.mjs';

// Виведення заголовка для валідації
export function printTitle(log, count, msg) {
  log(
    count
      ? chalk.bgBlue(` Тестування ${count} файлів ${msg} \n`)
      : chalk.inverse(` ${msg} файлів немає, перевірка не виконувалася `)
  );
}

// Виконує запит до валідатора з заданими параметрами
export async function validateWithCssValidator(data, options) {
  return await cssValidator.validateText(
    data,
    options || DEFAULT_CSS_VALIDATOR_OPTIONS
  );
}

// Валідація CSS даних
export async function validateCSS(data) {
  if (!data) return { valid: true, errors: [] };

  try {
    return await validateWithCssValidator(data);
  } catch (error) {
    // Додаємо затримку при помилці Too Many Requests
    if (error.statusCode === 429) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 секунди затримки

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
  log(
    chalk.yellow(
      'Перевищено ліміт запитів до сервера валідації (Too Many Requests).'
    )
  );
  log(chalk.yellow('Будь ласка, зачекайте кілька хвилин та спробуйте знову.'));
}

// Обробка та відображення результатів CSS валідації
export function displayCssValidationResult(log, file, validationResult) {
  log(' ----- Тестування файлу... ----- ');

  if (validationResult.valid) {
    log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
    return;
  }

  // Файл не валідний, виводимо помилки
  log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валідний ')} `);
  validationResult.errors.forEach((error) => {
    log(chalk.red(`Рядок ${error.line}: ${error.message}`));
  });
}
