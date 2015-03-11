var urlPlaceHolder = "###";
var gbifSpecies = "http://api.gbif.org/v1/species/search?q=" + urlPlaceHolder;
var gbifOccurance = "http://api.gbif.org/v1/occurrence/search?scientificname=" 
					+ urlPlaceHolder + "&hasCoordinate=true"

var eolIDLookup =  "http://eol.org/api/search/1.0.json?q=" + urlPlaceHolder +
"&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl="

var eolTraits = "http://eol.org/api/traits/" + urlPlaceHolder;



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

                //make sure text reappears after scrolling
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

                //initialization values
                for (var key in values) {
                    if (values.hasOwnProperty(key))
                        instance[key] = values[key];
                }

               // instance.z.scaleExtent([instance.minZoom, instance.maxZoom]);
				instance.zoomScale();
            }
            return instance;
        }
    }
})();

/*=============================================================================
ChartScaler:
	Keep track of axis and plot scales. Resizes everything appropriately 
	according to zoom--objects are re-rendered as they are zoomed into rather
	upscaled from their initial low resolution.
=============================================================================*/
var ChartScaler = (function() {
    var instance;

    function _init() {
        return {
            xScale: d3.scale.linear(),
            xRange: [0, 0],
            xDomain: [0, 100],

            yScale: d3.scale.linear(),
            yRange: [0, 0],
            yDomain: [0, 100],
			
            scale: function(s) {
                var newXRange = [instance.xRange[0], instance.xRange[1] * s];
                var newYRange = [instance.yRange[0], instance.yRange[1] * s];
			
                instance.xScale.domain(instance.xDomain).range(newXRange);
                instance.yScale.domain(instance.yDomain).range(newYRange);
			
                instance.xAxis.scale(instance.xScale);
                instance.yAxis.scale(instance.yScale);
            }
        }
    }

    return {
        init: function(values) {
            if (!instance) {
                instance = _init();
                //initialization values
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
			
    		//internal resolution of dots
    		pointContentWidth: 200,
        	pointContentHeight: 200,

     		XTitleX: 500,
			XTitleY: function() { return this.height / 2 + 20; },
			
			colorScheme: null,
    		zoomHandler: ZoomHandler.init(),
    		chartScaler: null,
			
			cullMax: 300,
			
			
			divSelector: null,
			
			//svg surfaces
			svgDisplay: null,
			svgBG: null,
			svgFG: null,
			svgPopup: null,
			
			
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
			the svg will be scaled down to fit.
			*/
			createScaledSvg: function(svgSrc, width, height) {
				svgSrc.append("svg").attr("class", "scaledData")
					  .attr("viewBox" , "0 0 " + width + " " + height)
					  .style("display", "block");
				
				//return the source so we can chain this function
				return svgSrc;
			},
			
		/*=====================================================
		Draw
		=====================================================*/
			draw: function(translation, scale) {
				var self = this;
				self.chartScaler.scale(scale);
				
			},
		/*=====================================================
			Load data
		=====================================================*/
			loadData: function(fn) {
				//d3.json(filename, function(error, data) {
				SpeciesList.data.forEach(function(d) {
					//go through every specie and get the data
					//from the gbif api
					(function(specie) {
						var url = eolTraits.replace(urlPlaceHolder, specie.id);
						console.log("request url:" + url);
						d3.json(url, function(error, obj){
							if (error) return;

							console.log(obj.response);




						});
					})(d);
				});
					
					
					
					
				//create a scalable container for display data
				/*var idNumber = 0;
				var dataCache = self.svgBG.selectAll("svg")
						.data(dataset).enter();
				
				createScaledSvg(dataCache, 200, 200)
						.attr("id", function(d) {
							var id = "plotPoint" + idNumber;
							d.cssID = "#" + id;
							idNumber += 1;
							return id;
						})
						//create a reference to this object through the dataset
						.each(function(d) { d.this = self.svgBG.select(d.cssID); })
	
				
				*/
				
				
					//once data is loaded, we can draw the display
					//self.draw(self.zoomHandler.offset, self.zoomHandler.zoom);
			}
		}
	}
	
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
				
				instance.chartScaler = ChartScaler.init({
					xRange: [instance.xPadding, instance.width - instance.xPadding],
        			yRange: [instance.yPadding, instance.height - instance.yPadding]
    			});			
				
				instance.svgDisplay = d3.select(instance.divSelector).append("svg")
					.attr("id", "svgSurface")
					.attr("width", instance.width)
					.attr("height", instance.height)
					.call(instance.zoomHandler.z)
					 //disable d3's zoom drag to override with my own
					.on("mousedown.zoom", null)
					.on("mousemove.zoom", null)
					.on("dblclick.zoom", null)
					.on("touchstart.zoom", null)
					//my own drag to override the zoom one
					.call(d3.behavior.drag().on("drag", function() {
						instance.zoomHandler.offset[0] += d3.event.dx;
						instance.zoomHandler.offset[1] += d3.event.dy;
						instance.zoomHandler.z.translate(instance.zoomHandler.offset);

						instance.svgFG.select(".popup").remove();
						instance.draw(instance.zoomHandler.offset, instance.zoomHandler.zoom);
					}));

				//create background and add axis to it
				instance.svgBG = instance.svgDisplay.append("svg").
									attr("id", "svgBG");
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
				
			}
			return instance;
		}
	}
})();

/*=============================================================================
Program Start

Script won't start until the page has finished loading.
=============================================================================*/
document.addEventListener("DOMContentLoaded", function(e) {
	
	var chart = SpeciesMap.init({
		divSelector: ".chartContainer",
		xPadding: 40,
		yPadding: 40
	});
	
	
	//chart.loadData();
	var ul = d3.select(".CreaturesList");
	var i = 0;
	for( i = 0; i < 40; i++) {
		ul.append("li").append("p").text("random");
	}
	
	chart.loadData();
	
	
	
	
});



SpeciesList = {
	data: [
		{
			id: 4433638,
			name: "Tyrannosaurus Rex",
			image: null
		},
	
		{
			name: "Woolly Mammoth",
			image: null
		}
	]
};