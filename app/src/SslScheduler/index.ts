"use strict";
//Hardcoded to Virginia as ACM certs need to be there for cloudfront, cloudfront itself is global
import * as AWS from "aws-sdk";
//Needs to be changed
const env = require('./../../env.json');
const environment = process.env.environment || 'dev';
const awsRegion = env[environment].awsRegion;
const dataStore = env[environment].dataStore;
const days_90 = 90*24*60*60*1000; //90 days - The expiry
const days_31 = 31*24*60*60*1000; //31 days
const days_30 = 30*24*60*60*1000; //30 days - Renew domains with expiries less than this

export class SslScheduler {
  private dyn: any;

  constructor(awsCrossRoleCredentials: any) {
    //reinstantiate AWS
    this.dyn = new AWS.DynamoDB({credentials: awsCrossRoleCredentials, region: awsRegion});
    return this;
  }

  async addDomain(domain: string) {
    return new Promise((resolve, reject) => {
      if(!domain) {
        return reject({"status": "invalid domain"});
      }
      this.dyn.putItem({
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

  async updateDomainExpiry(domain: string) {
    //sets expiry +90 days
    return new Promise((resolve, reject) => {
      if(!domain) {
        return reject({"status": "invalid domain"});
      }
      this.dyn.putItem({
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

  async removeDomain(domain: string) {
    return new Promise((resolve, reject) => {
      if(!domain) {
        return reject({"status": "invalid domain"});
      }
      this.dyn.deleteItem({
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

  async getDomainsToBeRenewed(): Promise<any> {
    const now_plus_30day = new Date(new Date().getTime()+days_30).toISOString();
    try {
      const allDomains = await this.listDynamoItems();
      return Promise.resolve(allDomains.map((obj) => {
        return {
          Domain: obj.Domain.S,
          Expiry: obj.Expiry.S
        };
      }).filter((mappedObj) => {
        return mappedObj.Expiry < now_plus_30day;
      }));
    } catch (err) {
      return Promise.reject({"status": "Unable to get list of domains"});
    }
  }

  async listDynamoItems(LastEvaluatedKey?: any): Promise<any> {
    //scan all domains registered in dynamo
    return new Promise((resolve, reject) => {
      var params: any = {
        TableName: dataStore
      }
      if (LastEvaluatedKey) {
        params.ExclusiveStartKey = LastEvaluatedKey;
      }
      this.dyn.scan(params, (err, data) => {
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
