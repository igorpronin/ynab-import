export default {
  YNABToken: 'xxx-xxx',
  YNABBudgetId: 'xxx-xxx',
  YNABAccountId: 'xxx-xxx',
  fileEncoding: 'win1251',
  decode: true,
  isMemoWithId: true,
  downloadPath: '/Users/igorpronin/Downloads',
  login: 'tinkofflogin',
  pass: 'tinkoffpass',
  startDate: '2020-08-09',
  endDate: '2020-08-10',
  timezone: 7,
  mapping: [
    {
      name: 'Продукты домой',
      id: '13d9f094-072e-480f-87c8-e7d792166f91',
      operations: [
        'IP Shukurova F.F.',
        'Мария РА'
      ]
    },
    {
      name: 'Кофе с собой',
      id: '79c4f192-05ca-4d62-b89b-692fadeaa3f9',
      operations: [
        'Renoir Coffee',
        { name: "Kofejnya Jel'", extra_description: 'Любимая кофейня' }
      ]
    }
  ]
};
