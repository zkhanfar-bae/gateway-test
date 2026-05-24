const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// --- GLOBAL SPY LOGGER ---
app.use((req, res, next) => {
    if (req.url.includes('/api/webhook')) {
        console.log(`🚨 [NETWORK EVENT] Inbound event detected via ${req.method} request at: ${req.url}`);
    }
    next();
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ROUTE 1: Generate the Initial Token via Bank Al Etihad Token Proxy Nodes
app.post('/capture-context', async (req, res) => {
    try {
        const isDev = req.body.env === "dev";
        
        // Dynamic fallback: use whatever currency the frontend selector sends, default to USD
        const chosenCurrency = req.body.currency || "USD"; 

        const CAPTURE_URL = isDev
            ? "https://merchant-order-token.baelab.net/v1/payments/capture-context"
            : "https://merchant-order-token.bankaletihad.com/v1/payments/app2/capture-context";

        const AUTH_TOKEN_CAPTURE = isDev
            ? "MDAxMTUwOTkyOilFVj02UU1GX2RDVmdUYW4yUEd+NnBYaCNzRUtrbg==" // BAE DEV KEY
            : "ODgxMDI3MzQ0Oj4ua2VQdWklQGFDMkZ6RmduWHclamZlXUVQIWV2ag=="; // BAE PROD KEY

        const targetOrigin = req.body.origin || "http://localhost:3000";

        const response = await fetch(CAPTURE_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": AUTH_TOKEN_CAPTURE,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin, "https://ziadqula28.github.io"],
                totalAmount: parseFloat(req.body.amount).toFixed(2),
                currency: chosenCurrency, // 🌟 Dynamically scales to USD or JOD based on user selection
                withDecode: false
            })
        });

        const data = await response.text();
        return res.status(response.status).send(data);

    } catch (error) {
        console.error('Context Handshake Failure:', error);
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 2: Process and Finalize Funds via BAE Hosted Checkout Proxy
app.post('/process-payment', async (req, res) => {
    try {
        const isDev = req.body.env === "dev";

        const PROCESS_URL =
            "https://api.apps-console.bankaletihad.com/BAF3E974-52AA-7598-FF04-56945EF93500/045FCC75-62A0-EE53-FF87-4FD683745500/services/businessMarketplace/pay/hostedCheckout";

        const AUTH_TOKEN_PROCESS = isDev
            ? "MDAxMTUwOTkyOilFVj02UU1GX2RDVmdUYW4yUEd+NnBYaCNzRUtrbg==" // BAE DEV KEY
            : "ODgxMDI3MzQ0Oj4ua2VQdWklQGFDMkZ6RmduWHclamZlXUVQIWV2ag=="; // BAE PROD KEY

        const COMPANY_ID = isDev
            ? "A4B4A51F-0E6A-41BE-A8FB-5FCCA54C2F58" // BAE DEV COMPANY ID
            : "6361F8DC-BCAE-4D4A-B903-7B8121A47922"; // BAE PROD COMPANY ID

        const response = await fetch(PROCESS_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
                "Authorization": AUTH_TOKEN_PROCESS,
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            },
            body: JSON.stringify({
                token: req.body.transientToken,
                companyId: COMPANY_ID
            })
        });

        const data = await response.text();
        return res.status(response.status).send(data);

    } catch (error) {
        console.error('Settlement Execution Failure:', error);
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 3: Webhook Listener Endpoint Matrix
app.all('/api/webhook', (req, res) => {
    try {
        console.log('--- NEW WEBHOOK EVENT CAPTURED ---');
        console.log(`Method used: ${req.method}`);
        console.log('Body:', JSON.stringify(req.body, null, 2)); 
        console.log('----------------------------------');

        res.status(200).send('Webhook processed successfully');
    } catch (error) {
        console.error('Webhook Handling Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(port, () => {
    console.log(`TechStore Gateway running via BAE Routing Proxy on port ${port}`);
});
