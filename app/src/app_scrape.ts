"use strict"
// app.js
//Required incase certificates are expired
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// BASE SETUP
// =============================================================================

// Application
// Application
import { SslSentry } from "./SslSentry";
import { SslScheduler } from "./SslScheduler";
const sslSentry = new SslSentry();
const sslScheduler = new SslScheduler();

let scrape = async () => {
  let domains = await sslScheduler.getDomainsToBeRenewed();
  for (let domainObj of domains) {
    const status = await sslSentry.httpSslify(domainObj.Domain);
    console.log(domainObj.Domain,status);
  }
}
scrape();
