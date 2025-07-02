// This is a manifest file that serves as the entry point for all Stimulus controllers
// Import the application
import { application } from "./controllers/application"

// Import and register controllers
import PromptFormController from "./controllers/prompt_form_controller"
application.register("prompt-form", PromptFormController)

// This file allows us to import all controllers with a single import:
// import "controllers" in application2.js