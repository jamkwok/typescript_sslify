
variable "region" {
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

//Mapping
variable "regionId" {
  type = "map"
  default = {
    sydney = "ap-southeast-2"
    oregon = "us-west-2"
  }
}
variable "availabilityZones" {
  type = "map"
  default = {
    sydney = "ap-southeast-2a"
    oregon = "us-west-2a"
  }
}

provider "aws" {
  region = "${lookup(var.regionId, var.region)}"
}

resource "aws_dynamodb_table" "sslSentry" {
  name           = "${var.dynamoDbName}"
  read_capacity  = "${var.dynamoReadCap}"
  write_capacity = "${var.dynamoWriteCap}"
  hash_key       = "Domain"

  attribute {
    name = "Domain"
    type = "S"
  }

  tags {
    Name        = "dynamodb_sslSentry"
  }
}
