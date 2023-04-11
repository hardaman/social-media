const crypto = require("crypto");
const your_secret_key = crypto.randomBytes(32).toString("hex");

module.exports = your_secret_key;