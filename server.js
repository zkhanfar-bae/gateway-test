const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ROUTE 1: Generate the Capture Context
app.post('/capture-context', async (req, res) => {
    try {
        const env = req.body.env || 'prod'; 
        const targetOrigin = req.body.origin || process.env.CUSTOM_DOMAIN || 'http://localhost:3000';
        const amountToCharge = req.body.amount || "0.10";

        let url, token;
        if (env === 'dev') {
            url = 'https://merchant-order-token.baelab.net/v1/payments/capture-context';
            token = 'MDAxMTUwOTkyOilFVj02UU1GX2RDVmdUYW4yUEd+NnBYaCNzRUtrbg=='; 
        } else {
            url = 'https://merchant-order-token.bankaletihad.com/v1/payments/app2/capture-context';
            token = process.env.MY_TOKEN; 
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': targetOrigin,
                'Referer': targetOrigin + '/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin],
                allowedPaymentTypes: ["PANENTRY", "GOOGLEPAY", "APPLEPAY"],
                totalAmount: amountToCharge,
                currency: 'JOD'
            })
        });

        const rawText = await response.text();

        if (!response.ok) {
            throw new Error(`Bank API error (${env}): ${response.status} - ${rawText}`);
        }

        res.send(rawText);
    } catch (error) {
        console.error('Error fetching capture context:', error);
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 2: Process the Final Payment & CREATE TOKEN
app.post('/process-payment', async (req, res) => {
    try {
        const env = req.body.env || 'prod';
        const token = env === 'dev' ? 'MDAxMTUwOTkyOilFVj02UU1GX2RDVmdUYW4yUEd+NnBYaCNzRUtrbg==' : process.env.MY_TOKEN;
        
        // Base payload for a standard charge
        const payload = {
            token: req.body.transientToken,
            companyId: "6361F8DC-BCAE-4D4A-B903-7B8121A47922"
        };

        // If the user checked the Subscription box, tell Cybersource to vault the card!
        if (req.body.isSubscription) {
            console.log("Subscription requested! Asking Cybersource to create TMS Token...");
            // Cybersource standard command to create a token during a charge
            payload.actionList = ["TOKEN_CREATE"];
            // Just in case Bank al Etihad's wrapper uses a custom flag instead:
            payload.saveCard = true; 
        }

        const response = await fetch('https://api.apps-console.bankaletihad.com/BAF3E974-52AA-7598-FF04-56945EF93500/045FCC75-62A0-EE53-FF87-4FD683745500/services/businessMarketplace/pay/hostedCheckout', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.text();
        
        if (!response.ok) {
             throw new Error(`Final charge failed: ${data}`);
        }

        res.send(data);
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
