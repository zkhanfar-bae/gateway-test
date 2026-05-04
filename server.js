const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const express = require('express');
const cors = require('cors');
const path = require('path');
const Datastore = require('nedb'); // Simple DB for Render

const app = express();
const port = process.env.PORT || 3000;

// Initialize Database
const db = new Datastore({ filename: './subscriptions.db', autoload: true });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const ETIHAD_TOKEN = process.env.MY_TOKEN || 'MDAxMTUwOTkyOilFVj02UU1GX2RDVmdUYW4yUEd+NnBYaCNzRUtrbg==';

// --- ROUTE 1: Generate Capture Context ---
app.post('/capture-context', async (req, res) => {
    try {
        const { env, origin, amount, isSubscription } = req.body;
        const targetOrigin = origin || process.env.CUSTOM_DOMAIN || 'http://localhost:3000';

        let url = env === 'dev' 
            ? 'https://merchant-order-token.baelab.net/v1/payments/capture-context'
            : 'https://merchant-order-token.bankaletihad.com/v1/payments/app2/capture-context';

        const capturePayload = {
            targetOrigins: [targetOrigin],
            allowedPaymentTypes: ["PANENTRY"],
            totalAmount: amount || "0.10",
            currency: 'JOD'
        };

        if (isSubscription) {
            capturePayload.actionList = ["TOKEN_CREATE"];
            capturePayload.actionTokenTypes = ["customer", "paymentInstrument"];
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': ETIHAD_TOKEN,
                'Content-Type': 'application/json',
                'Origin': targetOrigin
            },
            body: JSON.stringify(capturePayload)
        });

        res.send(await response.text());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROUTE 2: Process Initial Payment & Save Token ---
app.post('/process-payment', async (req, res) => {
    try {
        const { transientToken, isSubscription, email } = req.body;
        
        const payload = {
            token: transientToken,
            companyId: "6361F8DC-BCAE-4D4A-B903-7B8121A47922"
        };

        if (isSubscription) {
            payload.actionList = ["TOKEN_CREATE"];
            payload.saveCard = true;
        }

        const response = await fetch('https://api.apps-console.bankaletihad.com/BAF3E974-52AA-7598-FF04-56945EF93500/045FCC75-62A0-EE53-FF87-4FD683745500/services/businessMarketplace/pay/hostedCheckout', {
            method: 'POST',
            headers: {
                'Authorization': ETIHAD_TOKEN,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        // If subscription was requested and payment successful, SAVE THE TOKEN
        if (isSubscription && data.tokenInformation) {
            const subscriptionData = {
                email: email || "customer@example.com",
                instrumentIdentifier: data.tokenInformation.instrumentIdentifier.id,
                customerToken: data.tokenInformation.customer.id,
                amount: "0.10", // Store the monthly price
                nextBillingDate: new Date(new Date().setMonth(new Date().getMonth() + 1)), // 1 month from now
                status: 'active'
            };

            db.insert(subscriptionData, (err, newDoc) => {
                if (err) console.error("DB Save Error:", err);
                console.log("SUBSCRIBER VAULTED:", newDoc.instrumentIdentifier);
            });
        }

        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- ROUTE 3: Manual Trigger for Testing (The Monthly Charge Logic) ---
app.post('/test-recurring-charge', async (req, res) => {
    db.findOne({ status
