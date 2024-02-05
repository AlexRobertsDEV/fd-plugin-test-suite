import { test, expect, Page} from '@playwright/test';
import {developConfig} from '../env-config/develop.config';
import {releaseConfig} from '../env-config/release.config';
import {productionConfig} from '../env-config/production.config';

let config: any;
switch (process.env.ENVIRONMENT) {
    case 'develop':
        config = developConfig;
        break;
    case 'release':
        config = releaseConfig;
        break;
    case 'production':
        config = productionConfig;
        break;
    default:
        console.log('Please set a correct ENVIRONMENT variable');
}

const clients = config.clients;

async function navigateToClientCard(page: Page, client: { gp_id: any; company_name: unknown; }) {
    // Type in GPID into Search Bar
    await page.locator('input[placeholder="Search by GPID, Company Name, Email Address, or Phone Number"]').fill(client.gp_id);

    // Prepare to intercept the request
    const interceptedRequest = page.waitForResponse(process.env.CLIENTSEARCHREQUESTURL);

    // Click on Search
    await page.locator('button[title="Search"]').click();

    // Clicking twice is needed for verification purposes.
    await page.locator('button[title="Search"]').click();

    // Wait for the response to the intercepted request before proceeding
    const response = await interceptedRequest;

    // Status Code Check
    expect(response.status()).toBe(200);

    // Assert Client Card Title
    const expectedCompanyTitle = client.company_name;
    const actualCompanyTitle = await page.locator('h5[title="Company Name"]').first().textContent();
    expect(actualCompanyTitle).toBe(expectedCompanyTitle);

    // await page.pause();

    // Hover over the "Actions" title
    await page.locator('h6:has-text("Actions")').hover();

    // Click "Communication" Button
    await page.locator('button[title="Communication"]').click();

    //Assert Modal Title
    const modalTitle = await page.locator('h4.modal-title.font-weight-bold.text-dark.border-right-0.py-3').textContent();
    expect(modalTitle).toBe(client.company_name);
}

test.beforeEach(`Environment: ${process.env.ENVIRONMENT}`, async ({ page }) => {
    console.log(`BASEURL: ${process.env.BASEURL}, FFPIN: ${process.env.FFPIN}`);
    await page.goto(`${process.env.BASEURL}${process.env.FFPIN}`);
    await page.locator('input[placeholder="Username or Email"]').fill(process.env.USERNAME);
    await page.locator('input[placeholder="Password"]').fill(process.env.PASSWORD);
    await page.locator('role=button[name="Log In"]').click();
    expect(page.url()).toBe(`${process.env.BASEURL}${process.env.FFPIN}`);
});


for (let client of clients) {
    // Generate a test case for each client
    test(`checking fd-plugin data: ${client.gp_id}`, async ({page}) => {

        await navigateToClientCard(page, client);

        const [
            nameText,
            phoneText,
            siteTypeText,
            emailText,
            siteUrlText,
            serviceKeyHandles
        ] = await Promise.all([
            page.locator('li >> h6:has-text("Name") >> .. >> div >> p').textContent(),
            page.locator('li >> h6:has-text("Phone") >> .. >> div >> p').textContent(),
            page.locator('li >> h6:has-text("Site Type") >> .. >> div >> p').textContent(),
            page.locator('li >> h6:has-text("Email") >> .. >> div >> p >> a').textContent(),
            page.locator('li >> h6:has-text("Website") >> .. >> div >> p >> a').textContent(),
            page.locator('li >> h6:has-text("Service Keys") >> .. >> div >> h6 > span').elementHandles()
        ]);

        // Name check
        expect(nameText).toBe(client.client_name);

        // Phone Number check
        const phone = phoneText.replace(/\D/g,'');
        expect(phone).toBe(String(client.contact_phone_number).replace(/\D/g,''));

        // Site Type check
        expect(siteTypeText).toContain(String(client.site_type));

        // Email check
        expect(emailText).toBe(client.client_email);

        // Site URL check
        const url = siteUrlText.replace('http://', '').replace('https://', '');
        expect(url).toBe(client.site_url);

        // Service Keys check
        const serviceKeys = await Promise.all(serviceKeyHandles.map(e => e.textContent()));
        const serviceKeysString = serviceKeys.join('');
        expect(serviceKeysString).toBe(client.finance_service_keys);

    });

}


for (let client of clients) {
    test(`hyperlink functionality: ${client.gp_id}`, async ({page}) => {

        await navigateToClientCard(page, client);

        const[
            settingsLink,
            websiteLink,
            emailLink,
            fdEmailLink,
            fdWebsiteLink
        ] = await Promise.all([
            page.getAttribute('a:has-text("Settings")', 'href'),
            page.getAttribute('a:has-text("Website")', 'href'),
            page.getAttribute('a:has-text("Email")', 'href'),
            page.locator('li >> h6:has-text("Email") >> .. >> div >> p >> a').getAttribute('href'),
            page.locator('li >> h6:has-text("Website") >> .. >> div >> p >> a').getAttribute('href')
        ]);

        expect(settingsLink).toBe(`${process.env.SETTINGS_AP_LINK_BASEURL}${client.gp_id}/settings`);
        expect(websiteLink).toEqual(expect.stringContaining(client.site_url));
        expect(emailLink).toEqual(expect.stringContaining(client.client_email));
        expect(fdEmailLink).toEqual(expect.stringContaining(client.client_email));
        expect(fdWebsiteLink).toEqual(expect.stringContaining(client.site_url));

    });

}