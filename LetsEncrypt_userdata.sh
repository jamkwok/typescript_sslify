#!/bin/bash
#Install Docker
apt-get install -y docker.io socat apt-transport-https htop git
#Get Source Code
git clone https://github.com/jamkwok/typescript_sslify.git
cd typescript_sslify
#Build Docker Image
docker build -t sslsentry:0.0.1 .
#Run Docker Image
docker run -d -t sslsentry:0.0.1
