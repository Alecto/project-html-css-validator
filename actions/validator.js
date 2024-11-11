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
      const res = await validateCSS(data);
      log(' ----- Тестування файлу... ----- ');

      if (res.valid) {
        log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валідний ')} `);
      } else {
        log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валідний ')} `);
        log(res.errors);
      }
    } catch (err) {
      console.error(`Помилка читання CSS файлу: ${file}`);
    }
  }

  log('\n');
}

(async () => {
  try {
    log(''); // Добавление пустой строки перед тестами
    const htmlValidationResult = await htmlValidation();
    const cssValidationResult = await cssValidation();
    // console.log(htmlValidationResult); // Блок отладки ответа HTML валидатора
    // console.log(cssValidationResult); // Блок отладки ответа CSS валидатора
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
  if (!data) return { valid: true, errors: [] }; // объект с отсуствием ошибок, если файл пустой
  return cssValidator.validateText(data, { medium: 'all', timeout: 3000});
}

function excludeFiles(files) {
  return files
    .sort()
    .filter((file) => !EXCLUDE_FILES.some((str) => file.includes(str)));
}
