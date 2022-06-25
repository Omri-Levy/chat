terraform {
  required_providers {
	aws = {
	  source = "hashicorp/aws"
	}
  }
}

provider "aws" {
  profile = "default"
  region  = "eu-central-1"
}

resource "aws_instance" "chat_server" {
  ami             = "ami-09439f09c55136ecf"
  instance_type   = "t2.micro"
  security_groups = ["security_chat_server"]

  user_data = <<EOF
	#!/bin/bash

	# Update the instance and install dependencies
	sudo yum update -y
	sudo amazon-linux-extras install docker -y
	sudo service docker start
	sudo usermod -a -G docker ec2-user
	sudo curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose
	sudo chmod +x /usr/local/bin/docker-compose
	sudo amazon-linux-extras install epel -y
	sudo yum install certbot-apache -y

	EOF

  tags = {
	Name = "ChatServerInstance"
  }

  provisioner "file" {
	source      = "docker-compose.yml"
	destination = "/docker-compose.yml"
  }

  provisioner "file" {
	source      = "../.env"
	destination = "/.env"
  }

  provisioner "file" {
	source      = "haproxy.cfg"
	destination = "/haproxy.cfg"
  }

  provisioner "file" {
	content     = "~/.ssh/public.pub"
	destination = "/.ssh/authorized_keys"
  }
}

resource "aws_security_group" "security_chat_server" {
  name        = "security_chat_server"
  description = "security group for chat server"

  ingress {
	protocol    = "tcp"
	from_port   = "80"
	to_port     = "80"
	cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
	protocol    = "tcp"
	from_port   = "443"
	to_port     = "443"
	cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
	protocol    = "tcp"
	from_port   = 22
	to_port     = 22
	cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
	protocol    = "tcp"
	from_port   = "80"
	to_port     = "80"
	cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
	protocol    = "tcp"
	from_port   = 443
	to_port     = 443
	cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
	Name = "security_chat_server"
  }
}
