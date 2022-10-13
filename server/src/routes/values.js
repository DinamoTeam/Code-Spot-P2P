const express = require("express");
const valuesRoutes = express.Router();

valuesRoutes.route("/api/values").get(async function(req, res) {
    res.send("The system is ready to serve you.");
});

module.exports = valuesRoutes;
