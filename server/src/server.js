const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const cors = require("cors");
require("dotenv").config({ path: "./config/config.env" });
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(require("./routes/values"));
app.use(require("./routes/utilities"));
// app.use(require("./routes/turnservertoken"));
app.use(require("./routes/rooms"));
// get driver connection
const dbo = require("./db/conn");

app.get('/', async (req, res) => {
  await dbo.connectToServer(async function (err) {
    if (err) {
      res.json({
        message: "Error",
        error: err
      });
    }
    else {
      res.json({
        message: "New you access any api",
        error: ""
      });
    }
  });
});

app.listen(port, async () => {
  // perform a database connection when server starts
  await dbo.connectToServer(async function (err) {
    if (err) {
      console.log(`Error`);
    }
    else {
      console.log(`Server is running on port: ${port}`);
    }
  });
});