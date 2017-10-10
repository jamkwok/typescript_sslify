#sslSentry
FROM ubuntu:16.04

MAINTAINER James Kwok: 0.1

#Install Dependencies
RUN curl -sL https://deb.nodesource.com/setup_8.x | sudo -E bash -
RUN apt-get install -y nodejs nginx python awscli ntp
RUN add-apt-repository -y ppa:certbot/certbot
RUN apt-get update
RUN apt-get install -y python-certbot-nginx
RUN npm install -g typescript

ADD app /root
RUN tsc /root/app
RUN echo "0 3 * * * /usr/bin/node /typescript_sslify/app/src/app_scrape.js" > crontab.txt && crontab crontab.txt

EXPOSE 80 3000

CMD cron && node /root/app/src/app.js