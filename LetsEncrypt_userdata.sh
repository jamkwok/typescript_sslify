#!/bin/bash
#Install Docker
apt-get install -y docker.io socat apt-transport-https htop git
#Get Source Code
git clone https://github.com/jamkwok/typescript_sslify.git
cd typescript_sslify
#Build Docker Image
docker build .
