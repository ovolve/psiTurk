#  Filename: app.coffee
define [
      'jquery'
      'underscore'
      'backbone'
      'router'
      'models/ConfigModel'
      'models/AtAGlanceModel'
      'views/SidebarView'
      'views/ContentView'
      'views/HITView'
      'models/HITModel'
      'collections/HITCollection'
      'text!templates/overview.html'
      'text!templates/sidebar.html'
      'views/RunExptView'
    ],
    (
      $
      _
      Backbone
      Router
      ConfigModel
      AtAGlanceModel
      SidebarView
      ContentView
      HITView
      HIT
      HITs
      OverviewTemplate
      SideBarTemplate
      RunExptView
    ) ->

      # Prevent links from reloading the page (single page app)
      events:
        'click a' : 'pushstateClick'
        'click li' : 'pushstateClick'


      pushstateClick: (event) ->
        event.preventDefault()


      # Ask user for AWS login
      getCredentials: ->
        $('#aws-info-modal').modal('show')
        $('.save').click (event) =>
          event.preventDefault()
          @save(event)
          $('#aws-info-modal').modal('hide')

      save: (event) ->
        # Prevent clicks from reloading page
        event.preventDefault()
        section = $(event.target).data 'section'
        inputData = {}
        configData = {}
        $.each($('#myform').serializeArray(), (i, field) ->
          inputData[field.name] = field.value)
        configData[section] = inputData
        @config.save configData

        # Load overview and change sidebar link
        $('li').removeClass 'selected'
        $('#overview').addClass 'selected'
        $.when @config.fetch(), @ataglance.fetch()
          .then(=>
            overview = _.template(OverviewTemplate,
              input:
                balance: @ataglance.get("balance")
                debug: if @config.get("Server Parameters").debug is "True" then "checked" else ""
                using_sandbox: if @config.get("HIT Configuration").using_sandbox is "True" then "checked" else "")
            $('#content').html(overview)
            # Load HIT table
            hit_view = new HITView collection: new HITs
            $("#tables").html hit_view.render().el
            $('input#debug').on "click",  =>
              @saveDebugState()
            $('li').removeClass 'selected'
            $('#overview').addClass 'selected'
            @pubsub.trigger "captureUIEvents"
           )


      pushstateClick: (event) ->
        event.preventDefault()


      # Verify user supplied credentials on via AWS API
      verifyAWSLogin: ->
        configPromise = @config.fetch()
        configPromise.done(=>
          key_id = @config.get("AWS Access").aws_access_key_id
          secret_key = @config.get("AWS Access").aws_secret_access_key
          inputData = {}
          inputData["aws_access_key_id"] = key_id
          inputData["aws_secret_access_key"] = secret_key
          $.ajax
            url: "/verify_aws_login"
            type: "POST"
            dataType: "json"
            contentType: "application/json; charset=utf-8"
            data: JSON.stringify inputData
            success: (response) =>
              if response.aws_accnt is 0
                @getCredentials()
                $('#aws-indicator').css("color", "red")
                  .attr("class", "icon-lock")
              else
                $('#aws-indicator').css("color", "white")
                  .attr("class", "icon-unlock")

            error: ->
              console.log("aws verification failed"))


      serverParamsSave: ->
        @save()
        # Update server on save
        configResetPromise = @config.fetch()
        configResetPromise.done(->
          url = @config.get("HIT Configuration").question_url + '/shutdown'
          url_pattern =  /^https?\:\/\/([^\/:?#]+)(?:[\/:?#]|$)/i
          domain = url.match(url_pattern)[0] + @config.get("Server Parameters").port + '/shutdown'
          $.ajax
            url: domain
            type: "GET"
            data: {hash: @config.get("Server Parameters").hash})


      saveDebugState: ->
        debug = $("input#debug").is(':checked')
        @config.save
          "Server Parameters":
            debug: debug


      saveSandboxState: (state) ->
        @config.save(
          "HIT Configuration":
            using_sandbox: state,
          {
            complete: =>
              @loadOverview()
          }, {
            error: (error) => console.log "error"
          })


      getExperimentStatus: ->
        $.ajax
          url: '/get_hits'
          type: "GET"
          success: (data) ->
            if data.hits.length > 0
              $('#experiment_status').css "color": "green"
            else
              $('#experiment_status').css "color": "grey"


      launchPsiTurkServer: ->
        $.ajax
          url: '/launch'
          type: "GET"


      stopPsiTurkServer: ->
        $('#server-off-modal').modal('show')
        $('#shutdownServerBtn').on "click", ->
          # $('#server_status').css "color": "yellow"
          $.ajax
            url: '/shutdown_psiturk'
            type: "GET"
            success: $('#server-off-modal').modal('hide')


      loadHITTable: ->
        # Load and initialize HIT table
        hit_view = new HITView collection: new HITs
        $("#tables").html hit_view.render().el


      monitorPsiturkServer: ->
      # Use long poll to sync dashboard w/ server.
      # Socket.io is a much better choice, but requires gevent, and thus gcc.
        UP = 0
        $.doTimeout 'server_poll', 1000, ->
          $.ajax
            url: "/server_status"
            success: (data) ->
             server = parseInt(data.state)
             if server is UP
               $('#server_status').css "color": "green"
               $('#server_on')
                 .css "color": "grey"
               $('#server_off').css "color": "orange"
               $('#test').show()
             else
               $('#server_status').css({"color": "red"})
               $('#server_off')
                 .css "color": "grey"
               $('#server_on').css "color": "orange"
               $('#test').hide()
          return true


      loadAWSData: ->
        # Load at-a-glance model and data
        @ataglance = new AtAGlanceModel
        atAGlancePromise = @ataglance.fetch()
        atAGlancePromise.done(=>
          @config = new ConfigModel
          configPromise = @config.fetch()
          configPromise.done(=>
            sideBarHTML = _.template(SideBarTemplate)
            $('#sidebar').html(sideBarHTML)
            sidebarView = new SidebarView
              config: @config
              ataglance: @ataglance
              pubsub: @pubsub
            @loadHITTable()
            @captureUIEvents()
            @verifyAWSLogin()
            @loadOverview()
          )
        )
        # Load content view after html; req's html ids to be present
        contentView = new ContentView()
        contentView.initialize()


      loadOverview: ->
        config = new ConfigModel
        ataglance = new AtAGlanceModel
        recaptureUIEvents = => @pubsub.trigger "captureUIEvents"
        saveDebugState = _.bind(@saveDebugState, @)
        $.when config.fetch(), ataglance.fetch()
          .then(=>
            overview = _.template(OverviewTemplate,
              input:
                balance: ataglance.get("balance")
                debug: if config.get("Server Parameters").debug is "True" then "checked" else ""
            )
            $('#content').html(overview)
            # Refresh HIT table
            hit_view = new HITView collection: new HITs
            $("#tables").html hit_view.render().el
            recaptureUIEvents()
            # Sandbox tabs
            if config.get("HIT Configuration").using_sandbox is "True"
              $('#sandbox-on').addClass('active')
              $('#sandbox-off').removeClass('active')
            else
              $('#sandbox-on').removeClass('active')
              $('#sandbox-off').addClass('active')
          )


      captureUIEvents: ->
        # Load general dropdown actions
        $('.dropdown-toggle').dropdown()

        # Capture sandbox tab clicks
        $('#sandbox-on').off('click').on 'click', =>
          @saveSandboxState(true)
        $('#sandbox-off').off('click').on 'click', =>
          @saveSandboxState(false)

        # Launch test window
        $('#test').off('click').on 'click', =>
          window.open @config.get("HIT Configuration").question_url

        # Shutdown psiTurk server
        $("#server_off").off("click").on "click", =>
          @stopPsiTurkServer()

        # Launch psiTurk server
        $("#server_on").off("click").on "click", =>
          @launchPsiTurkServer()

        # Save config & restart server
        $('.restart').off("click").on "click", (event) =>
          @save(event)
          @stopPsiTurkServer()
          @launchPsiTurkServer()

        $('#run').off("click").on "click", =>
          runExptView = new RunExptView config: @config
          $('#run-expt-modal').modal('show')

          $('.run-expt').on "keyup", (event) =>
            inputData = {}
            configData = {}
            $.each($('#expt-form').serializeArray(), (i, field) ->
              inputData[field.name] = field.value)
            # Update dollar amounts in GUI
            # Fee is currently set to 10%, but it'd be nice if there was a way to dynamically set this according to AMZ's rates
            TURK_FEE_RATE = 0.10
            $('#total').html (inputData["reward"]*inputData["max_assignments"]*(1 + TURK_FEE_RATE)).toFixed(2)
            $('#fee').val (inputData["reward"]*inputData["max_assignments"]*TURK_FEE_RATE).toFixed(2)

            configData["HIT Configuration"] = inputData
            @config.save configData

          $('#run-expt-btn').on "click", =>
            $.ajax
              contentType: "application/json; charset=utf-8"
              url: '/mturk_services'
              type: "POST"
              dataType: 'json'
              data: JSON.stringify mturk_request : "create_hit"
              complete: =>
                # update HIT table
                $('#run-expt-modal').modal('hide')
                hit_view = new HITView collection: new HITs
                $("#tables").html hit_view.render().el
                @pubsub.trigger "getExperimentStatus"
              error: (error) ->
                console.log(error)
                $('#expire-modal').modal('hide')


        $('#shutdown-dashboard').off("click").on 'click', =>
          console.log "SHutting down dashboard by calling shutdown_dashboard"
          $.ajax
            url: '/shutdown_dashboard'
            type: "GET"
            complete: ->
              window.location = "http://nyuccl.github.io/psiTurk/"

        save = _.bind(@save, @)
        $(document).off("click").on "click", '.save', =>
          event.preventDefault()
          @options.pubsub.trigger "save", event
          $(document).off("click").on "click", '.save_data', (event) =>
            event.preventDefault()
            @options.pubsub.trigger "save", event
        $('input#debug').on "click",  =>
          @saveDebugState()
        $(document).off("click").on "click", '#aws-info-save', =>
          @verifyAWSLogin()
        $(document).on "click", '#server-parms-save', =>
          @serverParamsSave()


        # Bind table buttons
        # ------------------

        # Bind functions to current namespace before "this" gets lost in callbacks
        updateExperimentStatus = @pubsub.trigger "getExperimentStatus"
        reloadOverview = @loadOverview

        # Expire HIT UI event
        $(document).on "click", '.expire', ->
          hitid = $(@).attr('id')
          $('#expire-modal').modal('show')
          $('#expire-btn').on 'click', ->
            data = JSON.stringify
              mturk_request: "expire_hit"
              hitid: hitid
            $.ajax
              contentType: "application/json; charset=utf-8"
              url: '/mturk_services'
              type: "POST"
              dataType: 'json'
              data: data
              complete: =>
                $('#expire-modal').modal('hide')
                reloadOverview()
              error: (error) ->
                console.log("failed to expire HIT")

        # Extend HIT UI event
        $(document).on "click", '.extend', ->
          hitid = $(@).attr('id')
          $('#extend-modal').modal('show')
          $('#extend-btn').on 'click', ->
            data = JSON.stringify
              mturk_request: "extend_hit"
              hitid: hitid
              assignments_increment: $('#extend-workers').val()
              expiration_increment: $('#extend-time').val()
            $.ajax
              contentType: "application/json; charset=utf-8"
              url: '/mturk_services'
              type: "POST"
              dataType: 'json'
              data: data
              complete: ->
                $('#extend-modal').modal('hide')
                reloadOverview()
              error: (error) ->
                console.log("failed to extend HIT")

      initialize: ->

        Router.initialize()


        # Inter-view communication
        # =======================
        @pubsub = _.extend {}, Backbone.Events  # enables communication between views
        _.bindAll(@, "getExperimentStatus")
        _.bindAll(@, "captureUIEvents")
        _.bindAll(@, "loadOverview")
        _.bindAll(@, "save")
        @pubsub.bind "getExperimentStatus", @getExperimentStatus  # Subscribe to getExperimentStatus events
        @pubsub.bind "captureUIEvents", @captureUIEvents  # Subscribe to captureUIEvents
        @pubsub.bind "loadOverview", @loadOverview  # Subscribe to loadOverview
        @pubsub.bind "save", @save  # Subscribe to save


        # Server & API stuff
        # ==================
        @monitorPsiturkServer()
        @loadAWSData()
        @getExperimentStatus()
