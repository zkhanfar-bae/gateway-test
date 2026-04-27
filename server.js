const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve the index.html file
app.use(express.static(path.join(__dirname)));

app.post('/capture-context', async (req, res) => {
    try {
        // Dynamically set targetOrigin to prevent CORS/JWT errors
        // Prioritizes Custom Domain -> Render Auto Domain -> Localhost
        const targetOrigin = process.env.CUSTOM_DOMAIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:3000';

        const response = await fetch('https://merchant-order-token.baelab.net/v1/payments/capture-context', {
            method: 'POST',
            headers: {
                'Authorization': process.env.MY_TOKEN,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                targetOrigins: [targetOrigin],
                totalAmount: '1.00',
                currency: 'USD'
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
