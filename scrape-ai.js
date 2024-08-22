const { chromium } = require('playwright');
const xlsx = require('xlsx');
const path = require('path');

// Helper function to capitalize the first letter of a string
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

// Get current date in YYYY-MM-DD format
function getCurrentDate() {
  const date = new Date();
  return date.toISOString().split('T')[0];
}

// Function to scrape tickets from the main tickets page
async function scrapeTickets(page, enterprise) {
  let capturedTickets = [];

  // Set up a listener specifically for the tickets API response
  const ticketListener = async (response) => {
    const url = response.url();
    if (url.includes('api.meaningfulgigs.com/v1/private/catalyst/tickets') && response.request().resourceType() === 'fetch') {
      const contentType = response.headers()['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        capturedTickets = Array.isArray(jsonResponse) ? jsonResponse : [jsonResponse];
        console.log(`[${capitalizeFirstLetter(enterprise)}] Captured ${capturedTickets.length} tickets.`);
      }
    }
  };

  // Attach the listener and navigate to the tickets page
  page.on('response', ticketListener);
  await page.goto('https://app.site.com/tickets');
  await page.waitForSelector('tr.cursor-pointer'); // Waiting for the first ticket element to appear

  // Detach the listener after processing
  page.off('response', ticketListener);

  if (capturedTickets.length === 0) {
    throw new Error('No tickets were captured');
  }

  return capturedTickets.map(ticket => ({
    id: ticket._id,
    title: ticket.title
  }));
}

// Function to scrape AI comments from a specific ticket page
async function scrapeCommentsForTicket(page, enterprise, ticket) {
  let capturedComments = [];

  // Set up a listener specifically for the comments API response
  const commentListener = async (response) => {
    const url = response.url();
    if (url.includes(`api.meaningfulgigs.com/v1/private/catalyst/tickets/${ticket.id}/comments`) && response.request().resourceType() === 'fetch') {
      const contentType = response.headers()['content-type'];
      if (contentType && contentType.includes('application/json')) {
        const jsonResponse = await response.json();
        capturedComments = Array.isArray(jsonResponse) ? jsonResponse : [jsonResponse];
        console.log(`[${capitalizeFirstLetter(enterprise)}] Captured ${capturedComments.length} comments for ticket: ${ticket.title}`);
      }
    }
  };

  // Attach the listener and navigate to the ticket page
  page.on('response', commentListener);
  await page.goto(`https://app.site.com/tickets/${ticket.id}`);

  // Wait for the first comment element to appear with a timeout
  try {
    await page.waitForSelector('div[data-testid="comment"]', { timeout: 10000 });
  } catch (error) {
    console.log(`[${capitalizeFirstLetter(enterprise)}] No comments found for ticket: ${ticket.title}, skipping...`);
    page.off('response', commentListener);
    return []; // Return an empty array to signify no comments
  }

  // Detach the listener after processing
  page.off('response', commentListener);

  // Log the total number of comments captured
  console.log(`[${capitalizeFirstLetter(enterprise)}] Found ${capturedComments.length} total comments for ticket: ${ticket.title}`);

  // Filter and return comments created by "AI Reviewer"
  const filteredComments = capturedComments
    .filter(comment => comment.createdBy.name === 'AI Reviewer')
    .map(comment => comment.description);

  // Log the number of comments made by the AI Reviewer
  console.log(`[${capitalizeFirstLetter(enterprise)}] Filtered ${filteredComments.length} AI Reviewer comments for ticket: ${ticket.title}`);

  return filteredComments;
}

// Main function to scrape AI comments for an enterprise
async function scrapeCommentsForEnterprise(enterprise) {
  const email = `ai+${enterprise}@site.com`;
  const browser = await chromium.launch({ headless: false }); // Running in headed mode
  const page = await browser.newPage();

  try {
    console.log(`\n[${capitalizeFirstLetter(enterprise)}] Logging in...`);
    await page.goto('https://app.site.com/login');
    await page.getByTestId('email-field').fill(email);
    await page.getByTestId('password-field').fill('ENTER REAL PASSWORD HERE');
    await page.getByTestId('form-submit-cta').click();

    console.log(`[${capitalizeFirstLetter(enterprise)}] Waiting for redirect to /tickets...`);
    await page.waitForURL('**/tickets', { timeout: 60000 });
    console.log(`[${capitalizeFirstLetter(enterprise)}] Redirected to /tickets`);

    // Scrape tickets from the main tickets page
    const tickets = await scrapeTickets(page, enterprise);

    // Scrape comments for each ticket
    const aiComments = [];
    for (const ticket of tickets) {
      console.log(`[${capitalizeFirstLetter(enterprise)}] Navigating to ticket: ${ticket.title} (ID: ${ticket.id})`);
      const comments = await scrapeCommentsForTicket(page, enterprise, ticket);
      aiComments.push(...comments);
    }

    console.log(`[${capitalizeFirstLetter(enterprise)}] Finished scraping. Total comments collected: ${aiComments.length}`);
    return { enterprise: capitalizeFirstLetter(enterprise), comments: aiComments };
  } catch (error) {
    console.error(`Failed to scrape comments for ${enterprise}:`, error);
    return { enterprise: capitalizeFirstLetter(enterprise), comments: [] };
  } finally {
    console.log(`Closing browser for ${enterprise}...`);
    await browser.close();
  }
}

(async () => {
  console.log("Starting the scraping process...");

  // Define the enterprises to scrape
  const enterprises = ['enterprise1', 'enterprise2'];

  // Run scraping for all enterprises
  console.log("\nStarting scraping for all enterprises...");
  const results = await Promise.all(enterprises.map(scrapeCommentsForEnterprise));

  // Combine data and write to Excel
  console.log("\nCombining data and writing to Excel...");
  const workbook = xlsx.utils.book_new();
  const currentDate = getCurrentDate();

  for (const result of results) {
    const sheetName = `${result.enterprise}_${currentDate}`;
    console.log(`Adding ${result.comments.length} comments to the ${sheetName} sheet...`);
    const worksheet = xlsx.utils.aoa_to_sheet(result.comments.map(desc => [desc]));
    xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  }

  // Define the output path
  const outputPath = path.resolve(__dirname, 'AI_Comments.xlsx');

  // Write the workbook to a file
  xlsx.writeFile(workbook, outputPath);
  console.log(`AI comments saved to ${outputPath}`);

  console.log("\nScraping process completed.");
})();
