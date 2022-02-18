/* Output values */

output "app" {
  value = var.app
}

output "aws_profile" {
  value = var.aws_profile
}

output "aws_region" {
  value = var.aws_region
}

output "env" {
  value = var.env
}

output "saml_role" {
  value = var.saml_role
}

output "tags" {
  value = merge(
    var.tags,
    {
      "application" = var.app,
      "environment" = var.env
    },
  )
}
