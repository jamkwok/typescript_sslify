"use strict";
//Hardcoded to Virginia as ACM certs need to be there for cloudfront, cloudfront itself is global
import * as AWS from "aws-sdk";
import * as rq from "request-promise";
import * as jwt from "json-web-token";
//Needs to be changed
const env = require('./../../env.json');
const environment = process.env.environment || 'dev';
const jwtSchema = env[environment].jwtSchema;
const jwtSecret = env[environment].jwtSecret;
const port = process.env.PORT || env[environment].port;        // set our port
const awsRole = env[environment].awsRole;

export class Utils {
  private sts: any;

  constructor() {
    //reinstantiate AWS
    this.sts = new AWS.STS();
    return this;
  }

  async getStsCredentials(): Promise<any> {
    return new Promise((resolve, reject) => {
      //No cross role detected return no credentials
      if(!awsRole) {
        return resolve();
      }

      this.sts.assumeRole({
        RoleArn: awsRole,
        RoleSessionName: 'canvasSslSentry'
      }, function (err, data) {
        if (err) {
          return reject({"status": "Unable to acquire AWS STS credentials"});
        }
        return resolve(new AWS.Credentials({
          accessKeyId: data.Credentials.AccessKeyId,
          secretAccessKey: data.Credentials.SecretAccessKey,
          sessionToken: data.Credentials.SessionToken
        }));
      });
    });
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

}
