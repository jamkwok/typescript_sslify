"use strict";
import * as cmd from "node-cmd";
import * as AWS from "aws-sdk";
import * as rq from "request-promise";
import * as jwt from "json-web-token";
import * as fs from 'fs';

//Hardcoded to Virginia as ACM certs need to be there for cloudfront, cloudfront itself is global
const acm = new AWS.ACM({region: 'us-east-1'});
const cf = new AWS.CloudFront({apiVersion: '2017-03-25'});

const env = require('./../../env.json');
const environment = process.env.environment || 'dev';
const port = process.env.PORT || env[environment].port;        // set our port
const jwtSchema = env[environment].jwtSchema;
const jwtSecret = env[environment].jwtSecret;
const letsEncryptOriginDomain = env[environment].letsencryptOrigin;

//Cloudfront Json Templates
const templateLetsencryptCacheBehaviour = require("./template_letsencrypt_cache_behaviour.json");
const templateLetsencryptOrigin = require("./template_letsencrypt_origin.json");

//Constants
const acmMaxResultsPerPage = '10';
const cfMaxResultsPerPage = '10';
const addLetsEncryptOriginWaitTime = 30000;

export class SslSentry {
  constructor() {
    return this;
  }

  async httpSslify(domain: string): Promise<any> {
    try {
      let token = await this.encodeJwt();
      let header = await this.tokenToHeader(token);
      //Send http request-promise
      return (await rq({
        method: 'POST',
        uri: 'http://localhost:' + port + '/api/sslify',
        headers: {
          Authorization: header
        },
        body: {
          Domain: domain
        },
        json: true
      }));
    } catch (err) {
      return Promise.reject({ "status": "Failed to sslify domain"});
    }
  }

  async headerToToken(header: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (header.indexOf("Bearer") !== -1) {
        const token = header.split(' ')[1];
        if(token) {
            return resolve(token);
        }
        return reject({ "status": "token not found"});
      }
      return reject({ "status": "failed to extract token"});
    });
  }

  async tokenToHeader(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      if (token) {
        return resolve("Bearer " + token);
      }
      return reject({ "status": "failed to create token header"});
    });
  }

  async encodeJwt(): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.encode(jwtSecret, jwtSchema, (err, token) => {
        if (err) {
          return reject({"status": "failed to encode"});
        }
        return resolve(token);
      });
    });
  }

  async decodeJwt(token: string): Promise<any> {
    return new Promise((resolve, reject) => {
      jwt.decode(jwtSecret, token, (err, decodedPayload, decodedHeader) => {
        if (err) {
          return reject({"status": "failure to decode"});
        }
        if (decodedPayload.application === 'sslSentry') {
          //schema validated
          return resolve(decodedPayload);
        }
        return reject({"status": "failed to validate jwt schema"});
      });
    });
  }

  async checkDomain(domain: string): Promise<any> {
    return rq('http://' + domain).catch(() => {
      //Transform http error into something more readable
      return new Promise((resolve, reject) => {
        return reject({"status": "Could not successfully get to webside" });
      });
    });
  }

  async getCloudfrontDomainByDomain(domain: string): Promise<any> {
    const cmdGetCloudfrontDomain = "dig " + domain + " grep 'CNAME' | grep 'cloudfront.net.' | awk -F'CNAME' '{ print $2}'"
    return new Promise((resolve, reject) => {
      cmd.get( cmdGetCloudfrontDomain, (err, data) => {
        if (err) {
          return reject({"status": "failed to extract cname from domain"});
        }
        let cloudfrontDomain = data.replace(/(\r\n|\n|\r|\t|\[[:BLANK:]])/gm,"").replace(/\.$/, '');
        if (cloudfrontDomain.indexOf('cloudfront.net') === -1) {
          return reject({"status": "domain not linked to cloudfront"});
        }
        return resolve(cloudfrontDomain);
      });
    });
  }

  async generateCerts(domain: string): Promise<any> {
    //Generates certs and returns the directory name they are located in.
    return new Promise((resolve, reject) => {
      cmd.run("rm -rf /etc/letsencrypt/archive/" + domain + "*");
      const cmdGetCert = "echo 'N' | certbot --webroot -w /var/www/html --preferred-challenges http-01 certonly -d " + domain + " -m james.kwok@siteminder.com --agree-tos";
      cmd.get( cmdGetCert, (err, data) => {
        if(err) {
          return reject({"status": "Error running certbot"});
        }
        console.log(err,data);
        return resolve(data);
      });
    }).then((data) => {
      const cmdGetDir = "ls /etc/letsencrypt/archive/ | grep -i " + domain + " | sort | tail -1"
      return new Promise((resolve, reject) => {
        cmd.get( cmdGetDir, (err, data) => {
          if (err) {
            return reject({"status": "failed to get certificate directory"});
          }
          return resolve(data.replace(/(\r\n|\n|\r)/gm,""));
        });
      });
    })
  }

  async getCertArn(domain: string): Promise<any> {
    try {
      let listOfAcmCerts = await this.listAcmCerts();
      const array = listOfAcmCerts.filter((certificateObject) => {
        return certificateObject.DomainName == domain;
      });
      if (array.length > 0) {
        return array[0].CertificateArn;
      }
      return '';
    } catch (error) {
      return Promise.reject({"status": "error in aws list certs for acm"});
    }
  }

  async listAcmCerts(paginationToken?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      var params: any = {
        CertificateStatuses: [ 'ISSUED', 'INACTIVE', 'EXPIRED' ],
        MaxItems: acmMaxResultsPerPage
      }

      if (paginationToken) {
        params.NextToken = paginationToken;
      }

      acm.listCertificates(params, (err, data) => {
        if (err) {
          return reject({"status": "error listing certificates"});
        }
        if (data.NextToken) {
          return this.listAcmCerts(data.NextToken).then((array) => {
            return resolve(data.CertificateSummaryList.concat(array));
          });
        }
        return resolve(data.CertificateSummaryList);
      });
    });
  }

  async uploadCertsToAcm(certArn: string, certDir: string): Promise<any> {
    const acmParam: any = {
      Certificate: fs.readFileSync('/etc/letsencrypt/live/' + certDir + '/cert.pem'),
      PrivateKey: fs.readFileSync('/etc/letsencrypt/live/' + certDir + '/privkey.pem'),
      CertificateChain: fs.readFileSync('/etc/letsencrypt/live/' + certDir + '/chain.pem')
    }
    if (certArn) {
      acmParam.CertificateArn = certArn;
    }

    return new Promise((resolve, reject) => {
      acm.importCertificate(acmParam, function(err, data) {
        if (err) {
          return reject({"status": "failed loading new certificates"});
        }
        return resolve(data.CertificateArn);
      });
    });
  }

  async getCloudfrontDistribution(domain: string): Promise<any> {
    try {
      let cloudfrontDistributionDomain = await this.getCloudfrontDomainByDomain(domain);
      let listOfCloudfrontDistributions = await this.listCloudfrontDistributions();
      return listOfCloudfrontDistributions.filter((cloudfrontObject) => {
        //DomainName is the one extracted from DNS Cname and we also check the domain is present inside cloudfront Aliases
        return (cloudfrontObject.DomainName === cloudfrontDistributionDomain) && (cloudfrontObject.Aliases.Items.indexOf(domain) !== -1);
      })[0];
    } catch (error) {
      return Promise.reject({"status": "failed listing Cloudfront Distributions"});
    }
  }

  async listCloudfrontDistributions(paginationToken?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      var params: any = {
        MaxItems: cfMaxResultsPerPage
      }

      if (paginationToken) {
        params.Marker = paginationToken;
      }

      cf.listDistributions(params, (err, data) => {
        if (err) {
          return reject({"status": "failed listing Cloudfront Distributions"});
        }
        if (data.DistributionList.NextMarker) {
          return this.listCloudfrontDistributions(data.DistributionList.NextMarker).then((array) => {
            return resolve(data.DistributionList.Items.concat(array));
          });
        }
        return resolve(data.DistributionList.Items);
      });
    });
  }

  async getDistributionConfig(cloudfrontDistribution: any): Promise<any> {
    return new Promise((resolve, reject) => {
      cf.getDistributionConfig({Id: cloudfrontDistribution.Id}, function(err, data) {
        if (err) {
          return reject({"status": "Cant find cloudfront distribution by given id"});
        }
        return resolve(data);
      });
    })
  }

  async updateCloudfrontDistributionToHttps(cloudfrontDistribution: any, certificateArn: string): Promise<any> {
    const distributionConfig = await this.getDistributionConfig(cloudfrontDistribution);
    distributionConfig.DistributionConfig.ViewerCertificate = {
      CloudFrontDefaultCertificate: false,
      ACMCertificateArn: certificateArn,
      SSLSupportMethod: 'sni-only',
      MinimumProtocolVersion: 'TLSv1'
    }
    distributionConfig.DistributionConfig.DefaultCacheBehavior.ViewerProtocolPolicy = 'redirect-to-https'
    distributionConfig.Id = cloudfrontDistribution.Id;
    distributionConfig.IfMatch = distributionConfig['ETag'];
    delete distributionConfig['ETag'];
    console.log(distributionConfig);
    return new Promise((resolve, reject) => {
      cf.updateDistribution(distributionConfig, (err, data) => {
        if (err) {
          return reject({"status": "failed to update SSL"});
        }
        return resolve(data);
      });
    });
  }

  async addLetsEncryptOriginIfRequired(cloudfrontDistribution: any): Promise<any> {
    const distributionConfig = await this.getDistributionConfig(cloudfrontDistribution);
    return new Promise((resolve, reject) => {
      if (distributionConfig.DistributionConfig.Origins.Items.filter((origin) => {
        return origin.Id == 'Custom-letsencrypt-Origin-CreatedBy-SSLSentry';
      }).length > 0) {
        console.log("##### Lets Encrypt Origin Exists");
        return resolve();
      } else {
        try {
          console.log("##### Lets Encrypt Origin DOES NOT Exist");
          const originQuantity = distributionConfig.DistributionConfig.Origins.Quantity;
          const cacheQuantity = distributionConfig.DistributionConfig.CacheBehaviors.Quantity;
          distributionConfig.Id = cloudfrontDistribution.Id;
          distributionConfig.IfMatch = distributionConfig['ETag'];
          delete distributionConfig['ETag'];
          distributionConfig.DistributionConfig.Origins.Quantity = originQuantity + 1;
          distributionConfig.DistributionConfig.CacheBehaviors.Quantity = cacheQuantity + 1;
          console.log(templateLetsencryptOrigin)
          console.log(templateLetsencryptCacheBehaviour);
          //Update LetsEncrypt Origin Domain
          templateLetsencryptOrigin.DomainName = letsEncryptOriginDomain;
          distributionConfig.DistributionConfig.Origins.Items.push(templateLetsencryptOrigin);
          distributionConfig.DistributionConfig.CacheBehaviors.Items.push(templateLetsencryptCacheBehaviour);
        } catch (err) {
          return reject({"status": "failed to modify origin"});
        }
        cf.updateDistribution(distributionConfig, (err, data) => {
          if (err) {
            return reject({"status": "failed to add origin"});
          }
          setTimeout(() => { return resolve(data); }, addLetsEncryptOriginWaitTime);
        });
      }
    });
  }
}
