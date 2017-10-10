
variable "myIp" {
  type = "string"
}

variable "sshKey" {
  type = "string"
}

variable "region" {
  type = "string"
}

variable "dnsApex" {
  type = "string"
}

variable "dynamoReadCap" {
  type = "string"
}

variable "dynamoWriteCap" {
  type = "string"
}

variable "dynamoDbName" {
  type = "string"
}


module "ec2" {
  region = "${var.region}"
  myIp = "${var.myIp}"
  sshKey = "${var.sshKey}"
  region = "${var.region}"
  dnsApex = "${var.dnsApex}"
  source = "./ec2"
}

module "dynamo" {
  region = "${var.region}"
  dynamoReadCap = "${var.dynamoReadCap}"
  dynamoWriteCap = "${var.dynamoWriteCap}"
  dynamoDbName = "${var.dynamoDbName}"
  source = "./dynamo"
}
