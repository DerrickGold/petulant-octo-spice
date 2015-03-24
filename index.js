var urlPlaceHolder = "###";
var gbifSpecies = "http://api.gbif.org/v1/species/search?q=" + urlPlaceHolder;
var gbifOccurance = "http://api.gbif.org/v1/occurrence/search?scientificname=" + urlPlaceHolder + "&hasCoordinate=true";
var eolIDLookup =  "http://eol.org/api/search/1.0.json?q=" + urlPlaceHolder + "&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl=";
var eolTraits = "http://www.eol.org/api/traits/" + urlPlaceHolder + '/';
var currentSelection = null;
var currentSelectionObject = null;


/*
	d3.select(window).on("keydown", function(){
		if (currentSelection != null) {
			currentSelectionObject.x -= 1;
			d3.select(currentSelection).attr('x', instance.chartScaler.xScale(currentSelectionObject.x - (currentSelectionObject.width/2)))
		}
	});*/





/*=============================================================================
ZoomHandler:
	A zoom behaviour that works independent of d3's drag events allowing for
	proper handling of zoom end and zoom start events.
=============================================================================*/
var ZoomHandler = (function() {
    var instance;

    function _init() {
        return {
            self: this,
            minZoom: 1,
            maxZoom: 60,
            zoom: 1,
            offset: [0, 0],
            timer: 0,

            __zoomStartCb: 0,
            startZoom: function(v) {
                instance.__zoomStartCb = function(z) {
                    v(instance);
                };
            },

            __zoomEndCb: 0,
            endZoom: function(v) {
                instance.__zoomEndCb = function(z) {
                    v(instance);
                };
            },

            __zoomDuring: 0,
            onZoom: function(v) {
                instance.__zoomDuring = function(z) {
                    v(instance);
                };
            },

            zoomBehavior: function() {
                instance.__zoomStartCb();
                instance.zoom = d3.event.scale;
                instance.offset = d3.event.translate;

                //Make sure text reappears after scrolling
                clearTimeout(instance.timer);
                instance.timer = setTimeout(instance.__zoomEndCb, 200);

                instance.__zoomDuring();
            },
            z: d3.behavior.zoom().on("zoom", function() {
                instance.zoomBehavior();
            }),
			zoomScale: function(min, max) {
				if(min != undefined)instance.minZoom = min;
				if(max != undefined)instance.maxZoom = max;
				instance.z.scaleExtent([instance.minZoom, instance.maxZoom]);
			}
        }
    }

    return {
        init: function(values) {
            if (!instance) {
                instance = _init();

                //Initialization values
                for (var key in values) {
                    if (values.hasOwnProperty(key))
                        instance[key] = values[key];
                }
				instance.zoomScale();
            }
            return instance;
        }
    }
})();

/*=============================================================================
ChartScaler:
	Keep track of axis and plot scales. Resizes everything appropriately 
	according to zoom-objects are re-rendered as they are zoomed into rather
	upscaled from their initial low resolution.
=============================================================================*/
var ChartScaler = (function() {
    var instance;

    function _init() {
        return {
			//Convert screen points into longitude and latitude pixels
            xScale: d3.scale.linear(),
            xRange: [0, 0],
            xDomain: [0, 100],

            yScale: d3.scale.linear(),
            yRange: [0, 0],
            yDomain: [0, 100],
			
			ContinentScaleLat: d3.scale.linear(),
			cLatRange: [0, 180],
			cLatDomain: [0, 180],
		
			ContinentScaleLon: d3.scale.linear(),
			cLonRange: [0, 360],
			cLonDomain: [0, 360],
			
            scale: function(s) {
                var newXRange = [instance.xRange[0], instance.xRange[1] * s];
                var newYRange = [instance.yRange[0], instance.yRange[1] * s];
				
				var newCLatRange = [instance.cLatRange[0], instance.cLatRange[1] * s];
				var newCLonRange = [instance.cLonRange[0], instance.cLonRange[1] * s];
				
                instance.xScale.domain(instance.xDomain).range(newXRange);
                instance.yScale.domain(instance.yDomain).range(newYRange);

				instance.ContinentScaleLat.domain(instance.cLatDomain).range(newCLatRange);
				instance.ContinentScaleLon.domain(instance.cLonDomain).range(newCLonRange);
				instanceTest = instance;
            }
        }
    }

    return {
        init: function(values) {
            if (!instance) {
                instance = _init();

                //Initialization values
                for (var key in values) {
                    if (values.hasOwnProperty(key))
                        instance[key] = values[key];
                }
            }
            return instance;
        }
    }
})();

/*=============================================================================
Species Map:
	Creates a chart that plots species on the world through time.
=============================================================================*/
var SpeciesMap = (function() {
	var instance;
	
	function _init() {
		return {
	    	width: window.innerWidth,
        	height: window.innerHeight,
        	xPadding: 20,
			yPadding: 10,
			
    		//Internal resolution of dots
    		pointContentWidth: 200,
        	pointContentHeight: 200,

     		XTitleX: 500,
			XTitleY: function() { return this.height / 2 + 20; },
			
			colorScheme: null,
    		zoomHandler: ZoomHandler.init(),
    		chartScaler: null,
			
			cullMax: 300,
			
			divSelector: null,
			
			//SVG surfaces
			svgDisplay: null,
			svgBG: null,
			svgFG: null,
			svgPopup: null,
			
			continents: null,
			
			
			resize: function(wd, ht) {
				this.chartScaler.xRange = [this.xPadding, wd - this.xPadding];
				this.chartScaler.yRange = [this.yPadding, ht - this.yPadding];
				this.svgDisplay.attr("width", wd).attr("height", ht);
				this.draw(this.zoomHandler.offset, this.zoomHandler.zoom);	
			},
			
			deleteData: function() {
				var self = this;
				self.svgBG.selectAll(".scaledData").each(function(d){
					d.this.remove();
				});

				self.zoomHandler.zoom = self.zoomHandler.minZoom;
				self.zoomHandler.offset = [0,0];
				self.zoomHandler.z.scale(self.zoomHandler.minZoom);
				self.zoomHandler.z.translate(self.zoomHandler.offset);	
			}, 
			
			redraw: function() {
				this.draw(this.zoomHandler.offset, this.zoomHandler.zoom);	
			},
			
			/*Makes an svg object of a specified resolution
			that can be scaled up or down nicely.
			Width and height refer to its maximum limits.
			Content that exceed this width and height within
			the SVG will be scaled down to fit.
			*/
			createScaledSvg: function(svgSrc, width, height) {
				svgSrc.append("svg").attr("class", "scaledData")
					  .attr("viewBox" , "0 0 " + width + " " + height)
					  .style("display", "block");
				
				//Return the source so we can chain this function
				return svgSrc;
			},
			
		/*=====================================================
		Draw
		=====================================================*/
			draw: function(translation, scale) {
				var self = this;
				self.chartScaler.scale(scale);
				
				self.svgBG.selectAll(".scaledData")
					.attr('x', function(d) {
						return instance.chartScaler.xScale(d.x - (d.width/2)) + translation[0];
					})
					.attr('y', function(d) {
						return instance.chartScaler.yScale(d.y + (d.height/2)) + translation[1];
					})
					.attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(d.width); })
					.attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(d.height); })
					.on('click', function(d) { 
						currentSelection = this;
						currentSelectionObject = d;
					})
					.each(function(d) {					
						var rotation = "rotate(" + d.Rotation + " "	+ (d.width/2) + " " + (d.height/2) + ")";
						var img = d3.select(this).select("image").attr("transform", rotation);
					});
			},
		/*=====================================================
		Load data
		=====================================================*/
			loadData: function(fn) {
				d3.json("continents/continents.json", function(e, dataset) {
					var path = dataset.path;
					dataset = dataset.data;
					
					instance.continents = instance.svgBG.selectAll("svg")
						.data(dataset).enter().append("svg")
						.attr("class", "scaledData")
					  	.style("display", "block")
					 	.each(function(d) {
							//Transform all our long/lat positions in the continents.json to screen pixels
						})
					 	.attr("viewBox" , function(d) { 
						 	return "0 0 " +  instance.chartScaler.ContinentScaleLon(d.width) + " " 
											+ instance.chartScaler.ContinentScaleLat(d.height);
					 	});
					
					instance.continents
						.append("image")
						.attr("xlink:href", function(d){
							return path + '/' + d.continent;
						})
						.attr("width", "100%")
						.attr("height", "100%")
						.each(function(d) {
							d.Rotation = d.rot; 
					 	});
					
						instance.draw(instance.zoomHandler.offset, instance.zoomHandler.zoom);
				});
				
				SpeciesList.data.forEach(function(d) {
					//Go through all species and get the data from the gbif api
					(function(specie) {
						var url = eolTraits.replace(urlPlaceHolder, specie.id);
						console.log("request url:" + url);

						$.ajax({
						  url: url,
						  dataType: "jsonp",
						  success: function (data) {
							console.log(data)
						  }
						});
					})(d);
				});
			}
		}
	}

	//This is for debugging purposes only - allows us to move the continents around by clicking on a continent and using WASD to move it and QE to rotate it
	window.addEventListener("keydown", function(e) {
		switch (e.key){
			case ("w"):
				currentSelectionObject.y += 1;
				break;
			case ("s"):
				currentSelectionObject.y -= 1;
				break;
			case ("a"):
				currentSelectionObject.x -= 1;
				break;
			case ("d"):
				currentSelectionObject.x += 1;
				break;
			case ("q"):
				currentSelectionObject.rot -= 1;
				break;
			case ("e"):
				currentSelectionObject.rot += 1;
				break;
			case ("p"):
				console.log("Continent: " + currentSelectionObject.continent +
							"\nX: " + currentSelectionObject.x + 
							"\nY: " + currentSelectionObject.y +
							"\nRotation: " + currentSelectionObject.rot);
		}

		d3.select(currentSelection).attr('x', instance.chartScaler.xScale(currentSelectionObject.x - (currentSelectionObject.width/2)));
		d3.select(currentSelection).attr('y', instance.chartScaler.yScale(currentSelectionObject.y + (currentSelectionObject.height/2)));
		var rotation = "rotate(" + currentSelectionObject.rot + " "	+ (currentSelectionObject.width/2) + " " + (currentSelectionObject.height/2) + ")";
		d3.select(currentSelection).select("image").attr("transform", rotation);
	});
	
	return {
		self: this,
/*=====================================================
Initialization
=====================================================*/
		init: function(values) {
			if (!instance) {
				instance = _init();
		        for (var key in values) {
                    if (values.hasOwnProperty(key))
                        instance[key] = values[key];
                }
				
				instance.svgDisplay = d3.select(instance.divSelector).append("svg")
					.attr("id", "svgSurface")
					.attr("width", instance.width)
					.attr("height", instance.height)
					.attr("y", 0).attr("x", 0)
					.call(instance.zoomHandler.z)
					 //Disable d3's zoom drag to override with my own
					.on("mousedown.zoom", null)
					.on("mousemove.zoom", null)
					.on("dblclick.zoom", null)
					.on("touchstart.zoom", null)
					//My own drag to override the zoom one
					.call(d3.behavior.drag().on("drag", function() {
						instance.zoomHandler.offset[0] += d3.event.dx;
						instance.zoomHandler.offset[1] += d3.event.dy;
						instance.zoomHandler.z.translate(instance.zoomHandler.offset);

						instance.svgFG.select(".popup").remove();
						instance.draw(instance.zoomHandler.offset, instance.zoomHandler.zoom);
					}));

				//Create background and add axis to it
				instance.svgBG = instance.svgDisplay.append("svg")
									.attr("id", "svgBG");

				instance.svgFG = instance.svgDisplay.append("svg");
				instance.svgPopup = instance.svgFG.append("g");

				instance.zoomHandler.startZoom(function(e) {
					instance.svgFG.select(".popup").remove();
					instance.svgBG.selectAll("text")
						.attr("display", "none");
				});

				instance.zoomHandler.endZoom(function(e) {
					instance.svgBG.selectAll("text").attr("display", "block");
				});

				instance.zoomHandler.onZoom(function(e) {
					instance.draw(e.offset, e.zoom);
				});
				
				var temp = d3.select("#svgSurface").node().getBoundingClientRect();
				instance.chartScaler = ChartScaler.init({
					xRange: [0, temp.width],
        			yRange: [0, temp.height],
					xDomain: [-180, 180],
					yDomain: [90, -90],
					
					xLongRange: [-180, 180],
					xLongDomain:[0, temp.width],
					yLatRange: [90, -90],
					yLatDomain: [0, temp.height],
					
					cLatRange:[0, temp.height],
					cLonRange:[0, temp.width]
    			});
			}
			return instance;
		}
	}
})();

/*=============================================================================
Program Start
	Script won't start until the page has finished loading.
=============================================================================*/
function StartApp() {
	
	var chart = SpeciesMap.init({
		divSelector: ".chartContainer",
		xPadding: 0,
		yPadding: 0,
		width: "100%",
		height: "100%"
	});
	
	//Create the list on the left to hold all the species
	var ul = d3.select(".CreaturesList");
	var i = 0;
	for( i = 0; i < 40; i++) {
		ul.append("li").append("p").text("random");
	}

	//Tick formatter
	var formatter = d3.format(",.2f");
	//Initialize slider
	var slider = d3.slider()
					.min(-250)
					.max(0)
					//.ticks(250)
					.tickValues([-250, -200, -150, -100, -50, 0])
					.stepValues([-250, -240, -230, -220, -210, -200, -190, -180, -170, -160, -150, -140, -130, -120, -110, -100, -90, -80, -70, -60, -50, -40, -30, -20, -10, 0])
					.showRange(false)
					.value(0)
					.tickFormat(function(d) {
						return formatter(d) + "mya";
					});
	//Render the slider into the div
	d3.select("#slider").call(slider);

	chart.loadData();
};

SpeciesList = {
	data: [
		{
			id: 4433638,
			name: "Tyrannosaurus Rex",
			image: null
		}
	]
};