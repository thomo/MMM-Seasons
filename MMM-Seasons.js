/* Magic Mirror
 * Module: MMM-Seasons
 *
 * Based on MMM-Snow by Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Comment on terminology: a 'flake' is any moving item being shown on the mirror, while
 * the specific themed items are called 'snow', 'leaf' etc. This applies to variable names
 * and css class names.
 */

Module.register("MMM-Seasons", {

	defaults: {
		flakeCount: 100,
		season: "auto",                 // "auto" follows the calendar, or force one of: spring, summer, fall, winter
		seasonMode: "meteorological",   // "meteorological" (1st of Mar/Jun/Sep/Dec) or "astronomical" (equinoxes / solstices)
		hemisphere: "north",            // "north" or "south", the south swaps the seasons
		updateInterval: 60 * 60 * 1000, // how often to check for a season change (ms)
		seasons: {}                     // per season overrides of the themes below
	},

	themes: {
		"spring" : {
			"imagePrefix"  : "images/spring/spring", // images are <imagePrefix><n><imageExtension>, e.g. images/spring/spring1.png
			"imageExtension": ".png",
			"imagesCount"  : 4,         // number of images available in this theme, here: spring1 ... spring4
			"images"       : null,      // optional explicit list of image files, overrides prefix / count
			"downwards"    : true,      // direction of flake movements, blossoms fall downwards
			"sizeFactor"   : 1.5},      // adapt size of flakes to your liking
		"summer" : {
			"imagePrefix"  : "images/summer/summer",
			"imageExtension": ".png",
			"imagesCount"  : 4,
			"images"       : null,
			"downwards"    : false,     // sun motes raise upwards
			"sizeFactor"   : 1.5},
		"fall"   : {
			"imagePrefix"  : "images/fall/fall",
			"imageExtension": ".png",
			"imagesCount"  : 4,
			"images"       : null,
			"downwards"    : true,      // leaves fall downwards
			"sizeFactor"   : 1.5},
		"winter" : {
			"imagePrefix"  : "images/winter/winter",
			"imageExtension": ".png",
			"imagesCount"  : 3,
			"images"       : null,
			"downwards"    : true,      // snow goes downwards
			"sizeFactor"   : 1}         // use original flake size
	},

	getStyles: function() {
		return [ "MMM-Seasons.css" ];
	},

	start: function() {
		var self = this;
		this.currentSeason = this.getSeason(new Date());
		setInterval(function() {
			var season = self.getSeason(new Date());
			if (season !== self.currentSeason) {
				Log.info(self.name + ": season changed from " + self.currentSeason + " to " + season);
				self.currentSeason = season;
				self.updateDom();
			}
		}, this.config.updateInterval);
	},

	getSeason: function(date) {
		var seasons = ["winter", "spring", "summer", "fall"];
		if (seasons.indexOf(this.config.season) !== -1) {
			return this.config.season;
		}

		var month = date.getMonth(); // 0 = January
		var index;
		if (this.config.seasonMode === "astronomical") {
			// approximate start days of spring, summer, fall and winter
			var starts = [[2, 20], [5, 21], [8, 22], [11, 21]];
			index = 0; // winter until the spring equinox
			for (var i = 0; i < starts.length; i++) {
				if (month > starts[i][0] || (month === starts[i][0] && date.getDate() >= starts[i][1])) {
					index = (i + 1) % 4;
				}
			}
		} else {
			index = Math.floor(((month + 1) % 12) / 3);
		}

		if (this.config.hemisphere === "south") {
			index = (index + 2) % 4;
		}
		return seasons[index];
	},

	getThemeSettings: function(season) {
		var settings = Object.assign({}, this.themes[season], this.config.seasons[season] || {});
		var images = settings.images;
		if (!Array.isArray(images)) {
			images = [];
			for (var i = 1; i <= settings.imagesCount; i++) {
				images.push(settings.imagePrefix + i + settings.imageExtension);
			}
		}
		var self = this;
		// relative paths are resolved against the module folder, absolute paths and urls are used as they are
		settings.imageUrls = images.map(function(image) {
			return /^(\/|[a-z]+:)/i.test(image) ? image : self.file(image);
		});
		return settings;
	},

	getDom: function() {
		var themeSettings = this.getThemeSettings(this.currentSeason);
		var wrapper = document.createElement("div");
		wrapper.className = "wrapper " + this.currentSeason;

		if (themeSettings.imageUrls.length === 0) {
			return wrapper;
		}

		var flake, flakeImage, jiggle, size;

		for(var i = 0; i < this.config.flakeCount; i++) {

			size = themeSettings.sizeFactor * (Math.random() * 0.75) + 0.25;
			flakeImage = document.createElement("div");

			var imageUrl = themeSettings.imageUrls[Math.floor(Math.random() * themeSettings.imageUrls.length)];
			flakeImage.className = "flake-image";
			flakeImage.style.backgroundImage = "url('" + imageUrl + "')";
			flakeImage.style.transform = "scale(" + size +", " + size + ")";
			flakeImage.style.opacity = size;

			flake = document.createElement("div");
			if(themeSettings.downwards) {
				flake.className = "flake-downwards";
			}
			else {
				flake.className = "flake-upwards";
			}

			jiggle = document.createElement("div");
			jiggle.style.animationDelay = (Math.random() * 4) + "s";
			jiggle.style.animationDuration = ((Math.random() * 30) + 30) + "s";
			jiggle.appendChild(flakeImage);

			size = (Math.random() * 0.75) + 0.25;
			jiggle.style.transform = "scale(" + size +", " + size + ")";
			jiggle.style.opacity = size;

			flake.appendChild(jiggle);
			flake.style.left = ((Math.random() * 100) - 10) + "%";
			flake.style.animationDelay = (Math.random() * 100) + "s";
			flake.style.animationDuration = 100 - (Math.random() * 50 * size) + "s";

			wrapper.appendChild(flake);
		}
		return wrapper;
	}

});
