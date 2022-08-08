import glob from 'glob';
import cssValidator from 'w3c-css-validator';
import fs from 'fs';
import chalk from 'chalk';
import { w3cHtmlValidator } from 'w3c-html-validator';

import DATA from './settings.json' assert {type: 'json'};

const log = console.log;
const HTML_FILES = DATA.htmlFiles;
const CSS_FILES = DATA.cssFiles;
const EXCLUDE_FILES = DATA.ignore;

// Тестирование HTML
function htmlValidation() {
  let counter = 0;
  log(chalk.bgBlue(' Тестирование HTML '));

  return new Promise((resolve) => {
    glob(HTML_FILES, (err, files) => {
      let filesFiltered = files.filter(
        (file) => !EXCLUDE_FILES.some((str) => file.indexOf(str) !== -1)
      );

      filesFiltered.forEach((file) => {
        fs.readFile(file, 'utf8', (err, data) => {
          if (err) return;

          w3cHtmlValidator.validate({ filename: file }).then((res) => {
            w3cHtmlValidator.reporter(res);
            if (filesFiltered.length === ++counter) resolve('finished');
          });
        });
      });
    });
  });
}

// Тестирование CSS
function cssValidation() {
  return new Promise((resolve) => {
    let counter = 0;
    log(chalk.bgBlue(' Тестирование CSS '));

    glob(CSS_FILES, function (err, files) {
      let filesFiltered = files.filter(
        (file) => !EXCLUDE_FILES.some((str) => file.indexOf(str) !== -1)
      );

      filesFiltered.forEach((file) => {
        fs.readFile(file, 'utf8', (err, data) => {
          if (err) return;

          validateCSS(data).then((res) => {
            console.log(' ----- Тестирование файла... ----- ');

            if (res.valid) {
              log(
                ` ${chalk.green.bold(file)} ${chalk.black.bgGreen(
                  ' Валиден '
                )} `
              );
            } else {
              log(
                ` ${chalk.red.bold(file)} ${chalk.white.bgRed(' НЕ валиден ')} `
              );
            }

            if (!res.valid) console.log(res.errors);

            if (filesFiltered.length === ++counter) resolve('finished');
          });
        });
      });
    });
  });
}

async function validateCSS(data) {
  if (!data) {
    return { valid: true, errors: [] }; // объект с отсуствием ошибок, если файл пустой
  }

  const result = await cssValidator.validateText(data, {
    medium: 'all',
    timeout: 3000,
  });

  return result;
}

console.log('\n');
htmlValidation().then((res) => {
  console.log('\n');
  cssValidation().then(() => {
    console.log('\n');
  });
});
