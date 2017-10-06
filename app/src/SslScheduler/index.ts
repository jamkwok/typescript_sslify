"use strict";
//Hardcoded to Virginia as ACM certs need to be there for cloudfront, cloudfront itself is global
import * as AWS from "aws-sdk";
//Needs to be changed
const dyn = new AWS.DynamoDB({region: 'ap-southeast-2'});
const env = require('./../../env.json');
const environment = process.env.environment || 'dev';
const dataStore = env[environment].dataStore;
const days_90 = 90*24*60*60*1000; //90 days - The expiry
const days_31 = 31*24*60*60*1000; //31 days
const days_30 = 30*24*60*60*1000; //30 days - Renew domains with expiries less than this

export class sslScheduler {
  constructor() {
    return this;
  }

  async addDomain(domain) {
    return new Promise((resolve, reject) => {
      if(!domain) {
        return reject({"status": "invalid domain"});
      }
      dyn.putItem({
        Item: {
         "Domain": {
           S: domain
          },
         "Expiry": {
           S: new Date(new Date().getTime()+days_31).toISOString()
          }
        },
        TableName: dataStore
      }, (err, data) => {
       if (err) {
         return reject({"status": "failed to add domain"});
       }
       return resolve({"status": "successfully added domain"});
      });
    });
  }

  async updateDomainExpiry(domain) {
    //sets expiry +90 days
    return new Promise((resolve, reject) => {
      if(!domain) {
        return reject({"status": "invalid domain"});
      }
      dyn.putItem({
        Item: {
         "Domain": {
           S: domain
          },
         "Expiry": {
           S: new Date(new Date().getTime()+days_90).toISOString()
          }
        },
        TableName: dataStore
      }, (err, data) => {
       if (err) {
         return reject({"status": "failed to update domain"});
       }
       return resolve({"status": "successfully updated domain"});
      });
    });
  }

  async removeDomain(domain) {
    return new Promise((resolve, reject) => {
      if(!domain) {
        return reject({"status": "invalid domain"});
      }
      dyn.deleteItem({
        Key: {
         "Domain": {
           S: domain
          }
        },
        TableName: dataStore
      }, (err, data) => {
       if (err) {
         return reject({"status": "failed to remove domain"});
       }
       return resolve({"status": "successfully removed domain"});
      });
    });
  }

  async getDomainsToBeRenewed() {
    const now_plus_30day = new Date(new Date().getTime()+days_30).toISOString();
    try {
      const allDomains = await this.listDynamoItems();
      return allDomains.map((obj) => {
        return {
          Domain: obj.Domain.S,
          Expiry: obj.Expiry.S
        };
      }).filter((mappedObj) => {
        return mappedObj.Expiry < now_plus_30day;
      });
    } catch (err) {
      return Promise.reject({"status": "Unable to get list of domains"});
    }
  }

  async listDynamoItems(LastEvaluatedKey) {
    //scan all domains registered in dynamo
    return new Promise((resolve, reject) => {
      var params = {
        TableName: dataStore
      }
      if (LastEvaluatedKey) {
        params.ExclusiveStartKey = LastEvaluatedKey;
      }
      dyn.scan(params, (err, data) => {
        if (err) {
          return reject({"status": "error getting records from datastore"});
        }
        if (data.LastEvaluatedKey) {
          return this.listDynamoItems(data.LastEvaluatedKey).then((array) => {
            return resolve(data.Items.concat(array));
          });
        }
        return resolve(data.Items);
      });
    });
  }
}
