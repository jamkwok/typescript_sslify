#sslSentry
FROM ubuntu:16.04

MAINTAINER James Kwok: 0.1

#Install Dependencies
RUN apt-get update
RUN apt-get install -y apt-utils
RUN apt-get install -y nginx python awscli ntp curl software-properties-common
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs
RUN add-apt-repository -y ppa:certbot/certbot
RUN apt-get update
RUN apt-get install -y python-certbot-nginx
RUN npm install -g typescript

ADD app .
RUN cd app; tsc
RUN echo "0 3 * * * /usr/bin/node /typescript_sslify/app/src/app_scrape.js" > crontab.txt && crontab crontab.txt

EXPOSE 80 3000
CMD cron && /usr/bin/node /root/app/src/app.js
