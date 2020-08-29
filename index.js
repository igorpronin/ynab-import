const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const puppeteer = require('puppeteer');
const readline = require('readline');
const moment = require('moment');
moment().format();

const config = require('./config.js');

const makeId = require('./utilites.js').makeId;
const ID = makeId();

const YNABBudgetId = config.YNABBudgetId;
const YNABAccountId = config.YNABAccountId;

// api functions
const YNABApi = require('./api');
const getBudgets = YNABApi.getBudgets;
const getBudget = YNABApi.getBudget;
const getAccounts = YNABApi.getAccounts;
const getPayees = YNABApi.getPayees;
const getCategories = YNABApi.getCategories;
const getCategory = YNABApi.getCategory;
const importTransactions = YNABApi.importTransactions;

const downloadedFilesDir = config.downloadPath;
const filesDir = path.join(__dirname, 'for_import');
const archDir = path.join(__dirname, 'imported');
if (!fs.existsSync(filesDir)){
  fs.mkdirSync(filesDir);
}
if (!fs.existsSync(archDir)){
  fs.mkdirSync(archDir);
}

function promptCode() {
  return new Promise((resolve, reject) => {
    let smsCode;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('Enter code: ', function(code) {
      smsCode = code;
      rl.close();
      resolve(smsCode);
    });
  })
}

function getDataFromTinkoff() {
  return new Promise(async (resolve, reject) => {
    const browser = await puppeteer.launch({
      headless: false,
      args: [`--window-size=1440,900`],
      executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    });
    const context = browser.defaultBrowserContext();
    context.overridePermissions("https://www.tinkoff.ru/", ["geolocation", "notifications"]);
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    await page.goto('https://www.tinkoff.ru/login/');

    await page.waitFor(1000);
    await page.click('[name="login"]');
    await page.keyboard.type(config.login);
    await page.click('[type="submit"]');
    const code = await promptCode();
    await page.keyboard.type(code);
    await page.waitFor(1000);
    await page.keyboard.type(config.pass);
    await page.click('[type="submit"]');
    await page.waitFor(8000);
    const cookies = await page.cookies();
    const psid = cookies.find(item => item.name === 'psid').value;
    const startDate = moment(config.startDate).subtract(config.timezone, 'hours').format('YYYY-MM-DDTHH') + '%3A00%3A00.000Z';
    const endDate = moment(config.endDate).add(1, 'day').subtract(config.timezone, 'hours').subtract(1, 'hours').format('YYYY-MM-DDTHH') + '%3A59%3A59.999Z';
    try {
      await page.goto(`https://www.tinkoff.ru/api/common/v1/export_operations/?format=csv&sessionid=${psid}&start=${startDate}&end=${endDate}&card=0&account=5033199372`);
    } catch {
      console.log('Какая-то ошибка при запросе файла, но все вроде бы должно быть ок...')
    }
    await page.waitFor(5000);
    // await browser.close();
    resolve();
  })
}

function readDir(dir) {
  return new Promise((resolve, reject) => {
    fs.readdir(dir, (err, files) => {
      if (err) {
        reject(err);
        return console.log('Unable to scan directory: ' + err);
      }
      files = files.filter(file => {
        if (file !== '.DS_Store') return file;
      });
      resolve(files);
    });
  });
}

function moveFile(oldPath, newPath) {
  fs.rename(oldPath, newPath, err => {
    if (err) throw err;
  });
}

function decodeFile(file) {
  const fileContent = fs.readFileSync(file);
  const decodedFileContent = iconv.decode(fileContent, config.fileEncoding);
  fs.writeFileSync(file, decodedFileContent);
}

async function getDownloadedFiles() {
  return new Promise(async (resolve, reject) => {
    const dirFiles = await readDir(downloadedFilesDir);
    const downloadedFiles = dirFiles.filter(file => {
      return /^operations.*.csv$/.test(file)
    });
    if (downloadedFiles.length) {
      downloadedFiles.map(async file => {
        await fs.renameSync(
          path.join(downloadedFilesDir, file),
          path.join(filesDir, file)
        )
      })
    }
    resolve();
  })
}

function handleCsv(file) {
  return new Promise(async (resolve, reject) => {
    if (config.decode) {
      await decodeFile(file);
    }
    const results = [];
    fs.createReadStream(file)
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      });
  });
}

function defineCategoryMatch(description, mapping) {
  for (let i = 0; i < mapping.length; i++) {
    const item = mapping[i];
    const operations = item.operations;
    for (let j = 0; j < operations.length; j++) {
      const operation = operations[i];
      if (typeof operation === 'string' && operation === description) {
        return {
          categoryId: item.id
        }
      }
      if (typeof operation === 'object' && operation.name === description) {
        const result = {
          categoryId: item.id
        };
        if (operation.extra_description) {
          result.extra_description = operation.extra_description;
        }
        return result
      }
    }
  }
  return false;
}

// Форматирование данных Тинькофф для YNAB
function formatData(accountId, operations) {
  const transactions = [];
  operations.forEach((operation) => {
    let description = operation['Описание'];
    const item = {
      date: operation['Дата операции'].split(' ')[0].split('.').reverse().join('-'),
      amount: Math.round(Number(operation['Сумма платежа'].replace(',', '.')) * 1000), // Формат чисел в YNAB
      account_id: accountId,
      memo: description
    };
    if (operation['Валюта операции'] !== 'RUB') {
      item.memo += ` (${operation['Валюта операции']} ${operation['Сумма операции'].replace('-', '')})`;
    }
    item.memo.trim();
    const categoryMatch = defineCategoryMatch(description, config.mapping);
    if (categoryMatch) {
      item.category_id = categoryMatch.categoryId;
      if (categoryMatch.extra_description) {
        item.memo += ` ${categoryMatch.extra_description}`;
      }
    }
    if (config.isMemoWithId) {
      item.memo += ` [import ID: ${ID}]`;
    }
    transactions.push(item);
  });
  return { transactions };
}

async function execute() {
  await getDataFromTinkoff();
  await getDownloadedFiles();

  let files = await readDir(filesDir);
  if (files.length > 0) {
    files.forEach(async file => {
      const filePath = path.join(filesDir, file);
      const archFilePath = path.join(archDir, file);
      const fileContent = await handleCsv(filePath);
      const transactions = formatData(YNABAccountId, fileContent);
      try {
        await importTransactions(YNABBudgetId, transactions);
      } catch (e) {
        console.log(e.response);
        return;
      }
      moveFile(filePath, archFilePath);
    });
  }

}

// Get key information with this functions
// getBudgets();
// getBudget(YNABBudgetId);
// getAccounts(YNABBudgetId);
// getPayees(YNABBudgetId);
// getCategories(YNABBudgetId);
// getCategory(YNABBudgetId, '4c34c33d-990c-4cd5-8fd7-e461755cf892');

execute();

// Выгрузка за одни сутки
// https://www.tinkoff.ru/api/common/v1/export_operations/
// ?format=csv
// &sessionid=XXXX
// &start=2020-08-13T17%3A00%3A00.000Z
// &end=2020-08-14T16%3A59%3A59.999Z
// &card=0
// &account=5333444555
