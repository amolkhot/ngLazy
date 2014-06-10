(function(angular){
  'use strict';

  angular.module('ngLazy',[
    'ngLazy.factories',
    'ngLazy.directives'
  ]);

})(angular);


'use strict';

angular.module('ngLazy.directives',[])
.directive('lazyLoad', ['$injector','$window','$document','$timeout','$rootScope',function($injector, $window, $document, $timeout, $rootScope){

  var appendAnimations = function(){
    var style       = document.createElement('style');
    var keyframes   = '@-webkit-keyframes spin {\n' +
                      '\t0%{-webkit-transform: rotate(0deg);}\n' +
                      '\t100%{-webkit-transform: rotate(360deg);}\n' +
                      '}\n' +
                      '@keyframes spin{\n' +
                      '\t0%{transform: rotate(0deg);}\n' +
                      '\t100%{transform: rotate(360deg);}\n' +
                      '}';

    style.innerHTML = keyframes;
    document.head.appendChild(style);
  };

  var makeSpinner = function(el, color){
    el.css({
      WebkitBoxSizing: 'border-box',
      boxSizing: 'border-box',
      display: 'block',
      width: '43px',
      height: '43px',
      margin: '20px auto',
      borderWidth: '8px',
      borderStyle: 'solid',
      borderColor: color,
      borderRadius: '22px',
      animation: 'spin 0.8s linear infinite',
      WebkitAnimation: 'spin 0.8s linear infinite'
    });
    return el;
  };

  return {
    restrict: 'E',
    scope: {
      lazyData              : '=',
      lazyDataCollectionKey : '@',
      lazyDataService       : '@', 
      lazyFetchMethod       : '@',
      lazyRange             : '@',
      lazyDataKeys          : '=',
      lazyStartDelay        : '@',
      lazyAppendDelay       : '@',
      lazySpinnerColor      : '@'
    },
    transclude: true,
    template: '<div ng-transclude></div>' +
              '<div class=\'col-md-12 loading\' ng-hide=\'spinner.hide\'>' +
                '<div class=\'loading-widget\'></div>' +
              '</div>'+
              '<div id=\'lazy-bottom\'></div>',
    link: function(scope) {
            
            function getThreshold(total, item){
              return total - (item * 3);
            }

            function getScrollHeight(){
              return win.document.body.scrollHeight;
            }

            var winEl             = angular.element($window),
                win               = winEl[0],
                lazyBottom        = angular.element(document.querySelector('#lazy-bottom'))[0],
                scrollHeight      = getScrollHeight(),
                itemHeight        = scrollHeight - lazyBottom.offsetTop,
                threshold         = getThreshold(scrollHeight, itemHeight),
                lazyLoader        = $injector.get('lazyLoader'),
                dataService       = $injector.get(scope.lazyDataService),
                loadingWidget     = angular.element(document.querySelector('.loading-widget')),
                hasRun            = false,
                loading           = false;

            appendAnimations();
            loadingWidget         = makeSpinner(loadingWidget, 'transparent ' + scope.lazySpinnerColor + ' ' + scope.lazySpinnerColor + ' ' + scope.lazySpinnerColor || 'transparent rgb(85, 148, 250) rgb(85, 148, 250) rgb(85, 148, 250)');
            scope.spinner         = { hide : false };
            
            var lazyLoad = function(){
              lazyLoader.configure({
                data            : scope.lazyData,
                collectionKey   : scope.lazyDataCollectionKey,
                fetchData       : dataService[scope.lazyFetchMethod],
                range           : scope.lazyRange,
                dataKeys        : scope.lazyDataKeys,
                startDelay      : scope.lazyStartDelay,
                appendDelay     : scope.lazyAppendDelay,
                spinnerColor    : scope.spinnerColor
              });

              scope.$watch('spinnerColor', function(){
                angular.element(loadingWidget.css({
                  borderColor : 'transparent ' + scope.lazySpinnerColor + ' ' + scope.lazySpinnerColor + ' ' + scope.lazySpinnerColor || 'transparent rgb(85, 148, 250) rgb(85, 148, 250) rgb(85, 148, 250)'
                }));
              });

              lazyLoader.load().then(function(data){
                if(!hasRun){
                  angular.forEach(Object.keys(data), function(key){
                    scope.lazyData[key] = data[key];
                  });
                } else {
                  scope.lazyData[scope.lazyDataCollectionKey] = data[scope.lazyDataCollectionKey];
                }
                loading = false;
              });
            };

            $rootScope.$on('hideLoading', function(){ scope.spinner.hide = true; });
            $rootScope.$on('showLoading', function(){ scope.spinner.hide = false; });

            winEl.bind('scroll', function(){
              if (!loading && win.scrollY >= threshold) {
                loading = true;
                win.requestAnimationFrame(function(){
                  scope.$apply(function(){ 
                    lazyLoad();
                    threshold = getThreshold(getScrollHeight(), itemHeight);
                  });
                });
              }
            });
            lazyLoad();
          }
        };
}]);
'use strict';

angular.module('ngLazy.factories',[])  
.factory('lazyLoader', ['$timeout','$rootScope', '$q', function($timeout, $rootScope, $q){
  var cache = { data : {} },
      config,
      data,
      collectionKey,
      fetch,
      responseKeys,
      range,
      appendDelay,
      startDelay;

  return ({

    configure:  function(options){
                  config = options;
    },  

    getData : function(){
                data          = config.data;
                collectionKey = config.collectionKey;
                fetch         = config.fetchData;
                responseKeys  = config.dataKeys;
                range         = config.range;
                appendDelay   = config.appendDelay;
                startDelay    = config.startDelay;
                
                var deferred  = $q.defer();

                $rootScope.$broadcast('showLoading');

                if (!cache.data[collectionKey]) {
                  fetch().then(function(res){
                    angular.forEach(responseKeys, function(key){
                      cache.data[key] = res.data[key];
                      if (key === collectionKey) {
                        data[key]       = [];
                        data[key] = data[key].concat(cache.data[key].splice(0, range));
                      } else {
                        data[key] = cache.data[key]; 
                      }
                    });
                    deferred.resolve(data);
                    $rootScope.$broadcast('hideLoading');
                  });
                } else {
                  $timeout(function(){ 
                    data[collectionKey] = data[collectionKey].concat(cache.data[collectionKey].splice(0, range));
                    deferred.resolve(data);
                    $rootScope.$broadcast('hideLoading');
                  }, appendDelay);
                }
                return deferred.promise;
    },

    load :  function(){
              var deferred = $q.defer();
              var _this = this;

              $rootScope.$broadcast('showLoading');
              
              var loadTimer = $timeout(function(){ 
                _this.getData().then(function(col){
                  deferred.resolve(col);
                });
              }, startDelay);
              
              loadTimer.then(function(){ 
                $timeout.cancel(loadTimer);
              });

              return deferred.promise;
    }
  });
}]);