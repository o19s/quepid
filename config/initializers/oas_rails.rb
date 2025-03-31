# config/initializers/oas_rails.rb
OasRails.configure do |config|
  # Basic Information about the API
  config.info.title = 'Quepid'
  config.info.version = Rails.application.config.quepid_version
  config.info.summary = 'The API for interacting with Quepid'
  config.info.description = <<~HEREDOC
    # Welcome to Quepid

    
    ## Getting Started

    You've successfully completed the first step, looking up the API Documentation.
    
    ## Using the APIs
    
    Read the [How to Create a Personal Access Token for API Access](https://quepid-docs.dev.o19s.com/2/quepid/28/how-to-create-a-personal-access-token-for-api-access) documentation first.
    
    Then come back here with your token and click `HTTP Bearer` to set up your token.  This will also make the `curl` examples work for you.

    ## I Want to Help Quepid

    We need more detailed/richer documentation for Quepid's APIs, and that is a great place to contribute.  

    Visit the [Quepid GitHub repository](https://github.com/o19s/quepid) to create PR's to enhance these docs.
  HEREDOC
  config.info.contact.name = 'Eric Pugh'
  config.info.contact.email = 'epugh@opensourceconnections.com'
  config.info.contact.url = 'https://opensourceconnections.com'
  
  config.info.license.name = 'Apache 2.0'
  config.info.license.url = 'https://opensource.org/licenses/Apache-2.0'

  # Servers Information. For more details follow: https://spec.openapis.org/oas/latest.html#server-object
  config.servers = [{ url: 'http://localhost:3000', description: 'Local' }]

  # Tag Information. For more details follow: https://spec.openapis.org/oas/latest.html#tag-object
  config.tags = [{ name: "Users", description: "Manage the `amazing` Users table." }]

  # Optional Settings (Uncomment to use)

  # Extract default tags of operations from namespace or controller. Can be set to :namespace or :controller
  # config.default_tags_from = :namespace

  # Automatically detect request bodies for create/update methods
  # Default: true
  # config.autodiscover_request_body = false

  # Automatically detect responses from controller renders
  # Default: true
  # config.autodiscover_responses = false

  # API path configuration if your API is under a different namespace
  # config.api_path = "/"

  # Apply your custom layout. Should be the name of your layout file
  # Example: "application" if file named application.html.erb
  # Default: false
  # config.layout = "application"

  # Excluding custom controlers or controlers#action
  # Example: ["projects", "users#new"]
  config.ignored_actions = ["home", "admin/home"]

  # #######################
  # Authentication Settings
  # #######################

  # Whether to authenticate all routes by default
  # Default is true; set to false if you don't want all routes to include secutrity schemas by default
  # config.authenticate_all_routes_by_default = true

  # Default security schema used for authentication
  # Choose a predefined security schema
  # [:api_key_cookie, :api_key_header, :api_key_query, :basic, :bearer, :bearer_jwt, :mutual_tls]
  config.security_schema = :bearer

  # Custom security schemas
  # You can uncomment and modify to use custom security schemas
  # Please follow the documentation: https://spec.openapis.org/oas/latest.html#security-scheme-object
  #
  # config.security_schemas = {
  #  bearer:{
  #   "type": "apiKey",
  #   "name": "api_key",
  #   "in": "header"
  #  }
  # }

  # ###########################
  # Default Responses (Errors)
  # ###########################

  # The default responses errors are setted only if the action allow it.
  # Example, if you add forbidden then it will be added only if the endpoint requires authentication.
  # Example: not_found will be setted to the endpoint only if the operation is a show/update/destroy action.
  config.set_default_responses = false
  # config.possible_default_responses = [:not_found, :unauthorized, :forbidden]
  # config.response_body_of_default = { message: String }
end
