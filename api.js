const axios = require('axios');
const path = require('path');
const fs = require('fs');

const config = require('./config.js');
const YNABToken = config.YNABToken;

const logPath = path.join(__dirname, 'my_YNAB');
if (!fs.existsSync(logPath)){
  fs.mkdirSync(logPath);
}

function saveLog(fileName, data) {
  const logFile = path.join(logPath, fileName);
  fs.writeFile(logFile, JSON.stringify(data), (err) => {
    if (err) throw err;
    console.log(`Data saved to file: ${logFile}`);
  });
}

const getBudgets = () => {
  axios({
    url: 'https://api.youneedabudget.com/v1/budgets',
    headers: {'Authorization': `Bearer ${YNABToken}`}
  })
    .then(res => {
      const data = res.data.data.budgets;
      console.log('Budgets: ', data);
      saveLog('budgets.json', data);
    });
};

const getBudget = (id) => {
  axios({
    url: `https://api.youneedabudget.com/v1/budgets/${id}`,
    headers: {'Authorization': `Bearer ${YNABToken}`}
  })
  .then(res => {
    const data = res.data.data.budget;
    console.log(data);
    saveLog('budget.json', data);
  })
};

const getAccounts = (budgetId) => {
  axios({
    url: `https://api.youneedabudget.com/v1/budgets/${budgetId}/accounts`,
    headers: {'Authorization': `Bearer ${YNABToken}`}
  })
  .then(res => {
    const data = res.data.data.accounts;
    console.log(data);
    saveLog('accounts.json', data);
  })
};

const getPayees = (budgetId) => {
  axios({
    url: `https://api.youneedabudget.com/v1/budgets/${budgetId}/payees`,
    headers: {'Authorization': `Bearer ${YNABToken}`}
  })
  .then(res => {
    const data = res.data.data.payees;
    console.log(data);
    saveLog('payees.json', data);
  })
};

const getCategories = (budgetId) => {
  axios({
    url: `https://api.youneedabudget.com/v1/budgets/${budgetId}/categories`,
    headers: {'Authorization': `Bearer ${YNABToken}`}
  })
  .then(res => {
    const data = res.data.data.category_groups;
    data.forEach(group => {
      console.log(group);
    });
    saveLog('categories.json', data);
  })
};

const getCategory = (budgetId, categoryId) => {
  axios({
    url: `https://api.youneedabudget.com/v1/budgets/${budgetId}/categories/${categoryId}`,
    headers: {'Authorization': `Bearer ${YNABToken}`}
  })
  .then(res => {
    const data = res.data;
    console.log(data);
    saveLog('category.json', data);
  })
};

// https://api.youneedabudget.com/v1#/Transactions/createTransaction
const importTransactions = (budgetId, data) => {
  return new Promise((resolve, reject) => {
    axios({
      method: 'post',
      url: `https://api.youneedabudget.com/v1/budgets/${budgetId}/transactions`,
      headers: {'Authorization': `Bearer ${YNABToken}`},
      data,
    })
      .then(res => {
        const data = res.data;
        console.log(data);
        saveLog('transactions.json', data);
        resolve();
      })
      .catch(err => {
        reject(err);
      });
  })
};

module.exports = {
  getBudgets,
  getBudget,
  importTransactions,
  getAccounts,
  getPayees,
  getCategories,
  getCategory,
};
