"use strict"
// app.js
//Required incase certificates are expired
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
// BASE SETUP
// =============================================================================

// Application
import { Utils } from "./Utils";
import { SslSentry } from "./SslSentry";
import { SslScheduler } from "./SslScheduler";

let sslSentry, sslScheduler;
let scrape = async () => {
  const utils = new Utils();
  try {
    let stsCredentials = await utils.getStsCredentials();
    sslSentry = new SslSentry(stsCredentials);
    sslScheduler = new SslScheduler(stsCredentials);
  } catch (err) {
    console.log(err);
  }
  let domains = await sslScheduler.getDomainsToBeRenewed();
  for (let domainObj of domains) {
    const status = await sslSentry.httpSslify(domainObj.Domain);
    console.log(domainObj.Domain,status);
  }
}
scrape();
