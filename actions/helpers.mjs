import cssValidator from 'w3c-css-validator';
import chalk from 'chalk';
import {
  DEFAULT_CSS_VALIDATOR_OPTIONS,
  GLOBAL_IGNORE_DIRS
} from './constants.mjs';
import path from 'path';

// Виведення заголовка для валідації
export function printTitle(log, count, msg) {
  log('');
  log(
    count
      ? chalk.bgBlue(` Тестування ${count} файлів ${msg} `)
      : chalk.inverse(` ${msg} файлів немає, перевірка не виконувалася `)
  );
  log('');
}

// Виконує запит до валідатора з заданими параметрами
export async function validateWithCssValidator(data, options) {
  return await cssValidator.validateText(
    data,
    options || DEFAULT_CSS_VALIDATOR_OPTIONS
  );
}

// Валідація CSS даних
export async function validateCSS(data, logger, chalkObj) {
  if (!data) return { valid: true, errors: [] };

  // Якщо не передані logger і chalk - просто валідуємо один раз
  if (!logger || !chalkObj) {
    try {
      return await validateWithCssValidator(data);
    } catch (error) {
      throw error;
    }
  }

  // Використовуємо стратегію з повторними спробами
  return await validateContentWithRetries(
    data,
    (content) => validateWithCssValidator(content),
    logger,
    chalkObj,
    'CSS'
  );
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

  // Використовуємо path.posix для коректного відображення шляху
  const formattedFile = path.posix.normalize(file.split(path.sep).join('/'));

  if (validationResult.valid) {
    log(
      ` ${chalk.green.bold(formattedFile)} ${chalk.black.bgGreen(
        ' Валідний '
      )} `
    );
    return;
  }

  // Файл не валідний, виводимо помилки
  log(
    ` ${chalk.red.bold(formattedFile)} ${chalk.white.bgRed(' НЕ валідний ')} `
  );
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
  // Спроба 1 (без затримки)
  try {
    logger(chalk.dim(`Валідація файлу ${file}...`));
    const result = await validator.validate({ filename: file });

    if (!hasValidationError(result)) {
      return result; // Успішна валідація з першої спроби
    }

    // Є помилки, спробуємо знову через 2 секунди
    const errorMessage = getErrorMessage(result);
    logger(chalk.yellow('\nВиявлено проблему з підключенням до валідатора:'));
    logger(chalk.yellow(`${errorMessage}`));
    logger(chalk.yellow('Очікування 2 секунди перед повторною спробою...'));

    await wait(2000);

    // Спроба 2
    logger(chalk.yellow(`Виконую повторну спробу для файлу ${file}...`));
    const retryResult = await validator.validate({ filename: file });

    if (!hasValidationError(retryResult)) {
      logger(chalk.green('Повторна спроба успішна.'));
      return retryResult; // Успішна валідація з другої спроби
    }

    // Все ще є помилки, спробуємо втретє через 5 секунд
    logger(chalk.yellow('\nПерша повторна спроба неуспішна.'));
    logger(chalk.yellow('Очікування 5 секунд перед третьою спробою...'));
    await wait(5000);

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
      logger(chalk.yellow('Очікування 2 секунди перед повторною спробою...'));
      await wait(2000);

      try {
        // Спроба 2 (після виключення) - через 2 секунди
        logger(chalk.yellow(`Виконую повторну спробу для файлу ${file}...`));
        const retryResult = await validator.validate({ filename: file });

        if (!hasValidationError(retryResult)) {
          logger(chalk.green('Повторна спроба успішна.'));
          return retryResult;
        }

        // Спроба 3 (після виключення) - через 5 секунд
        logger(chalk.yellow('\nПерша повторна спроба неуспішна.'));
        logger(chalk.yellow('Очікування 5 секунд перед третьою спробою...'));
        await wait(5000);

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
            // Фінальна спроба після двох виключень - через 5 секунд
            logger(chalk.yellow('\nПерша повторна спроба неуспішна.'));
            logger(
              chalk.yellow('Очікування 5 секунд перед третьою спробою...')
            );
            await wait(5000);

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

/**
 * Валідує вміст (HTML або CSS) з повторними спробами
 * @param {string} content - вміст для валідації
 * @param {Function} validatorFn - функція валідатора
 * @param {Function} logger - функція для логування
 * @param {Object} chalk - об'єкт для кольорового виводу
 * @param {string} fileType - тип файлу ('HTML' або 'CSS')
 * @returns {Promise<Object|null>} результат валідації або null у випадку помилки
 */
export async function validateContentWithRetries(
  content,
  validatorFn,
  logger,
  chalk,
  fileType
) {
  // Спроба 1 (без затримки)
  try {
    const result = await validatorFn(content);

    // Перевіряємо чи успішна валідація
    if (fileType === 'CSS' ? result.valid : !hasValidationError(result)) {
      return result; // Успішна валідація з першої спроби
    }

    // Є помилки, спробуємо знову через 2 секунди
    logger(chalk.yellow('\nВиявлено проблему з підключенням до валідатора:'));
    if (fileType === 'CSS') {
      logger(chalk.yellow("Перевищено ліміт запитів або помилка з'єднання"));
    } else {
      const errorMessage = getErrorMessage(result);
      logger(chalk.yellow(`${errorMessage}`));
    }
    logger(
      chalk.yellow(
        'Спроба 1 неуспішна. Очікування 2 секунди перед спробою 2...'
      )
    );

    await wait(2000);

    // Спроба 2
    logger(chalk.yellow(`Виконую спробу 2 для ${fileType}...`));
    const retryResult = await validatorFn(content);

    if (
      fileType === 'CSS' ? retryResult.valid : !hasValidationError(retryResult)
    ) {
      logger(chalk.green('Спроба 2 успішна.'));
      return retryResult; // Успішна валідація з другої спроби
    }

    // Все ще є помилки, спробуємо втретє через 5 секунд
    logger(chalk.yellow('\nСпроба 2 неуспішна.'));
    logger(chalk.yellow('Очікування 5 секунд перед спробою 3...'));
    await wait(5000);

    // Спроба 3
    logger(chalk.yellow(`Виконую спробу 3 для ${fileType}...`));
    const thirdResult = await validatorFn(content);

    if (
      fileType === 'CSS' ? thirdResult.valid : !hasValidationError(thirdResult)
    ) {
      logger(chalk.green('Спроба 3 успішна.'));
      return thirdResult; // Успішна валідація з третьої спроби
    }

    // Після трьох спроб все ще є помилки
    logger(chalk.red.bold(`\nПомилка валідації ${fileType}:`));
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
          `\nПеревищено ліміт запитів до валідатора ${fileType} (429 Too Many Requests).`
        )
      );
      logger(
        chalk.yellow(
          'Спроба 1 неуспішна. Очікування 2 секунди перед спробою 2...'
        )
      );
      await wait(2000);

      try {
        // Спроба 2 (після виключення) - через 2 секунди
        logger(chalk.yellow(`Виконую спробу 2 для ${fileType}...`));
        const retryResult = await validatorFn(content);

        if (
          fileType === 'CSS'
            ? retryResult.valid
            : !hasValidationError(retryResult)
        ) {
          logger(chalk.green('Спроба 2 успішна.'));
          return retryResult;
        }

        // Спроба 3 (після виключення) - через 5 секунд
        logger(chalk.yellow('\nСпроба 2 неуспішна.'));
        logger(chalk.yellow('Очікування 5 секунд перед спробою 3...'));
        await wait(5000);

        logger(chalk.yellow(`Виконую спробу 3 для ${fileType}...`));
        const thirdResult = await validatorFn(content);

        if (
          fileType === 'CSS'
            ? thirdResult.valid
            : !hasValidationError(thirdResult)
        ) {
          logger(chalk.green('Спроба 3 успішна.'));
          return thirdResult;
        }

        logger(chalk.red.bold('\nПомилка після всіх спроб:'));
        logger(
          chalk.red(
            `Перевищено ліміт запитів до сервера ${fileType}. Спробуйте пізніше.`
          )
        );
        return null;
      } catch (retryErr) {
        logger(chalk.red.bold(`\nПомилка при валідації ${fileType}:`));
        logger(chalk.red(retryErr.message || 'Невідома помилка'));
        return null;
      }
    } else {
      logger(chalk.red.bold(`\nПомилка валідації ${fileType}:`));
      logger(chalk.red(err.message || 'Невідома помилка'));
      return null;
    }
  }
}
