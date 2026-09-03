'use strict';

angular.module('QuepidApp')
  // AngularJS will instantiate a singleton by calling "new" on this function
  .service('mapperBasedSearchEngineSvc', [
    '$http',
    function mapperBasedSearchEngineSvc($http) {
      this.engines = [];

      // The API is snake_cased like the rest of Quepid's API; map to camelCase here (same
      // convention as TryFactory.js) since the result is merged straight into settingsSvc's
      // defaultSettings and read camelCase everywhere downstream (wizardModal.js, etc).
      function mapEngine(data) {
        return {
          id:                    data.id,
          name:                  data.name,
          logo:                  data.logo,
          searchEngine:          data.search_engine,
          apiMethod:             data.api_method,
          proxyRequests:         data.proxy_requests,
          supportsBasicAuth:     data.supports_basic_auth,
          supportsPagination:    data.supports_pagination,
          paginationHitsParam:   data.pagination_hits_param,
          paginationOffsetParam: data.pagination_offset_param,
          searchUrl:             data.search_url,
          urlFormat:             data.url_format,
          queryParams:           data.query_params,
          mapperCode:            data.mapper_code,
          customHeaders:         data.custom_headers,
          headerType:            data.header_type,
          fieldSpec:             data.field_spec,
          idField:               data.id_field,
          titleField:            data.title_field,
          testQuery:             data.test_query,
          additionalFields:      data.additional_fields
        };
      }

      this.list = function() {
        var self = this;

        return $http.get('api/mapper_based_search_engines')
          .then(function(response) {
            self.engines = response.data.mapper_based_search_engines.map(mapEngine);
          });
      };
    }
  ]);
