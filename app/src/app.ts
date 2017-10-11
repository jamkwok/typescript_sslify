"use strict"
// Express Packages
import * as express from "express";
import * as bodyParser from "body-parser";
import * as methodOverride from "method-override";

// Application
import { Utils } from "./Utils";
import { SslSentry } from "./SslSentry";
import { SslScheduler } from "./SslScheduler";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// configure app to use bodyParser()
// this will let us get the data from a POST
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(methodOverride());

// Get environment JSON.
const env = require('./../env.json');
const environment = process.env.environment || 'dev';
const port = process.env.PORT || env[environment].port;        // set our port

// ROUTES FOR OUR API
// =============================================================================
const router = express.Router();              // get an instance of the express Router

// test route to make sure everything is working (accessed at GET http://localhost:8080/api)
//Declare Aws Variables

router.get('/', (req, res) => {
  res.json({ "status": "Success" });
});

router.get('/renewals', (req, res) => {
  let sslSentry, sslScheduler;
  //const sslSentry = new SslSentry();
  //const sslScheduler = new SslScheduler();
  const header = req.get("Authorization");
  const domain = req.body.Domain;
  const utils = new Utils();
  let certDir, certificateArn;
  return utils.getStsCredentials().then((credentials) => {
    sslSentry = new SslSentry(credentials);
    sslScheduler = new SslScheduler(credentials);
    //extract header Jwt Token
    return utils.headerToToken(header);
  }).then((token) => {
    return utils.decodeJwt(token);
  }).then(() => {
    return sslScheduler.getDomainsToBeRenewed();
  }).then((data) => {
    return res.json({ Domains: data });
  }).catch((err) => {
    return res.json(err);
  });
});

router.post('/add', (req, res) => {
  if (!req.body.Domain) {
      return res.json({ "status": "Domain not in payload" });
  }
  let sslSentry, sslScheduler;
  //const sslSentry = new SslSentry();
  //const sslScheduler = new SslScheduler();
  const header = req.get("Authorization");
  const domain = req.body.Domain;
  const utils = new Utils();
  let certDir, certificateArn;
  return utils.getStsCredentials().then((credentials) => {
    sslSentry = new SslSentry(credentials);
    sslScheduler = new SslScheduler(credentials);
    //extract header Jwt Token
    return utils.headerToToken(header);
  }).then((token) => {
    return utils.decodeJwt(token);
  }).then(() => {
    return sslScheduler.addDomain(domain);
  }).then((data) => {
    return res.json(data);
  }).catch((err) => {
    return res.json(err);
  });
});

router.post('/remove', (req, res) => {
  if (!req.body.Domain) {
      return res.json({ "status": "Domain not in payload" });
  }
  let sslSentry, sslScheduler;
  //const sslSentry = new SslSentry();
  //const sslScheduler = new SslScheduler();
  const header = req.get("Authorization");
  const domain = req.body.Domain;
  const utils = new Utils();
  let certDir, certificateArn;
  return utils.getStsCredentials().then((credentials) => {
    sslSentry = new SslSentry(credentials);
    sslScheduler = new SslScheduler(credentials);
    //extract header Jwt Token
    return utils.headerToToken(header);
  }).then((token) => {
    return utils.decodeJwt(token);
  }).then(() => {
    return sslScheduler.removeDomain(domain);
  }).then((data) => {
    return res.json(data);
  }).catch((err) => {
    return res.json(err);
  });
});

router.post('/sslify', (req, res) => {
  if (!req.body.Domain) {
      return res.json({ "status": "Domain not in payload" });
  }
  let sslSentry, sslScheduler;
  const header = req.get("Authorization");
  const domain = req.body.Domain;
  const utils = new Utils();
  let certDir, cloudfrontDistribution;
  return utils.getStsCredentials().then((credentials) => {
    sslSentry = new SslSentry(credentials);
    sslScheduler = new SslScheduler(credentials);
    //extract header Jwt Token
    return utils.headerToToken(header);
  }).then((token) => {
    return utils.decodeJwt(token);
  }).then(() => {
    // Check domain is connected to website
    return sslSentry.checkDomain(domain);
  }).then(() => {
    //Search by ( www.jameskwok.com --> ABC.cloudfront.net ) to get Distribution Object
    return sslSentry.getCloudfrontDistribution(domain);
  }).then((cloudfrontDist) => {
    cloudfrontDistribution = cloudfrontDist;
    //Add LetsEncrypt Origin
    return sslSentry.addLetsEncryptOriginIfRequired(cloudfrontDistribution);
  }).then((data) => {
    //Mark Expiry as now to signify the domain is being processed.
    return sslScheduler.addDomain(domain);
  }).then((data) => {
    //Generate Letsencrypt SSL
    return sslSentry.generateCerts(domain);
  }).then((data) => {
    //Get Cert ARN
    certDir = data;
    return sslSentry.getCertArn(domain);
  }).then((certArn) => {
    //Upload SSL certificates to ACM
    return sslSentry.uploadCertsToAcm(certArn, certDir);
  }).then((certificateArn) => {
    //Update Distribution with ACM SSL and https redirection.
    return sslSentry.updateCloudfrontDistributionToHttps(cloudfrontDistribution, certificateArn);
  }).then(() => {
    //If SSL has been successful then update expiry in datastore.
    return sslScheduler.updateDomainExpiry(domain);
  }).then(() => {
    return res.json({"status": "ssl updated and applied"});
  }).catch((err) => {
    return res.json(err);
  });
});

//Catch all routes for 404
router.get('*', (req, res) => {
  res.json({"status": "Invalid Method or route"});
});

router.post('*', (req, res) => {
  res.json({"status": "Invalid Method or route"});
});

// more routes for our API will happen here

// REGISTER OUR ROUTES -------------------------------
// all of our routes will be prefixed with /api
app.use('/api', router);

// For malformed JSON
app.use(function (err, req, res, next) {
  res.status(400);
	res.send({ "status": "Invalid Json" });
});


// START THE SERVER
// =============================================================================
app.listen(port);
console.log('SSL Sentry with Scheduler on port ' + port);
