/* Magic Mirror
 * Module: MMM-Seasons
 *
 * Based on MMM-Snow by Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 *
 * Comment on terminology: a 'flake' is any moving item being shown on the mirror (a snowflake,
 * a leaf, a butterfly, ...). A 'theme' defines which flakes are shown and how they move. There
 * is a theme for each season and for each special occasion (e.g. halloween).
 */

Module.register("MMM-Seasons", {

	defaults: {
		theme: "auto",                  // "auto" follows the calendar, or force a season / occasion, e.g. "fall" or "halloween"
		seasonMode: "meteorological",   // "meteorological" (1st of Mar/Jun/Sep/Dec) or "astronomical" (equinoxes / solstices)
		hemisphere: "north",            // "north" or "south", the south swaps the seasons
		density: 1,                     // multiplies the flake count of every theme
		opacity: 0.8,                   // maximum opacity of the flakes, keeps the mirror readable
		updateInterval: 60 * 60 * 1000, // how often to check for a season / occasion change (ms)
		seasons: {},                    // per season overrides of the themes below
		occasions: {}                   // overrides of the occasions below, set one to false to disable it, or add your own
	},

	// settings every theme starts from
	baseTheme: {
		"movement"      : "downwards",  // downwards, upwards, windy, around or long around
		"flakeCount"    : 50,           // number of flakes on the mirror
		"size"          : 24,           // maximum flake size in px
		"speed"         : 1,            // >1 faster, <1 slower
		"sway"          : 1,            // amount of sideways sway, 0 = none
		"opacity"       : 1,            // multiplied with the global opacity
		"emojis"        : [],           // emojis to show, used when the theme has no images
		"images"        : null,         // optional explicit list of image files
		"imagePrefix"   : null,         // images are <imagePrefix><n><imageExtension>, n = 1 ... imagesCount
		"imagesCount"   : 0,
		"imageExtension": ".png"
	},

	themes: {
		"spring" : {
			"movement"   : "around",    // flowers move around
			"flakeCount" : 30,
			"size"       : 32,
			"emojis"     : ["🌸", "🌼"],
			"imagePrefix": "images/spring/spring"},
		"summer" : {
			"movement"   : "long around", // butterflies fly along long curves
			"flakeCount" : 25,
			"size"       : 36,
			"sway"       : 0.3,
			"emojis"     : ["🦋", { "emoji": "✨", "movement": "upwards", "size": 16, "weight": 2 }], // fireflies rise
			"imagePrefix": "images/summer/summer"},
		"fall"   : {
			"movement"   : "windy",     // leaves in the wind
			"flakeCount" : 40,
			"size"       : 32,
			"emojis"     : ["🍂", "🍁", "🍃", { "emoji": "🌰", "weight": 0.15 }],
			"imagePrefix": "images/fall/fall"},
		"winter" : {
			"movement"   : "downwards", // snow goes downwards
			"flakeCount" : 100,
			"size"       : 20,
			"emojis"     : ["❄️"],
			"imagePrefix": "images/winter/winter",
			"imagesCount": 3}           // the snow images are used instead of the emoji
	},

	// date based themes (from / to as "MM-DD", inclusive), they override the season
	occasions: {
		"newYear"   : {
			"from"       : "12-31",
			"to"         : "01-01",
			"movement"   : "upwards",
			"flakeCount" : 40,
			"size"       : 28,
			"emojis"     : ["🎆", "🎇", "✨"]},
		"christmas" : {
			"from"       : "12-01",
			"to"         : "12-26",
			"mixWithSeason": true,      // add the emojis to the flakes of the season
			"size"       : 28,
			"emojis"     : [{ "emoji": "🎄", "weight": 0.1 }, { "emoji": "🎁", "weight": 0.1 }]},
		"halloween" : {
			"from"       : "10-24",
			"to"         : "10-31",
			"movement"   : "around",
			"flakeCount" : 20,
			"size"       : 36,
			"emojis"     : ["🎃", "👻", { "emoji": "🦇", "movement": "long around" }]}
	},

	movements: ["downwards", "upwards", "windy", "around", "long-around"],

	getStyles: function() {
		return [ "MMM-Seasons.css" ];
	},

	start: function() {
		var self = this;
		this.currentTheme = this.getThemeName(new Date());
		setInterval(function() {
			var theme = self.getThemeName(new Date());
			if (theme !== self.currentTheme) {
				Log.info(self.name + ": theme changed from " + self.currentTheme + " to " + theme);
				self.currentTheme = theme;
				self.updateDom();
			}
		}, this.config.updateInterval);
	},

	getThemeName: function(date) {
		if (this.themes[this.config.theme] || this.getOccasions()[this.config.theme]) {
			return this.config.theme;
		}
		return this.getOccasion(date) || this.getSeason(date);
	},

	getSeason: function(date) {
		var seasons = ["winter", "spring", "summer", "fall"];
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

	// built-in occasions merged with the configured ones, disabled ones are left out
	getOccasions: function() {
		var result = {};
		var names = Object.keys(Object.assign({}, this.occasions, this.config.occasions));
		for (var i = 0; i < names.length; i++) {
			var name = names[i];
			var custom = this.config.occasions[name];
			if (custom === false) {
				continue;
			}
			result[name] = Object.assign({}, this.occasions[name], custom || {});
		}
		return result;
	},

	// the active occasion with the shortest date range wins, e.g. a birthday beats christmas
	getOccasion: function(date) {
		var dayOfYear = function(mmdd) {
			var parts = String(mmdd).split("-");
			return (parseInt(parts[0], 10) - 1) * 31 + parseInt(parts[1], 10);
		};
		var today = date.getMonth() * 31 + date.getDate();
		var occasions = this.getOccasions();
		var best = null, bestLength;
		for (var name in occasions) {
			var from = dayOfYear(occasions[name].from);
			var to = dayOfYear(occasions[name].to);
			if (isNaN(from) || isNaN(to)) {
				continue;
			}
			var active = from <= to ? (today >= from && today <= to) : (today >= from || today <= to);
			var length = (to - from + 372) % 372;
			if (active && (best === null || length < bestLength)) {
				best = name;
				bestLength = length;
			}
		}
		return best;
	},

	getSeasonSettings: function(season) {
		return Object.assign({}, this.baseTheme, this.themes[season], this.config.seasons[season] || {});
	},

	// returns the theme settings and the list of flake items to choose from
	getTheme: function(name) {
		if (this.themes[name]) {
			var settings = this.getSeasonSettings(name);
			return { settings: settings, items: this.getItems(settings) };
		}

		var occasion = this.getOccasions()[name];
		var seasonSettings = this.getSeasonSettings(this.getSeason(new Date()));
		// an occasion inherits how the season moves, but not what the season shows
		var settings = Object.assign({}, seasonSettings, {
			"emojis": [], "images": null, "imagePrefix": null, "imagesCount": 0
		}, occasion);
		var items = this.getItems(settings);
		if (settings.mixWithSeason) {
			items = this.getItems(seasonSettings).concat(items);
		}
		return { settings: settings, items: items };
	},

	getItems: function(settings) {
		var self = this;
		var list;
		if (Array.isArray(settings.images) && settings.images.length > 0) {
			list = settings.images.map(function(image) {
				return typeof image === "string" ? { "image": image } : image;
			});
		} else if (settings.imagePrefix && settings.imagesCount > 0) {
			list = [];
			for (var i = 1; i <= settings.imagesCount; i++) {
				list.push({ "image": settings.imagePrefix + i + settings.imageExtension });
			}
		} else {
			list = (settings.emojis || []).map(function(emoji) {
				return typeof emoji === "string" ? { "emoji": emoji } : emoji;
			});
		}

		return list.map(function(entry) {
			var item = Object.assign({
				"movement": settings.movement,
				"size"    : settings.size,
				"speed"   : settings.speed,
				"sway"    : settings.sway,
				"opacity" : settings.opacity,
				"weight"  : 1
			}, entry);
			item.movement = self.normalizeMovement(item.movement);
			// relative paths are resolved against the module folder, absolute paths and urls are used as they are
			if (item.image && !/^(\/|[a-z]+:)/i.test(item.image)) {
				item.image = self.file(item.image);
			}
			return item;
		});
	},

	// accepts e.g. "long around", "long arround", "longAround" and "long-around"
	normalizeMovement: function(movement) {
		var key = String(movement).toLowerCase().replace(/[^a-z]/g, "").replace("arround", "around");
		if (key === "longaround") {
			key = "long-around";
		}
		if (this.movements.indexOf(key) === -1) {
			Log.warn(this.name + ": unknown movement '" + movement + "', using downwards");
			return "downwards";
		}
		return key;
	},

	pickItem: function(items) {
		var total = items.reduce(function(sum, item) { return sum + item.weight; }, 0);
		var r = Math.random() * total;
		for (var i = 0; i < items.length; i++) {
			r -= items[i].weight;
			if (r < 0) {
				return items[i];
			}
		}
		return items[items.length - 1];
	},

	getDom: function() {
		var theme = this.getTheme(this.currentTheme);
		var wrapper = document.createElement("div");
		wrapper.className = "wrapper " + this.currentTheme;

		var items = theme.items.filter(function(item) { return item.weight > 0; });
		if (items.length === 0) {
			return wrapper;
		}

		var count = Math.round(theme.settings.flakeCount * this.config.density);
		for (var i = 0; i < count; i++) {
			wrapper.appendChild(this.createFlake(this.pickItem(items)));
		}
		return wrapper;
	},

	/* A flake consists of four nested elements, each with its own animation:
	 *   flake   - moves along the path of the movement (falling, rising, around, ...)
	 *   sway    - sways sideways
	 *   spin    - tumbles, rocks, flutters or twinkles, depending on the movement
	 *   content - the emoji or image, scaled and faded randomly
	 */
	createFlake: function(item) {
		var random = Math.random;
		var flake = document.createElement("div");
		var sway = document.createElement("div");
		var spin = document.createElement("div");
		var content = document.createElement("div");

		flake.className = "flake flake-" + item.movement;
		sway.className = "flake-sway";
		spin.className = "flake-spin";
		content.className = "flake-content";
		flake.style.setProperty("--sway", item.sway);

		var duration;
		switch (item.movement) {
			case "windy":
				flake.style.left = ((random() * 150) - 60) + "vw";
				flake.style.setProperty("--wind", 0.6 + random() * 0.8);
				duration = 15 + random() * 15;
				spin.style.animationDuration = (3 + random() * 5) + "s";
				spin.style.animationDirection = random() < 0.5 ? "normal" : "reverse";
				break;
			case "around":
				this.placeRandomly(flake);
				flake.style.setProperty("--dx", random() * 2 - 1);
				flake.style.setProperty("--dy", random() * 2 - 1);
				duration = 20 + random() * 20;
				spin.style.animationDuration = (4 + random() * 4) + "s";
				break;
			case "long-around":
				var direction = random() < 0.5 ? 1 : -1;
				flake.style.left = direction > 0 ? "-10vw" : "105vw";
				flake.style.top = (5 + random() * 80) + "vh";
				flake.style.setProperty("--dir", direction);
				flake.style.setProperty("--dy", 0.5 + random());
				duration = 25 + random() * 20;
				spin.style.animationDuration = (0.25 + random() * 0.2) + "s";
				break;
			case "upwards":
				flake.style.left = ((random() * 100) - 10) + "vw";
				duration = 50 + random() * 50;
				spin.style.animationDuration = (2 + random() * 3) + "s";
				break;
			default: // downwards
				flake.style.left = ((random() * 100) - 10) + "vw";
				duration = 50 + random() * 50;
		}

		duration = duration / item.speed;
		flake.style.animationDuration = duration + "s";
		// negative delays start the flakes somewhere along their path, so the mirror is filled at once
		flake.style.animationDelay = -(random() * duration) + "s";
		spin.style.animationDelay = -(random() * 5) + "s";

		var swayDuration = (30 + random() * 30) / item.speed;
		sway.style.animationDuration = swayDuration + "s";
		sway.style.animationDelay = -(random() * swayDuration) + "s";

		// flakes moving around get a new place on every round
		if (item.movement === "around" || item.movement === "long-around") {
			var self = this;
			flake.addEventListener("animationiteration", function(event) {
				if (event.target !== flake) {
					return;
				}
				if (item.movement === "around") {
					self.placeRandomly(flake);
				} else {
					flake.style.top = (5 + random() * 80) + "vh";
				}
			});
		}

		var size = item.size * (0.25 + random() * 0.75);
		content.style.opacity = this.config.opacity * item.opacity * (0.4 + random() * 0.6);
		if (item.image) {
			content.style.width = size + "px";
			content.style.height = size + "px";
			content.style.backgroundImage = "url('" + item.image + "')";
		} else {
			content.style.fontSize = size + "px";
			content.textContent = item.emoji;
		}

		spin.appendChild(content);
		sway.appendChild(spin);
		flake.appendChild(sway);
		return flake;
	},

	placeRandomly: function(flake) {
		flake.style.left = (Math.random() * 90) + "vw";
		flake.style.top = (Math.random() * 85) + "vh";
	}

});
