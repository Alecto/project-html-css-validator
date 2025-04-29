import { glob } from 'glob';
import fs from 'fs';
import { w3cHtmlValidator } from 'w3c-html-validator';
import {
  printTitle,
  validateCSS,
  excludeFiles,
  displayCssValidationResult,
  displayError,
  displayRateLimitError
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
    try {
      const data = await fs.promises.readFile(file, 'utf8');
      const result = await w3cHtmlValidator.validate({ filename: file });
      w3cHtmlValidator.reporter(result, {
        continueOnFail: true,
        maxMessageLen: 200
      });
    } catch (err) {
      console.error(`Помилка читання або перевірки HTML файлу: ${file}`, err);
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
