FROM ubuntu:16.04
MAINTAINER James Kwok: 0.1

# Install Dependencies
RUN apt-get update
RUN apt-get install -y apt-utils
RUN apt-get install -y nginx python awscli curl software-properties-common dnsutils cron
RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs
RUN add-apt-repository -y ppa:certbot/certbot
RUN apt-get update
RUN apt-get install -y python-certbot-nginx
RUN npm install -g typescript

# Install supervisor for multi process orchestration
RUN apt-get install -y supervisor
RUN mkdir -p /var/log/supervisor
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Deploy Node App
ADD app /app
WORKDIR "/app"
RUN npm install
RUN tsc
RUN echo "0 3 * * * /usr/bin/node /app/src/app_scrape.js" > crontab.txt && crontab crontab.txt

EXPOSE 80 3000
CMD ["/usr/bin/supervisord"]
