const puppeteer = require('puppeteer');
const fs = require('fs');
const readline = require('readline');
const iPhone = puppeteer.devices['iPhone 7'];
let path = 'https://www.avito.ru/sankt-peterburg/koshki/poroda-meyn-kun-ASgBAgICAUSoA5IV';

let getUrlsFromPages = async (page, urls)=>{
  getUrls(page, urls);
  await page.click('span[data-marker="pagination-button/next"]');
  await page.waitForNavigation('networkidle2');
  await page.waitForSelector('#app', { timeout: 4000, visible: true });
  await page.evaluate( () => {
    window.scrollBy(0, window.innerHeight);
  });
  if (await canOpenNext(page))
    await getUrlsFromPages(page, urls);
  else
    await getUrls(page, urls);
};

let getUrls = async (page, urls)=>{
  let urls2 = await page.$$eval('div[data-marker="catalog-serp"][class*="items-items-"] > div[data-marker="item"][class*="iva-item-root-"] > div[class*="iva-item-content-"] > div[class*="iva-item-body-"] > div[class*="iva-item-titleStep-"] > a', links => {
    return links.map(el => el.href);
  });
  urls.push(...urls2);
};

let getPhone = async (page) => {
  if (await page.evaluate(() => document.querySelector('button[data-marker="item-contact-bar/call"]') === null)) return null;

  await page.click('button[data-marker="item-contact-bar/call"]');
  await page.waitForSelector('#modal > div > div', { timeout: 40000, visible: true });
  return await page.evaluate(() => {
    let phone = document.querySelector('span[data-marker="phone-popup/phone-number"]');
    return phone === null ? null : phone.innerText;
  });
};

let canOpenNext = async (page) => await page.evaluate(() => document.querySelector('span[data-marker="pagination-button/next"][class*="pagination-item_readonly-"]') === null);

let scrape = async () => {
  const browser = await puppeteer.launch({headless: false});
  const page = await browser.newPage();
  await page.goto(path, {waitUntil: 'networkidle2'});
  await page.waitForSelector('#app', { timeout: 4000, visible: true });
  await page.evaluate( () => {
    window.scrollBy(0, window.innerHeight);
  });
  let urls = [];
  if (await canOpenNext(page))
    await getUrlsFromPages(page, urls);
  else
    await getUrls(page, urls);
  await page.close();

  const pageMobile = await browser.newPage();
  await pageMobile.emulate(iPhone);

  let prods = [];
  for (const url of urls) {
    try {
      await pageMobile.goto(url, {waitUntil: 'networkidle2'});
      await pageMobile.waitForSelector('#app', { timeout: 4000, visible: true });
      let result = await pageMobile.evaluate(() => {
        let res = {};
        let price = document.querySelector('span[data-marker="item-description/price"]').innerText;
        res.price = parseInt(price.replace(/\D+/g,""));
        res.title = document.querySelector('h1 > span').innerText;
        res.description = document.querySelector('div[data-marker="item-description/text"]').innerText;
        res.author = document.querySelector('span[data-marker="seller-info/name"]').innerText;
        let date = document.querySelector('div[data-marker="item-stats/timestamp"] > span');
        res.date = date.innerText.trim();
        return res;
      });
      
      result.date = getDate(result.date);
      result.url = url;
      result.phone = await getPhone(pageMobile);
      prods.push(result);
    } catch (error) {
      console.log(`При обработке URL: ${url} произошла ошибка ${error}`);
      continue;
    }
  }
  const data = JSON.stringify(prods);

  fs.writeFile('prods.json', data, (err) => console.log(err));

  browser.close();
  return prods;
};

let getDate = (dateStr) => {
  let dt = new Date();
  if (dateStr.includes('сегодня')) {
    return new Date(`${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDay()} ${dateStr.split(' ')[1]}`).toISOString();
  }

  if (dateStr.includes('вчера')) {
    dt = new Date(dt.setDate(dt.getDate() - 1));
    return new Date(`${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDay()} ${dateStr.split(' ')[1]}`).toISOString();
  }

  let dtLst = dateStr.split(' ');
  return new Date(`${dt.getFullYear()}-${switchMonth(dtLst[1].replace(',', '').trim())}-${dtLst[0]} ${dtLst[2]}`).toISOString();
};

let switchMonth = (month) => {
  switch (month) {
    case 'января':
      return '01';
    case 'февраля':
      return '02';
    case 'марта':
      return '03';
    case 'апреля':
      return '04';
    case 'мая':
      return '05';
    case 'июня':
      return '06';
    case 'июля':
      return '07';
    case 'августа':
      return '08';
    case 'сентября':
      return '09';
    case 'октября':
      return '10';
    case 'ноября':
      return '11';
    case 'декабря':
      return '12';
    default:
      return '';
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Введите URL Avito: ', (answer) => {
  path = answer;

  scrape().then((value) => {
    console.log(value);
  });
  rl.close();
});