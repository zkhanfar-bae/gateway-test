const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.post('/capture-context', async (req, res) => {
    try {
        let rawOrigin = process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const targetOrigin = rawOrigin.replace(/\/$/, '');

        // NEW: Grab the dynamic amount sent from the frontend cart
        // If it fails to read it, it safely defaults to "0.10"
        const amountToCharge = req.body.amount || "0.10";

        const response = await fetch('https://merchant-order-token.baelab.net/v1/payments/capture-context', {
            method: 'POST',
            headers: {
                'Authorization': process.env.MY_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Origin': targetOrigin,
                'Referer': targetOrigin + '/'
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin],
                totalAmount: amountToCharge, // Now fully dynamic based on user's cart
                currency: 'JOD'              // Changed to Jordanian Dinar
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

app.listen(port, () => {
    console.log(`Server running. Target Origin configured as: ${process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}`);
});
