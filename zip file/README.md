npm i --save-dev @types/express





### Prerequisites (Must be installed first)

1.  **Node.js:** Ensure you have Node.js (v18 or higher) installed.
2.  **Contentstack Account:** You need a Contentstack account with a stack, some content (entries, assets), and your API credentials.

---

### Step 1: Environment Setup

Your code requires environment variables. You need to create a `.env` file in your project's root directory.

1.  Create a file named `.env`
2.  Open it and add your credentials in this exact format:

```bash
# Get these from your Contentstack stack settings
CONTENTSTACK_API_KEY="your_api_key_here"
CONTENTSTACK_MANAGEMENT_TOKEN="your_management_token_here"

# Get this from Google AI Studio (https://aistudio.google.com/)
GOOGLE_API_KEY="your_google_gemini_api_key_here"
```
**How to get these values:**
*   `CONTENTSTACK_API_KEY` & `CONTENTSTACK_MANAGEMENT_TOKEN`: Go to your Contentstack stack -> **Settings** -> **Stack** -> **API Keys**.
*   `GOOGLE_API_KEY`: Visit [Google AI Studio](https://aistudio.google.com/), create an API key for the Gemini API.

---

### Step 2: Install Dependencies

Open your terminal, navigate to your project folder, and run:

```bash
npm install
```
This will install all the packages listed in your `package.json` (like `@langchain/google-genai`, `@modelcontextprotocol/sdk`, etc.).

---

### Step 3: Build the Project

Your code is written in TypeScript and needs to be compiled to JavaScript to run. Run the build command:

```bash
npm run build
```
*   This command uses `tsc` (TypeScript Compiler) to convert your `.ts` files in the `src/` directory into `.js` files in a `dist/` directory.
*   If you don't have a `build` script in your `package.json`, add it:
    ```json
    "scripts": {
      "build": "tsc",
      "start": "node dist/index.js"
    }
    ```

---

### Step 4: Run the Chat Agent

After a successful build, you can start your application:

```bash
npm start
```
**What to expect:**
1.  The script will first check for the environment variables.
2.  You will see logs like `"🚀 Starting Contentstack Chat Agent..."` and `"🤖 Initializing Chat Agent..."`.
3.  It will initialize the MCP client and connect to Contentstack. You should see: `"✅ MCP Client connected successfully"` and a list of `"🛠️ Available MCP Tools"`.
4.  Finally, you will see the prompt: `💬 Chat Agent is ready! Type your questions below.`

---

### Step 5: Testing Your Agent (Detailed Guide)

Now you can have a conversation with your Contentstack stack. Here are specific test cases to try:

#### **Test Case 1: General Chat (No MCP Tool)**
**You:** `Hello!`
**Expected Result:** The LLM (Gemini) will generate a friendly greeting response without calling any Contentstack tools. You'll see no `🔍 Searching...` logs.

#### **Test Case 2: Fetching Content Types**
**You:** `Show me all content types`
**Expected Result:**
1.  You'll see a log: `🔍 Getting content types...`
2.  The MCP Client will call the `get_all_content_types` tool.
3.  The raw JSON result from Contentstack will be sent to Gemini.
4.  Gemini will summarize the list of content types in a friendly way.
**This tests your `else if (cleaned.includes('content types'))` routing logic.**

#### **Test Case 3: Fetching Assets**
**You:** `What assets do you have?`
**Expected Result:**
1.  You'll see a log: `🔍 Searching for assets...`
2.  The MCP Client will call the `get_all_assets` tool.
3.  The raw JSON result for assets will be sent to Gemini.
4.  Gemini will describe the assets conversationally (e.g., "You have 5 images and 2 PDF documents...").
**This tests your `if (cleaned.includes('assets'))` routing logic.**

#### **Test Case 4: Fetching Entries (Most Important Test)**
**You:** `Show me all page entries`
**Expected Result:**
1.  You'll see a log: `🔍 Searching for entries...`
2.  The MCP Client will call the `get_all_entries` tool for the `page` content type.
3.  The raw JSON entries from your `page` content type will be sent to Gemini.
4.  Gemini will summarize the pages, likely listing their titles and main content.
**This tests the core functionality of retrieving and presenting managed content.**

#### **Test Case 5: Testing the Clear Command**
**You:** `clear`
**Expected Result:** The conversation history stored in your agent's memory will be wiped clean. You'll see a log: `🗑️ Conversation history cleared`. This is useful for testing memory-dependent conversations.

#### **Test Case 6: Exit the Application**
**You:** `exit` or `quit`
**Expected Result:** The application will shut down gracefully, disconnecting the MCP client and closing the readline interface. You'll see `👋 Goodbye!`.

### Summary of Commands:

1.  **Setup:** `npm install`
2.  **Build:** `npm run build`
3.  **Run:** `npm start`
4.  **Test:** Use the test cases above in the running CLI.
