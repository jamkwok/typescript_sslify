#!/bin/bash
#Install Dependencies
curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
apt-get install -y nodejs nginx python awscli ntp
#Install LetsEncrypt
add-apt-repository -y ppa:certbot/certbot
apt-get update
apt-get install -y python-certbot-nginx
#Clone repo
git clone https://github.com/jamkwok/typescript_sslify.git
#Npm install
cd typescript_sslify/app
npm install
npm install -g pm2
npm install -g typescript
npm install -g gulp
pm2 start --name sslSentry /typescript_sslify/app/app.js
echo "0 3 * * * /usr/bin/node /typescript_sslify/app/app_scrape.js" > crontab.txt
crontab crontab.txt
