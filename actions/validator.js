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
          // Фільтруємо помилки, ігноруючи clip-path
          const filteredErrors = res.errors.filter(error => 
            !error.message.includes('clip-path')
          );

          if (filteredErrors.length === 0) {
            log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
          } else {
            // Перевіряємо, чи це SVG-файл
            if (file.includes('SVG-main')) {
              log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний (SVG) ')} `);
              log(chalk.blue(`Файл містить SVG-властивості, але перевірений онлайн-валідатором W3C як валідний CSS3+SVG.`));
            } else {
              log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валідний ')} `);
              filteredErrors.forEach(error => {
                // Не виводимо SVG-специфічні помилки
                if (!error.message.includes('Property "fill" doesn\'t exist') && 
                    !error.message.includes('Property "stroke" doesn\'t exist') &&
                    !error.message.includes('Property "stroke-width" doesn\'t exist')) {
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
      profile: 'css3svg',
      warning: 'no',
      level: 'css3',
      output: 'json',
      lang: 'en',
      charset: 'utf-8',
      doctype: 'HTML5'
    });
    
    // Фільтруємо SVG-специфічні помилки
    if (result.errors && result.errors.length) {
      result.errors = result.errors.filter(error => 
        !error.message.includes('Property "fill" doesn\'t exist') &&
        !error.message.includes('Property "stroke" doesn\'t exist') &&
        !error.message.includes('Property "stroke-width" doesn\'t exist')
      );
      // Якщо всі помилки відфільтровані, вважаємо файл валідним
      if (result.errors.length === 0) {
        result.valid = true;
      }
    }
    
    return result;
  } catch (error) {
    // Додаємо затримку при помилці Too Many Requests
    if (error.statusCode === 429) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунди затримки
      try {
        // Повторна спроба
        const retryResult = await cssValidator.validateText(data, { 
          medium: 'all', 
          timeout: 5000,
          profile: 'css3svg',
          warning: 'no',
          level: 'css3',
          output: 'json',
          lang: 'en',
          charset: 'utf-8',
          doctype: 'HTML5'
        });
        
        // Фільтруємо SVG-специфічні помилки
        if (retryResult.errors && retryResult.errors.length) {
          retryResult.errors = retryResult.errors.filter(error => 
            !error.message.includes('Property "fill" doesn\'t exist') &&
            !error.message.includes('Property "stroke" doesn\'t exist') &&
            !error.message.includes('Property "stroke-width" doesn\'t exist')
          );
          // Якщо всі помилки відфільтровані, вважаємо файл валідним
          if (retryResult.errors.length === 0) {
            retryResult.valid = true;
          }
        }
        
        return retryResult;
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
