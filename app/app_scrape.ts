"use strict"
// app.js
//Required incase certificates are expired
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// BASE SETUP
// =============================================================================

// Application
const SslSentry = require("./src/sslSentry");
const sslSentry = new SslSentry();

const SslScheduler = require("./src/sslScheduler");
const sslScheduler = new SslScheduler();

let scrape = async () => {
  let domains = await sslScheduler.getDomainsToBeRenewed();
  for (let domainObj of domains) {
    const status = await sslSentry.httpSslify(domainObj.Domain);
    console.log(domainObj.Domain,status);
  }
}
scrape();
