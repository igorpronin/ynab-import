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
    await decodeFile(file);
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

// Форматирование данных Тинькофф для YNAB
function formatData(accountId, operations) {
  const transactions = [];
  operations.forEach((operation) => {
    let description = operation['Описание'];
    if (operation['Валюта операции'] !== 'RUB') {
      description += ` (${operation['Валюта операции']} ${operation['Сумма операции'].replace('-', '')})`;
    }
    description.trim();
    const item = {
      date: operation['Дата операции'].split(' ')[0].split('.').reverse().join('-'),
      amount: Number(operation['Сумма платежа'].replace(',', '.')) * 1000, // Формат чисел в YNAB
      account_id: accountId,
      memo: description
    };
    if (mapping[description]) {
      item.category_id = mapping[description].id;
    }
    if (config.isMemoWithId) {
      item.memo += ` [import ID: ${ID}]`;
    }
    transactions.push(item);
  });
  return { transactions };
}

async function execute() {
  await getDownloadedFiles();
  let files = await readDir(filesDir);
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
// getBudgets();
// getBudget(YNABBudgetId);
// getAccounts(YNABBudgetId);
// getPayees(YNABBudgetId);
// getCategories(YNABBudgetId);
// getCategory(YNABBudgetId, '4c34c33d-990c-4cd5-8fd7-e461755cf892');

execute();
