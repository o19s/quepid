
const chromeOptions = {
  headless:false,
  devtools: true,
  slowMo:10,
  defaultViewport:{
    width:1000,
    height:1500
  }
};

quepid_url = 'http://localhost:3000'
email = `epugh-${Date.now()}@opensourceconnections.com`
password = 's3cret'



const puppeteer = require('puppeteer');
(async () => {
  try {
    const browser = await puppeteer.launch(chromeOptions)
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)

    const navigationPromise = page.waitForNavigation()


    await page.goto(quepid_url, {
      waitUntil: 'networkidle0',
    })

    await navigationPromise

    await page.type('#signup .name', 'Eric Pugh')
    await page.type('#signup .email', email)
    await page.type('#signup .password', password)
    await page.type('#signup .password-confirm', password)


    await Promise.all([
          await page.click('#signup .signup'),
          page.waitForNavigation({ waitUntil: 'networkidle0' })
    ]);

    await page.waitFor(4000) // not sure why we have this.

    await page.evaluate(() => {
      //debugger;
    });


    await page.click(`#wizard #step-one .continue`)

    await page.evaluate(() => {
      //debugger;
      console.log("wating for step two")
    });

    await page.waitForSelector('#step-two')
    await page.click(`#wizard #step-two .continue`)

    await page.waitForSelector('#step-three')
    await page.click('#wizard #step-three .continue')

    await page.waitFor(4000) // not sure why we have this.

    await page.waitForSelector('#step-four .continue')
    await page.click('#wizard #step-four .continue')

    await page.waitForSelector('#step-five')
    await page.click(`#wizard #step-five .continue`)

    await page.waitForSelector('#step-six')
    await page.click(`#wizard #step-six .finish`)


    await page.waitForSelector('.shepherd-button-example-primary')
    await page.click(`.shepherd-button-example-primary`)

    await page.waitFor(4000) // not sure why we have this.
    await page.click('body > div.shepherd-step.shepherd-element.shepherd-open.shepherd-theme-arrows.shepherd-has-title.shepherd-has-cancel-link.shepherd-element-attached-middle.shepherd-element-attached-left.shepherd-target-attached-middle.shepherd-target-attached-right.shepherd-enabled > div > footer > ul > li:nth-child(2) > a')
    //await page.click('a.shepherd-button.shepherd-button-example-primary')

    await page.type('#add-query', "Toy Story")
    await page.click('#add-query-submit')

    await page.waitForSelector('div[rank="1"]')

    await page.click('div[rank="1"] .results-title')
    //await page.waitForSelector('.query-rating')
    await page.evaluate(() => {
      debugger;
    });
    await page.waitFor(4000) // not sure why we have this.

    //await page.click(`.shepherd-button-example-primary`)
    await page.click('body > div.shepherd-step.shepherd-element.shepherd-open.shepherd-theme-arrows.shepherd-has-title.shepherd-has-cancel-link.shepherd-element-attached-bottom.shepherd-element-attached-center.shepherd-target-attached-top.shepherd-target-attached-center.shepherd-enabled > div > footer > ul > li:nth-child(2) > a')


    await page.waitFor(4000) // not sure why we have this.

    await page.click(`.shepherd-button-example-primary`)

    await page.waitFor(4000) // not sure why we have this.

    await page.click(`#tune-relevance-link > a:nth-child(2)`)


    await browser.close()
  } catch (error){
    console.log(error)
  }
})()
