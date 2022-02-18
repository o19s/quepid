# Terraform
TFDIR       := terraform
TFENV       ?= dev
TFWORKSPACE ?= default

TFVARFILE := $(TFENV).tfvars
define TFVARS
	--var-file $(TFVARFILE) --var aws_profile=$(AWS_PROFILE)
endef
TFBUCKET         = $(shell cd $(TFDIR)/base; terraform output tfstate_bucket)
TFDOCKERREGISTRY = $(shell cd $(TFDIR)/ecr; terraform output docker_registry)
define TFBACKENDCONF
	-backend-config="bucket=$(TFBUCKET)" \
	-backend-config="profile=$(BACKEND_AWS_PROFILE)" \
	-backend-config="key=$(TFENV).$*.terraform.tfstate"
endef
define TFWORKSPACESELECT
	terraform workspace select $(TFWORKSPACE) || \
		terraform workspace new $(TFWORKSPACE)
endef
TFWORKSPACERESET := terraform workspace select default

###########
# TARGETS #
###########

.PHONY: terraform-exists
terraform-exists:
ifeq (, $(shell which terraform))
	@echo "Could not find \`terraform\` in \$$PATH, consider running \`brew install terraform\`"
	@exit 1
endif

.PHONY: terraform-fmt
terraform-fmt: terraform-exists
	@terraform fmt -recursive $(TFDIR)

.PHONY: terraform-fmt-check
terraform-fmt-check: terraform-exists
	@terraform fmt -check -recursive $(TFDIR)

.PHONY: terraform-clean
terraform-clean: terraform-exists
	@find . '(' -type d -name .terraform ')' | xargs rm -rf

.PHONY: terraform-base-init
terraform-base-init: terraform-exists
	@cd $(TFDIR)/base; \
	terraform init;

.PHONY: terraform-base-create
terraform-base-create: terraform-exists
	@cd $(TFDIR)/base; \
	terraform init; \
	terraform apply --var aws_profile=$(AWS_PROFILE)

.PHONY: terraform-%-init
terraform-%-init: terraform-exists $(TFDIR)/%
	@cd $(TFDIR)/$*; \
	$(TFWORKSPACESELECT); \
	terraform init -reconfigure $(TFBACKENDCONF); \
	terraform state pull > .terraform/$(TFWORKSPACE).$(TFENV).terraform.tfstate
	@cd $(TFDIR)/$*; $(TFWORKSPACERESET)

.PHONY: terraform-%-create
terraform-%-create: terraform-exists $(TFDIR)/%
	@cd $(TFDIR)/$*; \
	$(TFWORKSPACESELECT); \
	terraform init -reconfigure $(TFBACKENDCONF); \
	terraform apply $(TFVARS) && \
	terraform state pull > .terraform/$(TFWORKSPACE).$(TFENV).terraform.tfstate
	@cd $(TFDIR)/$*; $(TFWORKSPACERESET)

.PHONY: terraform-%-destroy
terraform-%-destroy: terraform-exists $(TFDIR)/%
	@cd $(TFDIR)/$*; \
	$(TFWORKSPACESELECT); \
	terraform destroy $(TFVARS); \
	$(TFWORKSPACERESET)
ifneq ($(TFWORKSPACE),default)
	@read -p 'Delete workspace $(TFWORKSPACE)? Enter [Yy] to proceed: ' CONFIRM; \
	if [[ "$$CONFIRM" = "y" || "$$CONFIRM" = "Y" ]]; then \
		cd $(TFDIR)/$*; \
		terraform workspace delete $(TFWORKSPACE); \
		rm .terraform/$(TFWORKSPACE).$(TFENV).terraform.tfstate; \
	fi
endif

.PHONY: tfstate-bucket
tfstate-bucket: terraform-exists
	@echo $(TFBUCKET)

.PHONY: docker-registry
docker-registry: terraform-exists
	@echo $(TFDOCKERREGISTRY)
