import glob from 'glob';
import cssValidator from 'w3c-css-validator';
import fs from 'fs';
import chalk from 'chalk';
import { w3cHtmlValidator } from 'w3c-html-validator';

import DATA from './settings.json' assert { type: 'json' };

const log = console.log;
const HTML_FILES = DATA.htmlFiles;
const CSS_FILES = DATA.cssFiles;
const EXCLUDE_FILES = DATA.ignore;

// Тестирование HTML
async function htmlValidation() {
  const filesFiltered = excludeFiles(await glob(HTML_FILES))
  let counter = 0

  if (!filesFiltered.length) return null;

  printTitle(filesFiltered.length, 'HTML');

  return new Promise((resolve, reject) => {
    filesFiltered.forEach((file, index) => {
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) reject('Ошибка чтения HTML файла');
        // Устанавливаем небольшую задержку, чтобы меньше нагружать сервер + решаются проблемы сортировки ответов
        setTimeout(() => {
          w3cHtmlValidator.validate({ filename: file })
          .then((reult) => {
            w3cHtmlValidator.reporter(reult, { continueOnFail: true, maxMessageLen: 200 });

            if (filesFiltered.length === ++counter) {
              log('\n'); // Добавляем пустую строку вконце проверки блока HTML
              resolve('ok');
            }
          })
          .catch(() => reject('Что-то пошло не так при проверке HTML.')); // Не используется, но можно отследить ошибку
        }, index * 100)

      });
    });
  })
}

// Тестирование CSS
async function cssValidation() {
  const filesFiltered = excludeFiles(await glob(CSS_FILES))
  let counter = 0

  if (!filesFiltered.length) return null;

  printTitle(filesFiltered.length, 'CSS');

  return new Promise((resolve, reject) => {
    filesFiltered.forEach((file) => {
      fs.readFile(file, 'utf8', (err, data) => {
        if (err) return;

        validateCSS(data)
          .then((res) => {
            log(' ----- Тестирование файла... ----- ');

            if (res.valid) {
              log(` ${chalk.green.bold(file)} ${chalk.black.bgGreen(' Валиден ')} `);
            } else {
              log(` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валиден ')} `);
              log(res.errors)
            }

            if (filesFiltered.length === ++counter) {
              resolve('ok'); // Заканчиваем проверку с ответом 'ok'
              log('\n');
            }
          })
          .catch(() =>  {
            reject('Что-то пошло не так при проверке CSS.'); // Не используется, но можно отследить ошибку
          })
      });
    });
  })
}

log(''); // Добавление пустой строки перед тестами

htmlValidation()
  .then((res) => {
    // console.log(res); // Блок отладки ответа CSS валидатора
    return cssValidation()
  })
  .then((res) => {
    // console.log(res); // Блок отладки ответа CSS валидатора
  })
  .catch((err) => console.error(err));


function printTitle(count, msg) {
  if (count) {
    log(chalk.bgBlue(` Тестирование ${count} файлов ${msg} `));
    log('')

    return;
  }

  log(chalk.inverse(` ${msg} файлов нет, проверка не выполнялась `));
}

async function validateCSS(data) {
  if (!data) return { valid: true, errors: [] }; // объект с отсуствием ошибок, если файл пустой

  const result = await cssValidator
    .validateText(data, {
      medium: 'all',
      timeout: 3000
    });

  return result;
}

function excludeFiles (files) {
  return files
    .sort()
    .filter((file) => !EXCLUDE_FILES.some((str) => file.indexOf(str) !== -1));
}
