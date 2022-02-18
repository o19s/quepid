SHELL       := bash
MKFILE_PATH := $(abspath $(lastword $(MAKEFILE_LIST)))
MKFILE_DIR  := $(realpath $(dir $(MKFILE_PATH)))

# Project files and directories
BUILDFILES  := buildfiles
NODEMODULES := node_modules
PACKAGEJSON := package.json
PACKAGELOCK := package-lock.json
SCRIPTS     := scripts

# AWS configuration
AWS_REGION          := $(shell echo $${AWS_REGION:-$${AWS_DEFAULT_REGION:-'us-east-1'}})
AWS_PROFILE         ?= $(shell awsprof mss-cloud-news:.+devops)
BACKEND_AWS_PROFILE ?= $(shell awsprof mss-cloud-news:.+devops)

# Docker configuration
TAG_PREFIX     := 175259281135.dkr.ecr.us-east-1.amazonaws.com/
PROJECT        ?= $(shell node -pe "require('./$(PACKAGEJSON)').name")
VERSION        ?= $(shell node -pe "require('./$(PACKAGEJSON)').version")
DOCKERTAG      ?= $(TAG_PREFIX)$(PROJECT):$(VERSION)

###########
# TARGETS #
###########

# Install project dependencies
.PHONY: install
install:
	@npm install

# Run unit tests
.PHONY: test
test:
	@npm run test:unit

# Build Docker image
.PHONY: build
build:
	@./scripts/generate-docker-env.sh
	@docker build -t $(DOCKERTAG) .

.PHONY: ecr-login
ecr-login:
	@$(SCRIPTS)/docker-ecr-login

#############################
# INCLUDE OTHER BUILD FILES #
#############################

include $(BUILDFILES)/*.mk
