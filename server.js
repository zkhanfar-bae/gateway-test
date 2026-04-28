const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ROUTE 1: Generate the Capture Context (Now using LIVE Production)
app.post('/capture-context', async (req, res) => {
    try {
        let rawOrigin = process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const targetOrigin = rawOrigin.replace(/\/$/, '');
        const amountToCharge = req.body.amount || "0.10";

        const response = await fetch('https://merchant-order-token.bankaletihad.com/v1/payments/app2/capture-context', {
            method: 'POST',
            headers: {
                'Authorization': process.env.MY_TOKEN, // Make sure to update this in Render!
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': targetOrigin,
                'Referer': targetOrigin + '/'
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin], // Dynamically matches your Render URL
                allowedPaymentTypes: ["PANENTRY", "GOOGLEPAY", "APPLEPAY"],
                totalAmount: amountToCharge,
                currency: 'JOD'
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Bank API error: ${response.status} - ${errText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error fetching capture context:', error);
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 2: Process the Final Live Payment (The missing step!)
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
                token: req.body.transientToken, // The token from Cybersource 3DS
                companyId: "6361F8DC-BCAE-4D4A-B903-7B8121A47922" // Your Live Company ID
            })
        });

        const data = await response.text();
        
        if (!response.ok) {
             throw new Error(`Final charge failed: ${data}`);
        }

        res.json({ success: true, data: data });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running. Target Origin configured as: ${process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}`);
});
