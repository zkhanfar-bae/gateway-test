const express = require('express');
const cors = require('cors');
const path = require('path');
const cybersourceRestApi = require('cybersource-rest-client');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper function to build Cybersource Configuration
function getCyberConfig(envReq) {
    const runEnv = (process.env.CYBER_ENV === 'production' || envReq === 'prod') 
        ? 'api.cybersource.com' 
        : 'apitest.cybersource.com';

    return {
        authenticationType: 'http_signature',
        runEnvironment: runEnv,
        merchantID: process.env.CYBERSOURCE_MERCHANT_ID,
        merchantKeyId: process.env.CYBERSOURCE_KEY_ID,
        merchantsecretKey: process.env.CYBERSOURCE_SECRET_KEY, 
        logConfiguration: { enableLog: false }
    };
}

// ROUTE 1: Generate the Capture Context directly from Cybersource
app.post('/capture-context', (req, res) => {
    try {
        const targetOrigin = req.body.origin || process.env.CUSTOM_DOMAIN || 'http://localhost:3000';
        const configObject = getCyberConfig(req.body.env);
        const apiClient = new cybersourceRestApi.ApiClient();

        // Build the capture context request
        const requestObj = new cybersourceRestApi.GenerateCaptureContextRequest();
        requestObj.clientVersion = "v2";
        requestObj.targetOrigins = [targetOrigin];
        
        requestObj.allowedPaymentTypes = ["CARD"]; 
        requestObj.allowedCardNetworks = ["VISA", "MASTERCARD"]; 
        
        // FIX: We MUST include the amount here so Cybersource returns the Unified Checkout SDK (which contains `Accept`)
        requestObj.orderInformation = {
            amountDetails: {
                totalAmount: req.body.amount || "0.10",
                currency: "JOD"
            }
        };
        
        // Inject Tokenization/Vault commands for subscriptions
        if (req.body.isSubscription) {
            console.log("Injecting Tokenize commands into Capture Context...");
            requestObj.actionList = ["TOKEN_CREATE"];
            requestObj.actionTokenTypes = ["customer", "paymentInstrument"];
        }

        const instance = new cybersourceRestApi.MicroformIntegrationApi(configObject, apiClient);
        
        instance.generateCaptureContext(requestObj, function (error, data, response) {
            if (error) {
                let errorDetails = error.message || "Failed to generate context";
                if (response && response.text) {
                    errorDetails = `${errorDetails} - ${response.text}`;
                }
                console.error('Error generating capture context:', errorDetails);
                return res.status(500).json({ error: errorDetails });
            }
            res.send(data);
        });
    } catch (error) {
        console.error('Context Setup Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// ROUTE 2: Process the Final Payment directly with Cybersource
app.post('/process-payment', (req, res) => {
    try {
        const configObject = getCyberConfig(req.body.env);
        const apiClient = new cybersourceRestApi.ApiClient();
        const instance = new cybersourceRestApi.PaymentsApi(configObject, apiClient);

        const requestObj = new cybersourceRestApi.CreatePaymentRequest();

        // 1. Client Reference
        const clientReferenceInformation = new cybersourceRestApi.Ptsv2paymentsClientReferenceInformation();
        clientReferenceInformation.code = "ORDER_" + Date.now();
        requestObj.clientReferenceInformation = clientReferenceInformation;

        // 2. Processing Information (Auto-Capture & Tokenization)
        const processingInformation = new cybersourceRestApi.Ptsv2paymentsProcessingInformation();
        processingInformation.capture = true;
        if (req.body.isSubscription) {
            processingInformation.actionList = ["TOKEN_CREATE"];
            processingInformation.actionTokenTypes = ["customer", "paymentInstrument"];
        }
        requestObj.processingInformation = processingInformation;

        // 3. Payment Information (Inject the transient token from the frontend)
        const paymentInformation = new cybersourceRestApi.Ptsv2paymentsPaymentInformation();
        const tokenInfo = new cybersourceRestApi.Ptsv2paymentsPaymentInformationTokenInformation();
        tokenInfo.transientTokenJwt = req.body.transientToken;
        paymentInformation.tokenInformation = tokenInfo;
        requestObj.paymentInformation = paymentInformation;

        // 4. Order Information (Amount and Currency)
        const orderInformation = new cybersourceRestApi.Ptsv2paymentsOrderInformation();
        const amountDetails = new cybersourceRestApi.Ptsv2paymentsOrderInformationAmountDetails();
        amountDetails.totalAmount = req.body.amount || "0.10"; 
        amountDetails.currency = "JOD";
        orderInformation.amountDetails = amountDetails;
        requestObj.orderInformation = orderInformation;

        instance.createPayment(requestObj, function (error, data, response) {
            if (error) {
                let errorDetails = error.message || "Payment declined or failed";
                if (response && response.text) {
                    errorDetails = `${errorDetails} - ${response.text}`;
                }
                console.error('Error processing payment:', errorDetails);
                return res.status(500).json({ error: errorDetails });
            }
            res.json(data);
        });
    } catch (error) {
        console.error('Payment Execution Error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Direct Cybersource Gateway running on port ${port}`);
});
