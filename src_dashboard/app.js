// Generated by CoffeeScript 1.6.3
define(['jquery', 'underscore', 'backbone', 'router', 'models/ConfigModel', 'models/AtAGlanceModel', 'views/SidebarView', 'views/ContentView', 'views/HITView', 'models/HITModel', 'collections/HITCollection', 'text!templates/overview.html', 'text!templates/sidebar.html', 'views/RunExptView'], function($, _, Backbone, Router, ConfigModel, AtAGlanceModel, SidebarView, ContentView, HITView, HIT, HITs, OverviewTemplate, SideBarTemplate, RunExptView) {
  return {
    events: {
      'click a': 'pushstateClick',
      'click li': 'pushstateClick'
    },
    pushstateClick: function(event) {
      return event.preventDefault();
    },
    getCredentials: function() {
      var _this = this;
      $('#aws-info-modal').modal('show');
      return $('.save').click(function(event) {
        event.preventDefault();
        _this.save(event);
        return $('#aws-info-modal').modal('hide');
      });
    },
    save: function(event) {
      var configData, inputData, section,
        _this = this;
      event.preventDefault();
      section = $(event.target).data('section');
      inputData = {};
      configData = {};
      $.each($('#myform').serializeArray(), function(i, field) {
        return inputData[field.name] = field.value;
      });
      configData[section] = inputData;
      this.config.save(configData);
      $('li').removeClass('selected');
      $('#overview').addClass('selected');
      return $.when(this.config.fetch(), this.ataglance.fetch().then(function() {
        var hit_view, overview;
        overview = _.template(OverviewTemplate, {
          input: {
            balance: _this.ataglance.get("balance"),
            debug: _this.config.get("Server Parameters").debug === "True" ? "checked" : "",
            using_sandbox: _this.config.get("HIT Configuration").using_sandbox === "True" ? "checked" : ""
          }
        });
        $('#content').html(overview);
        hit_view = new HITView({
          collection: new HITs
        });
        $("#tables").html(hit_view.render().el);
        $('input#debug').on("click", function() {
          return _this.saveDebugState();
        });
        $('li').removeClass('selected');
        $('#overview').addClass('selected');
        return _this.pubsub.trigger("captureUIEvents");
      }));
    },
    pushstateClick: function(event) {
      return event.preventDefault();
    },
    verifyAWSLogin: function() {
      var configPromise,
        _this = this;
      configPromise = this.config.fetch();
      return configPromise.done(function() {
        var inputData, key_id, secret_key;
        key_id = _this.config.get("AWS Access").aws_access_key_id;
        secret_key = _this.config.get("AWS Access").aws_secret_access_key;
        inputData = {};
        inputData["aws_access_key_id"] = key_id;
        inputData["aws_secret_access_key"] = secret_key;
        return $.ajax({
          url: "/verify_aws_login",
          type: "POST",
          dataType: "json",
          contentType: "application/json; charset=utf-8",
          data: JSON.stringify(inputData),
          success: function(response) {
            if (response.aws_accnt === 0) {
              _this.getCredentials();
              return $('#aws-indicator').css("color", "red").attr("class", "icon-lock");
            } else {
              return $('#aws-indicator').css("color", "white").attr("class", "icon-unlock");
            }
          },
          error: function() {
            return console.log("aws verification failed");
          }
        });
      });
    },
    serverParamsSave: function() {
      var configResetPromise;
      this.save();
      configResetPromise = this.config.fetch();
      return configResetPromise.done(function() {
        var domain, url, url_pattern;
        url = this.config.get("HIT Configuration").question_url + '/shutdown';
        url_pattern = /^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i;
        domain = url.match(url_pattern)[0] + this.config.get("Server Parameters").port + '/shutdown';
        return $.ajax({
          url: domain,
          type: "GET",
          data: {
            hash: this.config.get("Server Parameters").hash
          }
        });
      });
    },
    saveDebugState: function() {
      var debug;
      debug = $("input#debug").is(':checked');
      return this.config.save({
        "Server Parameters": {
          debug: debug
        }
      });
    },
    saveSandboxState: function(state) {
      var _this = this;
      return this.config.save({
        "HIT Configuration": {
          using_sandbox: state
        }
      }, {
        complete: function() {
          return _this.loadOverview();
        }
      }, {
        error: function(error) {
          return console.log("error");
        }
      });
    },
    getExperimentStatus: function() {
      return $.ajax({
        url: '/get_hits',
        type: "GET",
        success: function(data) {
          if (data.hits.length > 0) {
            return $('#experiment_status').css({
              "color": "green"
            });
          } else {
            return $('#experiment_status').css({
              "color": "grey"
            });
          }
        }
      });
    },
    launchPsiTurkServer: function() {
      return $.ajax({
        url: '/launch',
        type: "GET"
      });
    },
    stopPsiTurkServer: function() {
      $('#server-off-modal').modal('show');
      return $('#shutdownServerBtn').on("click", function() {
        return $.ajax({
          url: '/shutdown_psiturk',
          type: "GET",
          success: $('#server-off-modal').modal('hide')
        });
      });
    },
    loadHITTable: function() {
      var hit_view;
      hit_view = new HITView({
        collection: new HITs
      });
      return $("#tables").html(hit_view.render().el);
    },
    monitorPsiturkServer: function() {
      var UP;
      UP = 0;
      return $.doTimeout('server_poll', 1000, function() {
        $.ajax({
          url: "/server_status",
          success: function(data) {
            var server;
            server = parseInt(data.state);
            if (server === UP) {
              $('#server_status').css({
                "color": "green"
              });
              $('#server_on').css({
                "color": "grey"
              });
              $('#server_off').css({
                "color": "orange"
              });
              return $('#test').show();
            } else {
              $('#server_status').css({
                "color": "red"
              });
              $('#server_off').css({
                "color": "grey"
              });
              $('#server_on').css({
                "color": "orange"
              });
              return $('#test').hide();
            }
          }
        });
        return true;
      });
    },
    loadAWSData: function() {
      var atAGlancePromise, contentView,
        _this = this;
      this.ataglance = new AtAGlanceModel;
      atAGlancePromise = this.ataglance.fetch();
      atAGlancePromise.done(function() {
        var configPromise;
        _this.config = new ConfigModel;
        configPromise = _this.config.fetch();
        return configPromise.done(function() {
          var sideBarHTML, sidebarView;
          sideBarHTML = _.template(SideBarTemplate);
          $('#sidebar').html(sideBarHTML);
          sidebarView = new SidebarView({
            config: _this.config,
            ataglance: _this.ataglance,
            pubsub: _this.pubsub
          });
          _this.loadHITTable();
          _this.captureUIEvents();
          _this.verifyAWSLogin();
          return _this.loadOverview();
        });
      });
      contentView = new ContentView();
      return contentView.initialize();
    },
    loadOverview: function() {
      var ataglance, config, recaptureUIEvents, saveDebugState,
        _this = this;
      config = new ConfigModel;
      ataglance = new AtAGlanceModel;
      recaptureUIEvents = function() {
        return _this.pubsub.trigger("captureUIEvents");
      };
      saveDebugState = _.bind(this.saveDebugState, this);
      return $.when(config.fetch(), ataglance.fetch().then(function() {
        var hit_view, overview;
        overview = _.template(OverviewTemplate, {
          input: {
            balance: ataglance.get("balance"),
            debug: config.get("Server Parameters").debug === "True" ? "checked" : ""
          }
        });
        $('#content').html(overview);
        hit_view = new HITView({
          collection: new HITs
        });
        $("#tables").html(hit_view.render().el);
        recaptureUIEvents();
        if (config.get("HIT Configuration").using_sandbox === "True") {
          $('#sandbox-on').addClass('active');
          return $('#sandbox-off').removeClass('active');
        } else {
          $('#sandbox-on').removeClass('active');
          return $('#sandbox-off').addClass('active');
        }
      }));
    },
    captureUIEvents: function() {
      var reloadOverview, save, updateExperimentStatus,
        _this = this;
      $('.dropdown-toggle').dropdown();
      $('#sandbox-on').off('click').on('click', function() {
        return _this.saveSandboxState(true);
      });
      $('#sandbox-off').off('click').on('click', function() {
        return _this.saveSandboxState(false);
      });
      $('#test').off('click').on('click', function() {
        return window.open(_this.config.get("HIT Configuration").question_url);
      });
      $("#server_off").off("click").on("click", function() {
        return _this.stopPsiTurkServer();
      });
      $("#server_on").off("click").on("click", function() {
        return _this.launchPsiTurkServer();
      });
      $('.restart').off("click").on("click", function(event) {
        _this.save(event);
        _this.stopPsiTurkServer();
        return _this.launchPsiTurkServer();
      });
      $('#run').off("click").on("click", function() {
        var runExptView;
        runExptView = new RunExptView({
          config: _this.config
        });
        $('#run-expt-modal').modal('show');
        $('.run-expt').on("keyup", function(event) {
          var TURK_FEE_RATE, configData, inputData;
          inputData = {};
          configData = {};
          $.each($('#expt-form').serializeArray(), function(i, field) {
            return inputData[field.name] = field.value;
          });
          TURK_FEE_RATE = 0.10;
          $('#total').html((inputData["reward"] * inputData["max_assignments"] * (1 + TURK_FEE_RATE)).toFixed(2));
          $('#fee').val((inputData["reward"] * inputData["max_assignments"] * TURK_FEE_RATE).toFixed(2));
          configData["HIT Configuration"] = inputData;
          return _this.config.save(configData);
        });
        return $('#run-expt-btn').on("click", function() {
          return $.ajax({
            contentType: "application/json; charset=utf-8",
            url: '/mturk_services',
            type: "POST",
            dataType: 'json',
            data: JSON.stringify({
              mturk_request: "create_hit"
            }),
            complete: function() {
              var hit_view;
              $('#run-expt-modal').modal('hide');
              hit_view = new HITView({
                collection: new HITs
              });
              $("#tables").html(hit_view.render().el);
              return _this.pubsub.trigger("getExperimentStatus");
            },
            error: function(error) {
              console.log(error);
              return $('#expire-modal').modal('hide');
            }
          });
        });
      });
      $('#shutdown-dashboard').off("click").on('click', function() {
        console.log("SHutting down dashboard by calling shutdown_dashboard");
        return $.ajax({
          url: '/shutdown_dashboard',
          type: "GET",
          complete: function() {
            return window.location = "http://nyuccl.github.io/psiTurk/";
          }
        });
      });
      save = _.bind(this.save, this);
      $(document).off("click").on("click", '.save', function() {
        event.preventDefault();
        _this.options.pubsub.trigger("save", event);
        return $(document).off("click").on("click", '.save_data', function(event) {
          event.preventDefault();
          return _this.options.pubsub.trigger("save", event);
        });
      });
      $('input#debug').on("click", function() {
        return _this.saveDebugState();
      });
      $(document).off("click").on("click", '#aws-info-save', function() {
        return _this.verifyAWSLogin();
      });
      $(document).on("click", '#server-parms-save', function() {
        return _this.serverParamsSave();
      });
      updateExperimentStatus = this.pubsub.trigger("getExperimentStatus");
      reloadOverview = this.loadOverview;
      $(document).on("click", '.expire', function() {
        var hitid;
        hitid = $(this).attr('id');
        $('#expire-modal').modal('show');
        return $('#expire-btn').on('click', function() {
          var data,
            _this = this;
          data = JSON.stringify({
            mturk_request: "expire_hit",
            hitid: hitid
          });
          return $.ajax({
            contentType: "application/json; charset=utf-8",
            url: '/mturk_services',
            type: "POST",
            dataType: 'json',
            data: data,
            complete: function() {
              $('#expire-modal').modal('hide');
              return reloadOverview();
            },
            error: function(error) {
              return console.log("failed to expire HIT");
            }
          });
        });
      });
      return $(document).on("click", '.extend', function() {
        var hitid;
        hitid = $(this).attr('id');
        $('#extend-modal').modal('show');
        return $('#extend-btn').on('click', function() {
          var data;
          data = JSON.stringify({
            mturk_request: "extend_hit",
            hitid: hitid,
            assignments_increment: $('#extend-workers').val(),
            expiration_increment: $('#extend-time').val()
          });
          return $.ajax({
            contentType: "application/json; charset=utf-8",
            url: '/mturk_services',
            type: "POST",
            dataType: 'json',
            data: data,
            complete: function() {
              $('#extend-modal').modal('hide');
              return reloadOverview();
            },
            error: function(error) {
              return console.log("failed to extend HIT");
            }
          });
        });
      });
    },
    initialize: function() {
      Router.initialize();
      this.pubsub = _.extend({}, Backbone.Events);
      _.bindAll(this, "getExperimentStatus");
      _.bindAll(this, "captureUIEvents");
      _.bindAll(this, "loadOverview");
      _.bindAll(this, "save");
      this.pubsub.bind("getExperimentStatus", this.getExperimentStatus);
      this.pubsub.bind("captureUIEvents", this.captureUIEvents);
      this.pubsub.bind("loadOverview", this.loadOverview);
      this.pubsub.bind("save", this.save);
      this.monitorPsiturkServer();
      this.loadAWSData();
      return this.getExperimentStatus();
    }
  };
});
