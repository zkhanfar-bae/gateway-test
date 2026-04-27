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
        // 1. Get origin and FORCE remove any trailing slash
        let rawOrigin = process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';
        const targetOrigin = rawOrigin.replace(/\/$/, '');

        const response = await fetch('https://merchant-order-token.baelab.net/v1/payments/capture-context', {
            method: 'POST',
            headers: {
                'Authorization': {'ODgxMDI3MzQ0OnZBMGpLIUQlOUAuZTN0Q1hkQlQyb1p2fmV3PTJ5Lg=='},
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                // THESE TWO LINES BYPASS BANK FIREWALLS
                'Origin': targetOrigin,
                'Referer': targetOrigin + '/'
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin],
                totalAmount: '0.1',
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

app.listen(port, () => {
    console.log(`Server running. Target Origin configured as: ${process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000'}`);
});
