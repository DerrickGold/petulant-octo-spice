var urlPlaceHolder = "###";
var gbifSpecies = "http://api.gbif.org/v1/species/search?q=" + urlPlaceHolder;
var gbifOccurance = "http://api.gbif.org/v1/occurrence/search?scientificname=" 
					+ urlPlaceHolder + "&hasCoordinate=true"

var eolIDLookup =  "http://eol.org/api/search/1.0.json?q=" + urlPlaceHolder +
"&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl="

var eolTraits = "http://www.eol.org/api/traits/" + urlPlaceHolder + '/';



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
			//convert screen points into longitude and latitude
			//pixels
            xScale: d3.scale.linear(),
            xRange: [0, 0],
            xDomain: [0, 100],

            yScale: d3.scale.linear(),
            yRange: [0, 0],
            yDomain: [0, 100],
			
			//these will be used for converting longitude and latitude
			//positions into screen points
			xLongToPix: d3.scale.linear(),
			xLongRange: [0, 0],
			xLongDomain: [0, 100],
			
			yLatToPix: d3.scale.linear(),
			yLatRange: [0, 0],
			yLatDomain: [0, 100],
			
			
			
			ContinentScale: d3.scale.linear(),
			cRange: [0, 100],
			cDomain: [0, 100],
			
			
			
			
			
			
            scale: function(s) {
                var newXRange = [instance.xRange[0], instance.xRange[1] * s];
                var newYRange = [instance.yRange[0], instance.yRange[1] * s];
				
                var newLongXRange = [instance.xLongRange[0], instance.xLongRange[1] * s];
                var newLatYRange = [instance.yLatRange[0], instance.yLatRange[1] * s];
				
				var newCRange = [instance.cRange[0], instance.cRange[1] * s];
				
				
                instance.xScale.domain(instance.xDomain).range(newXRange);
                instance.yScale.domain(instance.yDomain).range(newYRange);
				
                instance.xLongToPix.domain(instance.xLongDomain).range(newLongXRange);
                instance.yLatToPix.domain(instance.yLatDomain).range(newLatYRange);
				
				instance.ContinentScale.domain(instance.cDomain).range(newCRange);
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
				

				self.svgBG.selectAll(".scaledData")
					.attr('x', function(d) {
						this.drawPosX = d.x + translation[0] + self.chartScaler.xScale(d.x - (d.width/2));
						return this.drawPosX;
					})
					.attr('y', function(d) {
						this.drawPosY = d.y + translation[1] + self.chartScaler.yScale(d.y - (d.height/2));
						return this.drawPosY;
					})
					.attr("width", function(d) { return self.chartScaler.xScale(d.width); })
					.attr("height", function(d) { return self.chartScaler.yScale(d.height); })
					.on('click', function(d) {
						console.log("Test");
					})
					.each(function(d) {
						var rotation = "rotate(" + d.Rotation + " " + (d.width/2) + " " + (d.height/2) + ")";
						var img = d3.select(this).select("image");
						img.attr("transform", rotation);
					});
			},
		/*=====================================================
			Load data
		=====================================================*/
			loadData: function(fn) {
				d3.json("continents/continents.json", function(e, dataset) {
					console.log(e);
					var path = dataset.path;
					dataset = dataset.data;
					
					 instance.continents = instance.svgBG.selectAll("svg")
						.data(dataset).enter().append("svg")
						.attr("class", "scaledData")
					  	.style("display", "block")
					 	.each(function(d) {
							//transform all our long/lat positions in the continents.json
						 	//to screen pixels
							d.x = instance.chartScaler.xLongToPix(d.x);
						 	d.y = instance.chartScaler.yLatToPix(d.y);
						 	d.width = instance.chartScaler.xScale(d.width);
						 	d.height = instance.chartScaler.yScale(d.height);
						})
					 	.attr("viewBox" , function(d) { return "0 0 " + d.width + " " + d.height;})
					 	;
					
					
					instance.continents
						.append("image")
						.attr("xlink:href", function(d){
							return path + '/' + d.contintent;
						})
						.attr("width", function(d) { 
							console.log(d.width);
							return instance.chartScaler.ContinentScale(d.width);
						})
						.attr("height", function(d) { 
							return instance.chartScaler.ContinentScale(d.height);
						})
						.each(function(d) {
							d.Rotation = d.rot; 
							
							//this.attr("transform", "rotation(" + d.Rotation + " 0 0)");
					 	});
					
					
					
					
						instance.draw(instance.zoomHandler.offset, instance.zoomHandler.zoom);
				});
				
				
				
				//d3.json(filename, function(error, data) {
				SpeciesList.data.forEach(function(d) {
					//go through every specie and get the data
					//from the gbif api
					(function(specie) {
						var url = eolTraits.replace(urlPlaceHolder, specie.id);
						console.log("request url:" + url);
						/*d3.json(url,function(error, obj){
							if (error) return;

							console.log(obj.response);




						});*/
						$.ajax({
						  url: url,
						  dataType: "jsonp",
						  success: function (data) {
							console.log(data)
							//alert(data);
						  }
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
				

				instance.svgDisplay = d3.select(instance.divSelector).append("svg")
					.attr("id", "svgSurface")
					.attr("width", instance.width)
					.attr("height", instance.height)
					.attr("y", 0).attr("x", 0)
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
					yLatDomain: [0, temp.height]
    			});			
				
				console.log();
				//console.log(instance.svgDisplay.getBBox().height);
				
				
			}
			return instance;
		}
	}
})();

/*=============================================================================
Program Start

Script won't start until the page has finished loading.
=============================================================================*/
//document.addEventListener("DOMContentLoaded", function(e) {
function StartApp() {
	
	var chart = SpeciesMap.init({
		divSelector: ".chartContainer",
		xPadding: 0,
		yPadding: 0,
		width: "100%",
		height: "100%"
	});
	
	
	//chart.loadData();
	var ul = d3.select(".CreaturesList");
	var i = 0;
	for( i = 0; i < 40; i++) {
		ul.append("li").append("p").text("random");
	}
	
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
/*,
	
		{
			name: "Woolly Mammoth",
			image: null
		}
*/