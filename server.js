const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ROUTE 1: Generate the Capture Context (LIVE Production)
app.post('/capture-context', async (req, res) => {
    try {
        // Dynamically grab the exact URL the user is visiting from (like your colleague's code)
        const targetOrigin = req.body.origin || process.env.CUSTOM_DOMAIN || 'http://localhost:3000';
        const amountToCharge = req.body.amount || "0.10";

        const response = await fetch('https://merchant-order-token.bankaletihad.com/v1/payments/app2/capture-context', {
            method: 'POST',
            headers: {
                'Authorization': process.env.MY_TOKEN, // The LIVE token from Render
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin],
                allowedPaymentTypes: ["PANENTRY", "GOOGLEPAY", "APPLEPAY"],
                totalAmount: amountToCharge,
                currency: 'JOD'
            })
        });

        // CRITICAL FIX: Live API returns raw text, not JSON. Read as text!
        const rawText = await response.text();

        if (!response.ok) {
            throw new Error(`Bank API error: ${response.status} - ${rawText}`);
        }

        // Send the exact text back to the frontend
        res.send(rawText);
    } catch (error) {
        console.error('Error fetching capture context:', error);
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 2: Process the Final Live Payment
app.post('/process-payment', async (req, res) => {
    try {
        const response = await fetch('https://api.apps-console.bankaletihad.com/BAF3E974-52AA-7598-FF04-56945EF93500/045FCC75-62A0-EE53-FF87-4FD683745500/services/businessMarketplace/pay/hostedCheckout', {
            method: 'POST',
            headers: {
                'Authorization': process.env.MY_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                token: req.body.transientToken,
                companyId: "6361F8DC-BCAE-4D4A-B903-7B8121A47922"
            })
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
