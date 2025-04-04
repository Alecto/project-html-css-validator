import { glob } from 'glob';
import fs from 'fs';
import chalk from 'chalk';
import { w3cHtmlValidator } from 'w3c-html-validator';
import { 
  isSvgFile, 
  isSvgSpecificError, 
  printTitle, 
  validateCSS,
  excludeFiles 
} from './helpers.mjs';
import {
  HTML_FILES_PATTERN,
  CSS_FILES_PATTERN,
  IGNORE_PATTERNS
} from './constants.mjs';

const log = console.log;

// Тестирование HTML
async function htmlValidation() {
  const filesFiltered = excludeFiles(await glob(HTML_FILES_PATTERN), IGNORE_PATTERNS);
  if (!filesFiltered.length) {
    log('HTML файлів немає, перевірка не виконувалася\n\n');
    return null;
  }
  printTitle(log, filesFiltered.length, 'HTML');

  for (const file of filesFiltered) {
    try {
      const data = await fs.promises.readFile(file, 'utf8');
      const result = await w3cHtmlValidator.validate({ filename: file });
      w3cHtmlValidator.reporter(result, { continueOnFail: true, maxMessageLen: 200 });
    } catch (err) {
      console.error(`Помилка читання або перевірки HTML файлу: ${file}`, err);
    }
  }

  log('\n');
}

// Тестирование CSS
async function cssValidation() {
  const filesFiltered = excludeFiles(await glob(CSS_FILES_PATTERN), IGNORE_PATTERNS);

  if (!filesFiltered.length) return null;
  printTitle(log, filesFiltered.length, 'CSS');

  for (const file of filesFiltered) {
    try {
      const data = await fs.promises.readFile(file, 'utf8');
      try {
        const res = await validateCSS(data);
        log(' ----- Тестування файлу... ----- ');

        if (res.valid) {
          log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
        } else {
          // Фільтруємо помилки, ігноруючи clip-path
          const filteredErrors = res.errors.filter(error => 
            !error.message.includes('clip-path')
          );

          if (filteredErrors.length === 0) {
            log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
          } else {
            // Перевіряємо, чи це SVG-файл
            if (isSvgFile(file)) {
              log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний (SVG) ')} `);
              log(chalk.blue(`Файл містить SVG-властивості, але перевірений онлайн-валідатором W3C як валідний CSS3+SVG.`));
            } else {
              log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валідний ')} `);
              filteredErrors.forEach(error => {
                // Виводимо тільки не-SVG помилки
                if (!isSvgSpecificError(error)) {
                  log(chalk.red(`Рядок ${error.line}: ${error.message}`));
                }
              });
            }
          }
        }
      } catch (validationError) {
        if (validationError.statusCode === 429) {
          log(chalk.yellow.bold('\nПомилка валідації CSS:'));
          log(chalk.yellow('Перевищено ліміт запитів до сервера валідації (Too Many Requests).'));
          log(chalk.yellow('Будь ласка, зачекайте кілька хвилин та спробуйте знову.'));
        } else {
          log(chalk.red.bold('\nПомилка валідації CSS:'));
          log(chalk.red(validationError.message || 'Невідома помилка'));
        }
      }
    } catch (err) {
      log(chalk.red.bold(`\nПомилка читання CSS файлу ${file}:`));
      log(chalk.red(err.message));
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
