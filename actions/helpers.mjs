import cssValidator from 'w3c-css-validator';
import chalk from 'chalk';
import {
  DEFAULT_CSS_VALIDATOR_OPTIONS,
  GLOBAL_IGNORE_DIRS
} from './constants.mjs';
import path from 'path';

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
  return files.sort().filter((file) => {
    // Спочатку перевіряємо глобальні ігнорування
    for (const ignoreDir of GLOBAL_IGNORE_DIRS) {
      if (file.includes(ignoreDir)) {
        return false;
      }
    }

    const parts = file.split(path.sep);

    // Обробка файлів у директорії tests/
    if (parts[0] === 'tests') {
      // Перевірка наступних елементів шляху після tests/dir/ (частини з індексами 2 і вище)
      for (let i = 2; i < parts.length; i++) {
        const part = parts[i];
        for (const pattern of excludePatterns) {
          if (part.includes(pattern)) {
            return false;
          }
        }
      }

      // Якщо жодний патерн не співпав у частинах шляху після tests/dir/
      return true;
    }

    // Файли поза каталогом tests/ ми не перевіряємо
    return false;
  });
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

/**
 * Чекає вказану кількість мілісекунд
 * @param {number} ms - кількість мілісекунд для очікування
 * @returns {Promise<void>}
 */
export function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Перевіряє, чи має результат валідації помилки мережі або ліміту запитів
 * @param {Object} result - результат валідації
 * @returns {boolean} - true якщо є помилки, false якщо немає
 */
export function hasValidationError(result) {
  return (
    result.messages?.some((msg) => msg.subType === 'network-error') ||
    result.messages?.some((msg) =>
      msg.message?.includes('429 Too Many Requests')
    )
  );
}

/**
 * Отримує текст помилки з результату валідації
 * @param {Object} result - результат валідації
 * @returns {string} - повідомлення про помилку
 */
export function getErrorMessage(result) {
  const networkError = result.messages?.find(
    (msg) => msg.subType === 'network-error'
  );
  return networkError
    ? networkError.message
    : 'Перевищено ліміт запитів (429 Too Many Requests)';
}

/**
 * Виконує валідацію HTML з декількома повторними спробами
 * @param {string} file - шлях до файлу для валідації
 * @param {Object} validator - об'єкт валідатора
 * @param {Function} logger - функція логування
 * @param {Object} chalk - об'єкт для кольорового виводу
 * @returns {Promise<Object|null>} - результат валідації або null у випадку помилки
 */
export async function validateWithRetries(file, validator, logger, chalk) {
  // Спроба 1
  try {
    logger(chalk.dim(`Валідація файлу ${file}...`));
    const result = await validator.validate({ filename: file });

    if (!hasValidationError(result)) {
      return result; // Успішна валідація з першої спроби
    }

    // Є помилки, спробуємо знову
    const errorMessage = getErrorMessage(result);
    logger(chalk.yellow('\nВиявлено проблему з підключенням до валідатора:'));
    logger(chalk.yellow(`${errorMessage}`));
    logger(chalk.yellow('Очікування 5 секунд перед повторною спробою...'));

    await wait(5000);

    // Спроба 2
    logger(chalk.yellow(`Виконую повторну спробу для файлу ${file}...`));
    const retryResult = await validator.validate({ filename: file });

    if (!hasValidationError(retryResult)) {
      logger(chalk.green('Повторна спроба успішна.'));
      return retryResult; // Успішна валідація з другої спроби
    }

    // Все ще є помилки, спробуємо втретє
    logger(chalk.yellow('\nПерша повторна спроба неуспішна.'));
    logger(chalk.yellow('Очікування 10 секунд перед третьою спробою...'));
    await wait(10000);

    // Спроба 3
    logger(chalk.yellow(`Виконую третю спробу для файлу ${file}...`));
    const thirdResult = await validator.validate({ filename: file });

    if (!hasValidationError(thirdResult)) {
      logger(chalk.green('Третя спроба успішна.'));
      return thirdResult; // Успішна валідація з третьої спроби
    }

    // Після трьох спроб все ще є помилки
    logger(chalk.red.bold('\nПомилка валідації HTML:'));
    logger(
      chalk.red(
        'Перевищено ліміт запитів до сервера після трьох спроб. Спробуйте пізніше.'
      )
    );
    return null;
  } catch (err) {
    // Обробка винятків при валідації
    if (err.statusCode === 429) {
      logger(
        chalk.yellow(
          '\nПеревищено ліміт запитів до валідатора (429 Too Many Requests).'
        )
      );
      logger(chalk.yellow('Очікування 5 секунд перед повторною спробою...'));
      await wait(5000);

      try {
        // Спроба 2 (після виключення)
        logger(chalk.yellow(`Виконую повторну спробу для файлу ${file}...`));
        const retryResult = await validator.validate({ filename: file });

        if (!hasValidationError(retryResult)) {
          logger(chalk.green('Повторна спроба успішна.'));
          return retryResult;
        }

        // Спроба 3 (після виключення)
        logger(chalk.yellow('\nПерша повторна спроба неуспішна.'));
        logger(chalk.yellow('Очікування 10 секунд перед третьою спробою...'));
        await wait(10000);

        logger(chalk.yellow(`Виконую третю спробу для файлу ${file}...`));
        const thirdResult = await validator.validate({ filename: file });

        if (!hasValidationError(thirdResult)) {
          logger(chalk.green('Третя спроба успішна.'));
          return thirdResult;
        }

        logger(chalk.red.bold('\nПомилка після третьої спроби:'));
        logger(
          chalk.red('Перевищено ліміт запитів до сервера. Спробуйте пізніше.')
        );
        return null;
      } catch (retryErr) {
        // Обробка помилок під час повторних спроб після виключення
        if (retryErr.statusCode === 429) {
          try {
            // Фінальна спроба після двох виключень
            logger(chalk.yellow('\nПерша повторна спроба неуспішна.'));
            logger(
              chalk.yellow('Очікування 10 секунд перед третьою спробою...')
            );
            await wait(10000);

            logger(chalk.yellow(`Виконую третю спробу для файлу ${file}...`));
            const thirdResult = await validator.validate({ filename: file });

            logger(chalk.green('Третя спроба успішна.'));
            return thirdResult;
          } catch (thirdErr) {
            logger(chalk.red.bold('\nПомилка після третьої спроби:'));
            logger(
              chalk.red(
                'Перевищено ліміт запитів до сервера. Спробуйте пізніше.'
              )
            );
            return null;
          }
        } else {
          logger(chalk.red.bold('\nПомилка при повторній валідації HTML:'));
          logger(chalk.red(retryErr.message || 'Невідома помилка'));
          return null;
        }
      }
    } else {
      logger(chalk.red.bold('\nПомилка валідації HTML:'));
      logger(chalk.red(err.message || 'Невідома помилка'));
      return null;
    }
  }
}
