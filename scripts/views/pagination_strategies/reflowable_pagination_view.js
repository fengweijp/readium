
Readium.Views.ReflowablePaginationView = Readium.Views.PaginationViewBase.extend({

	initialize: function() {
		// call the super ctor
		Readium.Views.PaginationViewBase.prototype.initialize.call(this);
		this.page_template = _.template( $('#reflowing-template').html() );

		// if this book does right to left pagination we need to set the
		// offset on the right
		if(this.model.get("page_prog_dir") === "rtl") {
			this.offset_dir = "right";
		}
		else {
			this.offset_dir = "left";
		}

		this.model.on("change:current_page", this.pageChangeHandler, this);
		this.model.on("change:toc_visible", this.windowSizeChangeHandler, this);
		this.model.on("repagination_event", this.windowSizeChangeHandler, this);
		this.model.on("change:current_theme", this.injectTheme, this);
		this.model.on("change:two_up", this.setUpMode, this);
		this.model.on("change:two_up", this.adjustIframeColumns, this);
		this.model.on("change:current_margin", this.marginCallback, this);

	},

	// sometimes these views hang around in memory before
	// the GC's get them. we need to remove all of the handlers
	// that were registered on the model
	destruct: function() {
		
		this.model.off("change:current_page", this.pageChangeHandler);
		this.model.off("change:toc_visible", this.windowSizeChangeHandler);
		this.model.off("repagination_event", this.windowSizeChangeHandler);
		this.model.off("change:current_theme", this.windowSizeChangeHandler);
		this.model.off("change:two_up", this.setUpMode);
		this.model.off("change:two_up", this.adjustIframeColumns);
		this.model.off("change:current_margin", this.marginCallback);

		// call the super destructor
		Readium.Views.PaginationViewBase.prototype.destruct.call(this);
	},

	render: function(goToLastPage) {
		var that = this;
		var json = this.model.getCurrentSection().toJSON();

		// make everything invisible to prevent flicker
		this.setUpMode();
		this.$('#container').html( this.page_template(json) );
		this.setFrameWidth();
		
		this.$('#readium-flowing-content').on("load", function(e) {
			that.adjustIframeColumns();
			that.iframeLoadCallback(e);
			that.setFontSize();
			that.injectTheme();
			that.setNumPages();

			if(goToLastPage) {
				that.model.goToLastPage();
			}
			else {
				that.model.goToPage(1);
			}		
		});
		return this;
	},

	adjustIframeColumns: function() {
		var prop_dir = this.offset_dir;
		var $frame = this.$('#readium-flowing-content');
		this.frame_width = parseInt($frame.width(), 10);
		this.frame_height = parseInt($frame.height(), 10);
		this.gap_width = Math.floor(this.frame_width / 7);
		if(this.model.get("two_up")) {
			this.page_width = Math.floor((this.frame_width - this.gap_width) / 2);
		}
		else {
			this.page_width = this.frame_width;
		}
		

		// it is important for us to make sure there is no padding or
		// margin on the <html> elem, or it will mess with our column code
		$(this.getBody()).css({
			"-webkit-column-axis": "horizontal",
			"-webkit-column-gap": this.gap_width.toString() + "px",
			"padding": "0px",
			"margin": "0px",
			"position": "absolute",
			"-webkit-column-width": this.page_width.toString() + "px",
			"width": this.page_width.toString() + "px",
			"height": this.frame_height.toString() + "px"
		});

		this.setNumPages();
		var page = this.model.get("current_page")[0] || 1;
		this.goToPage(page);
	},

	// helper method to get the a reference to the documentElement
	// of the document in this strategy's iFrame.
	// TODO this is a bad name for this function
	getBody: function() {
		return this.$('#readium-flowing-content').contents()[0].documentElement;
	},

	hideContent: function() {
		$("#flowing-wrapper").css("opacity", "0");
	},

	showContent: function() {
		$("#flowing-wrapper").css("opacity", "1");
	},

	calcPageOffset: function(page_num) {
		return (page_num - 1) * (this.page_width + this.gap_width);
	},

	setFrameWidth: function() {
		var width;
		var margin = this.model.get("current_margin");
		if (margin === 1) {
			this.model.get("two_up") ? (width = "90%") : (width = "80%");
		}
		else if (margin === 2) {
			this.model.get("two_up") ? (width = "80%") : (width = "70%");
		}
		else if (margin === 3) {
			this.model.get("two_up") ? (width = "70%") : (width = "60%");	
		}
		else if (margin === 4) {
			this.model.get("two_up") ? (width = "60%") : (width = "50%");	
		}
		else {
			this.model.get("two_up") ? (width = "50%") : (width = "40%");	
		}
		
		this.$('#readium-flowing-content').attr("width", width);
	},

	// calculate the number of pages in the current section,
	// based on section length : page size ratio
	calcNumPages: function() {

		var body, offset, width, num;
		
		// get a reference to the dom body
		body = this.getBody();

		// cache the current offset 
		offset = body.style[this.offset_dir];

		// set the offset to 0 so that all overflow is part of
		// the scroll width
		body.style[this.offset_dir] = "0px";

		// grab the scrollwidth => total content width
		width = this.getBody().scrollWidth;

		// reset the offset to its original value
		body.style[this.offset_dir] = offset;

		// perform calculation and return result...
		num = Math.floor( (width + this.gap_width) / (this.gap_width + this.page_width) );

		// in two up mode, always set to an even number of pages
		if( num % 2 === 0 && this.model.get("two_up")) {
			//num += 1;
		}
		return num;
	},

	pageChangeHandler: function() {
		var that = this;
		this.hideContent();
		setTimeout(function() {
			that.goToPage(that.model.get("current_page")[0]);
		}, 150);
	},

	goToPage: function(page) {
		var offset = this.calcPageOffset(page).toString() + "px";
		$(this.getBody()).css(this.offset_dir, "-" + offset);
		this.showContent();
	},

	goToHashFragment: function() {
		var fragment = this.model.get("hash_fragment");
		if(fragment) {
			var el = $("#" + fragment, this.getBody())[0];

			// we get more precise results if we look at the first children
			while(el.children.length > 0) {
				el = el.children[0];
			}

			var page = this.getElemPageNumber(el);
			this.model.goToPage(page);
		}
		// else false alarm no work to do
	},

	getElemPageNumber: function(elem) {
		var shift = elem.getClientRects()[0][this.offset_dir];
		// less the amount we already shifted to get to cp
		shift -= parseInt(this.getBody().style[this.offset_dir], 10); 
		return Math.ceil( shift / (this.page_width + this.gap_width) );
	},

	windowSizeChangeHandler: function() {
		this.adjustIframeColumns();
	},

	setFontSize: function() {
		var size = this.model.get("font_size") / 10;
		$(this.getBody()).css("font-size", size + "em");

		// the content size has changed so recalc the number of 
		// pages
		this.setNumPages();
	},

	marginCallback: function() {
		this.setFrameWidth();
		this.adjustIframeColumns();
	},

	// sadly this is just a reprint of what is already in the
	// themes stylesheet. It isn't very DRY but the implementation is
	// cleaner this way
	themes: {
		"default-theme": {
			"background-color": "white",
			"color": "black"
		},

		"vancouver-theme": {
			"background-color": "#DDD",
			"color": "#576b96"
		},

		"ballard-theme": {
			"background-color": "#576b96",
			"color": "#DDD"
		},

		"parchment-theme": {
			"background-color": "#f7f1cf",
			"color": "#774c27"
		},

		"night-theme": {
			"background-color": "black",
			"color": "white"
		}
	},

	injectTheme: function() {
		var theme = this.model.get("current_theme");
		if(theme === "default") theme = "default-theme";
		$(this.getBody()).css({
			"color": this.themes[theme]["color"],
			"background-color": this.themes[theme]["background-color"],
		});
	},

	setNumPages: function() {
		var num = this.calcNumPages();
		console.log('num pages is: ' + num);
		this.model.set("num_pages", num);
	}



});