const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const iconv = require('iconv-lite');

const config = require('./config.js');
const mapping = require('./mapping.json');

const makeId = require('./utilites.js').makeId;
const ID = makeId();

const YNABBudgetId = config.YNABBudgetId;
const YNABAccountId = config.YNABAccountId;

const converter = iconv.decodeStream(config.fileEncoding);

// api functions
const YNABApi = require('./api');
const getBudgets = YNABApi.getBudgets;
const getBudget = YNABApi.getBudget;
const getAccounts = YNABApi.getAccounts;
const getPayees = YNABApi.getPayees;
const getCategories = YNABApi.getCategories;
const getCategory = YNABApi.getCategory;
const importTransactions = YNABApi.importTransactions;

const filesDir = path.join(__dirname, 'for_import');
const archDir = path.join(__dirname, 'imported');
if (!fs.existsSync(filesDir)){
  fs.mkdirSync(filesDir);
}
if (!fs.existsSync(archDir)){
  fs.mkdirSync(archDir);
}

function readDirPromise() {
  return new Promise((resolve, reject) => {
    fs.readdir(filesDir, (err, files) => {
      if (err) {
        reject(err);
        return console.log('Unable to scan directory: ' + err);
      }
      resolve(files);
    });
  });
}

function handleCsv(file) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(file)
      .pipe(converter)
      .pipe(csv({ separator: ';' }))
      .on('data', (data) => {
        results.push(data);
      })
      .on('end', () => {
        resolve(results);
      });
  });
}

// Форматирование данных Тинькофф для YNAB
function formatData(accountId, operations) {
  const transactions = [];
  operations.forEach((operation) => {
    const description = operation['Описание'];
    const item = {
      date: operation['Дата операции'].split(' ')[0].split('.').reverse().join('-'),
      amount: Number(operation['Сумма операции'].replace(',', '.')) * 1000,
      account_id: accountId,
      memo: `${description} [import ID: ${ID}]`
    };
    if (mapping[description]) {
      item.category_id = mapping[description].id;
    }
    transactions.push(item);
  });
  return { transactions };
}

function moveFile(oldPath, newPath) {
  fs.rename(oldPath, newPath, err => {
    if (err) throw err;
  });
}

async function execute() {
  const files = await readDirPromise();
  if (files.length > 0) {
    files.forEach(async file => {
      const filePath = path.join(filesDir, file);
      const archFilePath = path.join(archDir, file);
      const fileContent = await handleCsv(filePath);
      const transactions = formatData(YNABAccountId, fileContent);
      await importTransactions(YNABBudgetId, transactions);
      moveFile(filePath, archFilePath);
    });
  }
}

// Get key information with this functions
getBudgets();
// getBudget(YNABBudgetId);
// getAccounts(YNABBudgetId);
// getPayees(YNABBudgetId);
// getCategories(YNABBudgetId);
// getCategory(YNABBudgetId, '4c34c33d-990c-4cd5-8fd7-e461755cf892');

// execute();
