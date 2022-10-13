const express = require("express");
const nodemailer = require("nodemailer");
const htmlToText = require('nodemailer-html-to-text').htmlToText;
 
// utilityRoutes is an instance of the express router.
// We use it to define our routes.
// The router will be added as a middleware and will take control of requests starting with path /utilities.
const utilityRoutes = express.Router();
 
// This will help us connect to the database
const dbo = require("../db/conn");
 
// This help convert the id from string to ObjectId for the _id.
const ObjectId = require("mongodb").ObjectId;

const smtpAddress = "smtppro.zoho.in";
const portNumber = 465;
// const enableSSL = true;
const enableTLS = true;
const emailFromAddress = "umeshpanchal@zohomail.in";

utilityRoutes.route("/api/Utilities/SendEmail").post(async function (req, res) {
  let emailBody = "";
  emailBody += `<p>Name: ${req.body.name}</p>`;
  emailBody += `<p>Email: ${req.body.email}</p>`;
  emailBody += `<p>Subject: ${req.body.subject}</p>`;
  emailBody += `<p>Message: </p>`;
  emailBody += `<p>${req.body.message}</p>`;
    
  await SendEmail(emailBody);

  res.json({ response: "Email sent sucessful!" });
});

utilityRoutes.route("/api/Utilities/SendFeedbackForm").post(async function (req, res) {
  let emailBody = "";
  emailBody += "<p>Your overall satisfaction of the app: " + req.body.satisfactionLevel + "</p>";
  emailBody += "<p>How satisfied are you with the ability to collaborate with others using this app? " + req.body.collabLevel + "</p>";
  emailBody += "<p>What do you like most about the app? " + req.body.didWell + "</p>";
  emailBody += "<p>Which of the issues below was the biggest problem during your experience? " + req.body.issue + "</p>";
  emailBody += "<p>Please describe the problem you encountered in more detail: " + req.body.issueDetails + "</p>";
  emailBody += "<p>Do you have any suggestions for improvement? " + req.body.improvement + "</p>";
    
  await SendEmail(emailBody);

  res.json({ response: "Email sent sucessful!" });
});

async function SendEmail(emailBody) {
  let password = process.env.EmailPassword;

  let transporter = nodemailer.createTransport({
    host: smtpAddress,
    port: portNumber,
    secure: true, // true for 465, false for other ports
    requireTLS: enableTLS,
    auth: {
      user: emailFromAddress,
      pass: password,
    },
  });
  transporter.use('compile', htmlToText());

  try {
    let info = await transporter.sendMail({
      from: emailFromAddress,
      // to: "gtt27@drexel.edu, atran33@mylangara.ca", // list of receivers
      to: "user7@mailinator.com", // list of receivers
      subject: "Message from Code Spot", // Subject line
      html: emailBody,
    });
  
    console.log("Message sent: %s", info.messageId);
  } catch(ex) {
    console.log(`Error: ${ex}`);
  }
}

module.exports = utilityRoutes;
