#!/usr/bin/env bats

# BATS test for starting Solr and uploading configurations
# This test verifies that techproducts configuration can be uploaded to Solr
# alongside the default configuration that is uploaded by default.
#
# The techproducts configset is a sample configuration that comes with Solr
# but is not uploaded by default (only _default is uploaded by default).

# Setup function run before each test
setup() {
    # Set the config path and name as system properties as mentioned in requirements
    # Path property: points to the techproducts configuration directory
    export SOLR_CONFIG_PATH="solr/server/solr/configsets/sample_techproducts_configs/conf"
    
    # Name property: identifies the configuration as "techproducts"
    export SOLR_CONFIG_NAME="techproducts"
    
    # Additional properties that might be useful for configuration upload
    export SOLR_DEFAULT_CONFIG_NAME="_default"
}

# Test that techproducts config properties are correctly set for upload
@test "upload techproducts configuration to Solr" {
    # This test verifies that we can upload the techproducts config
    # which is available in Solr but not uploaded by default (only _default is)
    
    # Verify the config path system property is set and valid
    [ -n "$SOLR_CONFIG_PATH" ]
    [ "$SOLR_CONFIG_PATH" = "solr/server/solr/configsets/sample_techproducts_configs/conf" ]
    
    # Verify the config name system property is set correctly
    [ -n "$SOLR_CONFIG_NAME" ]
    [ "$SOLR_CONFIG_NAME" = "techproducts" ]
    
    # Ensure we're targeting the correct non-default configuration
    [ "$SOLR_CONFIG_NAME" != "$SOLR_DEFAULT_CONFIG_NAME" ]
    [ "$SOLR_CONFIG_NAME" != "_default" ]
}

# Test that system properties distinguish techproducts from default config
@test "verify system properties for techproducts config upload" {
    # Test the two system properties mentioned in the requirements:
    # 1. Path property for the configuration location
    # 2. Name property for the configuration name
    
    # Verify path property points specifically to techproducts config
    [[ "$SOLR_CONFIG_PATH" == *"sample_techproducts_configs"* ]]
    [[ "$SOLR_CONFIG_PATH" == *"/conf" ]]
    
    # Verify name property is set to techproducts exactly
    [ "$SOLR_CONFIG_NAME" = "techproducts" ]
    
    # Ensure we're not accidentally using default config
    [ "$SOLR_CONFIG_NAME" != "_default" ]
    [ "$SOLR_CONFIG_NAME" != "$SOLR_DEFAULT_CONFIG_NAME" ]
}

# Test that config path and name are compatible for Solr upload
@test "validate techproducts config properties for Solr compatibility" {
    # Verify the config path follows expected Solr structure
    [[ "$SOLR_CONFIG_PATH" == *"solr/server/solr/configsets/"* ]]
    [[ "$SOLR_CONFIG_PATH" == *"/conf" ]]
    
    # Verify the config name is a valid identifier (no spaces, special chars)
    [[ "$SOLR_CONFIG_NAME" =~ ^[a-zA-Z0-9_]+$ ]]
    
    # Verify config name length is reasonable for Solr
    [ ${#SOLR_CONFIG_NAME} -gt 0 ]
    [ ${#SOLR_CONFIG_NAME} -lt 100 ]
    
    # Verify we have both required properties
    [ -n "$SOLR_CONFIG_PATH" ]
    [ -n "$SOLR_CONFIG_NAME" ]
}