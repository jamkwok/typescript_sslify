
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

resource "aws_security_group" "allow_ssh_http" {
  name        = "allow_ssh_http"
  description = "Allow all inbound traffic"

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["${var.myIp}"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["${var.myIp}"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 123
    to_port     = 123
    protocol    = "udp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 80
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags {
    Name = "allow_ssh_http"
  }
}

resource "aws_iam_role" "letsencrypt_role" {
  name = "letsencrypt_role"
  assume_role_policy = <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Action": "sts:AssumeRole",
      "Principal": {
        "Service": "ec2.amazonaws.com"
      },
      "Effect": "Allow",
      "Sid": ""
    }
  ]
}
EOF
}

resource "aws_iam_instance_profile" "letsencrypt_role_profile" {
  name  = "letsencrypt_role_profile"
  role = "${aws_iam_role.letsencrypt_role.name}"
}

resource "aws_iam_policy" "letsencrypt_policy" {
  name        = "letsencrypt_policy"
  path        = "/"
  description = "letsencrypt_policy"
  policy = <<EOF
{
"Version": "2012-10-17",
"Statement": [
  {
    "Action": [
      "acm:*",
      "cloudfront:*",
      "route53:*",
      "dynamodb:*"
    ],
    "Effect": "Allow",
    "Resource": "*"
  }
]
}
EOF
}

resource "aws_iam_role_policy_attachment" "letsencrypt_role_attach" {
    role       = "${aws_iam_role.letsencrypt_role.name}"
    policy_arn = "${aws_iam_policy.letsencrypt_policy.arn}"
}

resource "aws_instance" "LetsEncrypt" {
  depends_on = ["aws_security_group.allow_ssh_http","aws_iam_role.letsencrypt_role","aws_iam_instance_profile.letsencrypt_role_profile"]
  ami           = "ami-e2021d81"
  availability_zone = "${lookup(var.availabilityZones, var.region)}"
  key_name = "${var.sshKey}"
  instance_type = "t2.nano"
  security_groups = [ "${aws_security_group.allow_ssh_http.name}" ]
  iam_instance_profile = "${aws_iam_instance_profile.letsencrypt_role_profile.name}"
  user_data = "${file("LetsEncrypt_userdata.sh")}"
  /*
  provisioner "remote-exec" {
    inline = [
      "sudo apt-get upgrade",
      "echo $(date) > /tmp/flag"
    ]
    connection {
      type     = "ssh"
      user     = "ubuntu"
      private_key = "${file("/Users/jameskwok/.ssh/JamesKwok.pem")}"
    }
  }
  */
  lifecycle {
    create_before_destroy = true
  }
  tags {
    Name = "${var.region}-Temp-LetsEncrypt"
  }
}
data "aws_route53_zone" "selected" {
  name         = "${var.dnsApex}."
  private_zone = false
}

resource "aws_route53_record" "letsencryptDomain" {
  depends_on = ["aws_instance.LetsEncrypt"]
  zone_id = "${data.aws_route53_zone.selected.zone_id}"
  name    = "letsencrypt.${var.dnsApex}"
  type    = "A"
  ttl     = "300"
  records = ["${aws_instance.LetsEncrypt.public_ip}"]
}
