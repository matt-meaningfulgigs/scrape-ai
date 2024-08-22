# Scrape AI Comments

This script scrapes AI comments from specific tickets on a website and saves them to an Excel file. Each enterprise has its own tab in the Excel file, and the comments are filtered to include only those made by the "AI Reviewer."

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-repo/scrape-ai.git
   cd scrape-ai
   ```

2. **Install the required packages**:
   ```bash
   npm install
   ```

3. **Install the Playwright browsers**:
   ```bash
   npx playwright install
   ```

## Configuration

### 1. Update the Password

Before running the script, you need to update the password in the script. Open the `scrape-ai.js` file and replace the placeholder text `'ENTER PASSWORD HERE'` with your actual password:

```javascript
await page.getByTestId('password-field').fill('ENTER REAL PASSWORD HERE');
```

### 2. Update the Website Domain

The script currently references `site.com` as the website domain. Since we don't use that and use a real website, make sure to replace all instances of `site.com` with the app URL in the `scrape-ai.js` file:

```javascript
await page.goto('https://site.com/login');
```

Change to:

```javascript
await page.goto('https://ACTUAL URL/login');
```

## Running the Script

To run the script:

```bash
node scrape-ai.js
```

The script will automatically log in, scrape the tickets and AI comments for each enterprise, and save the results in an Excel file named `AI_Comments.xlsx` in the current directory.

## Adding Additional Enterprises

To add additional enterprises, update the `enterprises` array in the script:

```javascript
const enterprises = ['enterprise1', 'enterprise2'];
```

Add the name of the new enterprise as a string in the array. The script will automatically generate the corresponding email and tab name based on the enterprise name.
