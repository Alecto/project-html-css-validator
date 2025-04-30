import { glob } from 'glob';
import fs from 'fs';
import { w3cHtmlValidator } from 'w3c-html-validator';
import {
  printTitle,
  validateCSS,
  excludeFiles,
  displayCssValidationResult,
  displayError,
  validateContentWithRetries
} from './helpers.mjs';
import {
  HTML_FILES_PATTERN,
  CSS_FILES_PATTERN,
  IGNORE_PATTERNS
} from './constants.mjs';
import chalk from 'chalk';
import path from 'path';

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
  log(chalk.inverse.green(' Виведення результатів HTML валідації: '));

  // Змінна для відстеження наявності помилок у попередньому файлі
  let previousFileHadErrors = false;

  for (const file of filesFiltered) {
    try {
      const fileContent = { filename: file }; // W3C HTML валідатор приймає об'єкт з ім'ям файлу

      // Використовуємо спільну стратегію валідації для HTML
      const result = await validateContentWithRetries(
        fileContent,
        (content) => w3cHtmlValidator.validate(content),
        log,
        chalk,
        'HTML'
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

      // Перевіряємо, чи має файл помилки валідації (не мережеві помилки)
      const hasErrors =
        result.messages &&
        result.messages.length > 0 &&
        !result.messages.every(
          (msg) =>
            msg.subType === 'network-error' ||
            msg.message?.includes('429 Too Many Requests')
        );

      if (hasErrors) {
        // Додаємо порожній рядок перед повідомленням про помилку тільки якщо попередній файл не мав помилок
        if (!previousFileHadErrors) {
          log('');
        }
        log(
          chalk.red.bold(
            `[ПОМИЛКА] Виявлено невалідний HTML файл: ${path.posix.normalize(
              file.split(path.sep).join('/')
            )}`
          )
        );
      }

      // Виводимо результат
      w3cHtmlValidator.reporter(result, {
        continueOnFail: true,
        maxMessageLen: 200
      });

      // Додаємо порожній рядок після звіту про помилки, але тільки якщо файл має помилки
      if (hasErrors) {
        log('');
      }

      // Оновлюємо статус помилок для наступної ітерації
      previousFileHadErrors = hasErrors;
    } catch (err) {
      displayError(log, `Помилка обробки HTML файлу ${file}`, err);
      log('');
      log(chalk.yellow('Переходимо до валідації CSS файлів...'));
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
  log(chalk.inverse.green('Виведення результатів CSS валідації:'));

  // Змінна для відстеження наявності помилок у попередньому файлі
  let previousFileHadErrors = false;

  for (const file of filesFiltered) {
    try {
      const data = await fs.promises.readFile(file, 'utf8');

      // Використовуємо валідацію з повторними спробами
      const result = await validateCSS(data, log, chalk);

      // Якщо результат null (валідація не вдалася після всіх спроб)
      if (result === null) {
        log(
          chalk.red.bold(
            '[ПОМИЛКА] Валідація CSS зупинена через невдалу перевірку файлу після всіх спроб'
          )
        );
        log('');
        log(chalk.yellow('Завершуємо валідацію...'));
        log('');
        return null;
      }

      // Якщо файл не валідний, показуємо повідомлення перед виведенням деталей
      if (!result.valid) {
        // Додаємо порожній рядок перед повідомленням про помилку тільки якщо попередній файл не мав помилок
        if (!previousFileHadErrors) {
          log('');
        }
        log(
          chalk.red.bold(
            `[ПОМИЛКА] Виявлено невалідний CSS файл: ${path.posix.normalize(
              file.split(path.sep).join('/')
            )}`
          )
        );
        log('');
      }

      // Виводимо результат валідації
      displayCssValidationResult(log, file, result);

      // Додаємо порожній рядок після звіту про помилки, але тільки якщо файл невалідний
      if (!result.valid) {
        log('');
      }

      // Оновлюємо статус помилок для наступної ітерації
      previousFileHadErrors = !result.valid;
    } catch (err) {
      displayError(log, `Помилка читання CSS файлу ${file}`, err);
      log(chalk.yellow('Переходимо до наступного файлу...'));
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
