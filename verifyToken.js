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
const pool = require("./db");
const your_secret_key = require('./secret');

function verifyToken(req, res, next) {
    const token = req.headers.authorization.split(" ")[1];
  
    jwt.verify(token, your_secret_key, (err, decoded) => {
      if (err) {
        return res.status(401).send("Invalid token");
      }
  
      console.log(decoded); // check the value of decoded
  
      req.user = decoded;
      next();
    });
  }

  module.exports = verifyToken;