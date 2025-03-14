import { glob } from 'glob';
import cssValidator from 'w3c-css-validator';
import fs from 'fs';
import chalk from 'chalk';
import { w3cHtmlValidator } from 'w3c-html-validator';

// Заміна динамічного імпорту на зчитування JSON через fs.promises
const DATA = JSON.parse(await fs.promises.readFile(new URL('./settings.json', import.meta.url), 'utf8'));

const log = console.log;
const HTML_FILES = DATA.htmlFiles;
const CSS_FILES = DATA.cssFiles;
const EXCLUDE_FILES = DATA.ignore;

// Тестирование HTML
async function htmlValidation() {
  const filesFiltered = excludeFiles(await glob(HTML_FILES));
  if (!filesFiltered.length) {
    log('HTML файлів немає, перевірка не виконувалася\n\n');
    return null;
  }
  printTitle(filesFiltered.length, 'HTML');

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
  const filesFiltered = excludeFiles(await glob(CSS_FILES));

  if (!filesFiltered.length) return null;
  printTitle(filesFiltered.length, 'CSS');

  for (const file of filesFiltered) {
    try {
      const data = await fs.promises.readFile(file, 'utf8');
      try {
        const res = await validateCSS(data);
        log(' ----- Тестування файлу... ----- ');

        if (res.valid) {
          log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
        } else {
          log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валідний ')} `);
          if (res.errors && res.errors.length) {
            res.errors.forEach(error => {
              log(chalk.red(`Рядок ${error.line}: ${error.message}`));
            });
          } else {
            log(chalk.red('Невідома помилка валідації'));
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

(async () => {
  try {
    log('');
    const htmlValidationResult = await htmlValidation();
    const cssValidationResult = await cssValidation();
  } catch (err) {
    console.error(err);
  }
})();

function printTitle(count, msg) {
  log(count
    ? chalk.bgBlue(` Тестування ${count} файлів ${msg} \n`)
    : chalk.inverse(` ${msg} файлів немає, перевірка не виконувалася `)
  );
}

async function validateCSS(data) {
  if (!data) return { valid: true, errors: [] };
  
  try {
    const result = await cssValidator.validateText(data, { 
      medium: 'all', 
      timeout: 5000,
      profile: 'css3',
      warning: 'no'
    });
    
    return result;
  } catch (error) {
    // Додаємо затримку при помилці Too Many Requests
    if (error.statusCode === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунди затримки
      try {
        // Повторна спроба
        return await cssValidator.validateText(data, { 
          medium: 'all', 
          timeout: 5000,
          profile: 'css3',
          warning: 'no'
        });
      } catch (retryError) {
        throw retryError;
      }
    }
    throw error;
  }
}

function excludeFiles(files) {
  return files
    .sort()
    .filter((file) => !EXCLUDE_FILES.some((str) => file.includes(str)));
}
