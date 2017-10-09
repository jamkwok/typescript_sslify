"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
//Hardcoded to Virginia as ACM certs need to be there for cloudfront, cloudfront itself is global
const AWS = require("aws-sdk");
//Needs to be changed
const dyn = new AWS.DynamoDB({ region: 'ap-southeast-2' });
const env = require('./../../env.json');
const environment = process.env.environment || 'dev';
const dataStore = env[environment].dataStore;
const days_90 = 90 * 24 * 60 * 60 * 1000; //90 days - The expiry
const days_31 = 31 * 24 * 60 * 60 * 1000; //31 days
const days_30 = 30 * 24 * 60 * 60 * 1000; //30 days - Renew domains with expiries less than this
class SslScheduler {
    constructor() {
        return this;
    }
    addDomain(domain) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (!domain) {
                    return reject({ "status": "invalid domain" });
                }
                dyn.putItem({
                    Item: {
                        "Domain": {
                            S: domain
                        },
                        "Expiry": {
                            S: new Date(new Date().getTime() + days_31).toISOString()
                        }
                    },
                    TableName: dataStore
                }, (err, data) => {
                    if (err) {
                        return reject({ "status": "failed to add domain" });
                    }
                    return resolve({ "status": "successfully added domain" });
                });
            });
        });
    }
    updateDomainExpiry(domain) {
        return __awaiter(this, void 0, void 0, function* () {
            //sets expiry +90 days
            return new Promise((resolve, reject) => {
                if (!domain) {
                    return reject({ "status": "invalid domain" });
                }
                dyn.putItem({
                    Item: {
                        "Domain": {
                            S: domain
                        },
                        "Expiry": {
                            S: new Date(new Date().getTime() + days_90).toISOString()
                        }
                    },
                    TableName: dataStore
                }, (err, data) => {
                    if (err) {
                        return reject({ "status": "failed to update domain" });
                    }
                    return resolve({ "status": "successfully updated domain" });
                });
            });
        });
    }
    removeDomain(domain) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                if (!domain) {
                    return reject({ "status": "invalid domain" });
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
                        return reject({ "status": "failed to remove domain" });
                    }
                    return resolve({ "status": "successfully removed domain" });
                });
            });
        });
    }
    getDomainsToBeRenewed() {
        return __awaiter(this, void 0, void 0, function* () {
            const now_plus_30day = new Date(new Date().getTime() + days_30).toISOString();
            try {
                const allDomains = yield this.listDynamoItems();
                return Promise.resolve(allDomains.map((obj) => {
                    return {
                        Domain: obj.Domain.S,
                        Expiry: obj.Expiry.S
                    };
                }).filter((mappedObj) => {
                    return mappedObj.Expiry < now_plus_30day;
                }));
            }
            catch (err) {
                return Promise.reject({ "status": "Unable to get list of domains" });
            }
        });
    }
    listDynamoItems(LastEvaluatedKey) {
        return __awaiter(this, void 0, void 0, function* () {
            //scan all domains registered in dynamo
            return new Promise((resolve, reject) => {
                var params = {
                    TableName: dataStore
                };
                if (LastEvaluatedKey) {
                    params.ExclusiveStartKey = LastEvaluatedKey;
                }
                dyn.scan(params, (err, data) => {
                    if (err) {
                        return reject({ "status": "error getting records from datastore" });
                    }
                    if (data.LastEvaluatedKey) {
                        return this.listDynamoItems(data.LastEvaluatedKey).then((array) => {
                            return resolve(data.Items.concat(array));
                        });
                    }
                    return resolve(data.Items);
                });
            });
        });
    }
}
exports.SslScheduler = SslScheduler;
