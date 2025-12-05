// Entry point for the Quepid Angular application code
// This imports all the application-specific modules, controllers, services, etc.

// Import vendor bundle first (this sets up global objects like angular, jQuery, etc.)
// This will be loaded separately

// Import the utilities module
import '../assets/javascripts/utilitiesModule.js';

// Import the main app module
import '../assets/javascripts/app.js';

// Import routes
import '../assets/javascripts/routes.js';

// Import all components
const componentsContext = require.context('../assets/javascripts/components', true, /\.js$/);
componentsContext.keys().forEach(componentsContext);

// Import all controllers
const controllersContext = require.context('../assets/javascripts/controllers', true, /\.js$/);
controllersContext.keys().forEach(controllersContext);

// Import all directives
const directivesContext = require.context('../assets/javascripts/directives', true, /\.js$/);
directivesContext.keys().forEach(directivesContext);

// Import all factories
const factoriesContext = require.context('../assets/javascripts/factories', true, /\.js$/);
factoriesContext.keys().forEach(factoriesContext);

// Import all filters
const filtersContext = require.context('../assets/javascripts/filters', true, /\.js$/);
filtersContext.keys().forEach(filtersContext);

// Import all interceptors
const interceptorsContext = require.context('../assets/javascripts/interceptors', true, /\.js$/);
interceptorsContext.keys().forEach(interceptorsContext);

// Import all services
const servicesContext = require.context('../assets/javascripts/services', true, /\.js$/);
servicesContext.keys().forEach(servicesContext);

// Import all values
const valuesContext = require.context('../assets/javascripts/values', true, /\.js$/);
valuesContext.keys().forEach(valuesContext);

// Import footer
import '../assets/javascripts/footer.js';

// Import tour
import '../assets/javascripts/tour.js';

// Import ace config
import '../assets/javascripts/ace_config.js';