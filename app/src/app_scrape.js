"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
let scrape = () => __awaiter(this, void 0, void 0, function* () {
    let domains = yield sslScheduler.getDomainsToBeRenewed();
    for (let domainObj of domains) {
        const status = yield sslSentry.httpSslify(domainObj.Domain);
        console.log(domainObj.Domain, status);
    }
});
scrape();
