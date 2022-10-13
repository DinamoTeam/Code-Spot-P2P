const express = require("express");
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const client = require('twilio')(accountSid, authToken);
const turnServerTokenRoutes = express.Router();

turnServerTokenRoutes.route("/api/turnServerToken").get(async function(req, res) {
    const token = await client.tokens.create();

    res.json(token);    
});

module.exports = turnServerTokenRoutes;
