#!/bin/bash
#Install Dependencies
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
apt-get install -y nodejs nginx python awscli ntp
#Install LetsEncrypt
add-apt-repository -y ppa:certbot/certbot
apt-get update
apt-get install -y python-certbot-nginx
#Clone repo
git clone https://github.com/jamkwok/terraform-aws.git
#Npm install
cd terraform-aws/letsencrypt_microservice
npm install
npm install -g pm2
pm2 start --name sslSentry /terraform-aws/letsencrypt_microservice/app.js
echo "0 3 * * * /usr/bin/node /terraform-aws/letsencrypt_microservice/app_scrape.js" > crontab.txt
crontab crontab.txt
