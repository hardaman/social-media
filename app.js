const express = require("express");
const bodyParser = require("body-parser");
const pg = require("pg");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const app = express();
app.use(bodyParser.json());
const cookieParser = require("cookie-parser");
app.use(cookieParser());
const userRoutes = require("./userRoutes");

// Using Router
app.use("/api", userRoutes);

// Start server
app.listen(3000, () => {
  console.log("Server is listening on port 3000");
});
