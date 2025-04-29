import { glob } from 'glob';
import fs from 'fs';
import { w3cHtmlValidator } from 'w3c-html-validator';
import {
  printTitle,
  validateCSS,
  excludeFiles,
  displayCssValidationResult,
  displayError,
  displayRateLimitError,
  validateWithRetries
} from './helpers.mjs';
import {
  HTML_FILES_PATTERN,
  CSS_FILES_PATTERN,
  IGNORE_PATTERNS
} from './constants.mjs';
import chalk from 'chalk';

const log = console.log;

// Тестирование HTML
async function htmlValidation() {
  const filesFiltered = excludeFiles(
    await glob(HTML_FILES_PATTERN),
    IGNORE_PATTERNS
  );

  if (!filesFiltered.length) {
    log(chalk.inverse(` HTML файлів немає, перевірка не виконувалася `));
    log('\n');
    return null;
  }
  printTitle(log, filesFiltered.length, 'HTML');

  for (const file of filesFiltered) {
    // Валідуємо файл з можливими повторними спробами
    const result = await validateWithRetries(
      file,
      w3cHtmlValidator,
      log,
      chalk
    );

    // Якщо результат null (валідація не вдалася після всіх спроб)
    if (result === null) {
      log(
        chalk.red.bold(
          '[ПОМИЛКА] Валідація HTML зупинена через невдалу перевірку файлу після всіх спроб'
        )
      );
      log('');
      log(chalk.yellow('Переходимо до валідації CSS файлів...'));
      log('');
      return null;
    }

    // Виводимо результат
    log(chalk.green('Виведення результатів валідації:'));
    w3cHtmlValidator.reporter(result, {
      continueOnFail: true,
      maxMessageLen: 200
    });

    // Перевіряємо, чи має файл помилки валідації (не мережеві помилки)
    if (
      result.messages &&
      result.messages.length > 0 &&
      !result.messages.every(
        (msg) =>
          msg.subType === 'network-error' ||
          msg.message?.includes('429 Too Many Requests')
      )
    ) {
      // Якщо знайдено невалідний HTML файл - зупиняємо перевірку
      log(
        chalk.red.bold(
          '[ПОМИЛКА] Валідація HTML зупинена через виявлення невалідного файлу'
        )
      );
      log('');
      log(chalk.yellow('Переходимо до валідації CSS файлів...'));
      log('');
      log('');
      return null;
    }
  }

  log('\n');
}

// Тестирование CSS
async function cssValidation() {
  const filesFiltered = excludeFiles(
    await glob(CSS_FILES_PATTERN),
    IGNORE_PATTERNS
  );

  if (!filesFiltered.length) {
    log(chalk.inverse(` CSS файлів немає, перевірка не виконувалася `));
    log('\n');
    return null;
  }
  printTitle(log, filesFiltered.length, 'CSS');

  for (const file of filesFiltered) {
    try {
      const data = await fs.promises.readFile(file, 'utf8');
      try {
        const res = await validateCSS(data);
        displayCssValidationResult(log, file, res);
      } catch (validationError) {
        if (validationError.statusCode === 429) {
          displayRateLimitError(log);
        } else {
          displayError(log, 'Помилка валідації CSS', validationError);
        }
      }
    } catch (err) {
      displayError(log, `Помилка читання CSS файлу ${file}`, err);
    }
  }

  log('\n');
}

// Головна функція запуску валідації
(async () => {
  try {
    log('');
    const htmlValidationResult = await htmlValidation();
    const cssValidationResult = await cssValidation();
  } catch (err) {
    console.error(err);
  }
})();
