"use strict";
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
    if(awsCrossRoleCredentials) {
      console.log("Cross Account Role being used");
      this.dyn = new AWS.DynamoDB({credentials: awsCrossRoleCredentials, region: awsRegion});
    } else {
      console.log("Same Account Role being used");
      this.dyn = new AWS.DynamoDB({region: awsRegion});
    }
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
         console.log(err);
         return reject({"status": "failed to add domain in Dynamo"});
       }
       return resolve({"status": "successfully added domain in Dynamo"});
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
         console.log(err);
         return reject({"status": "failed to update domain in Dynamo"});
       }
       return resolve({"status": "successfully updated domain in Dynamo"});
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
         console.log(err);
         return reject({"status": "failed to remove domain in Dynamo"});
       }
       return resolve({"status": "successfully removed domain in Dynamo"});
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
      console.log(err);
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
          console.log(err);
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
