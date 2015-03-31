var urlPlaceHolder = "###";
var gbifSpecies = "http://api.gbif.org/v1/species/search?q=" + urlPlaceHolder;

var gbifOccurance = "http://api.gbif.org/v1/occurrence/search?scientificname=" + urlPlaceHolder + "&hasCoordinate=true";

var eolIDLookup =  "http://eol.org/api/search/1.0.json?q=" + urlPlaceHolder + "&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl=";

//with this api, we are mostly just grabbing year of appearance for a given species
var eolTraits = "http://www.eol.org/api/traits/" + urlPlaceHolder + '/';

var currentSelection = null;
var currentSelectionObject = null;
var slider;
var currentSliderVal = 0, previousSliderVal = 0, count = 0;


var iconFolder = "creatureIcons";
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
            xAxis: d3.svg.axis(),
            xTickCount: 36,
            xTicks: function(e) {
                return instance.xAxis.ticks(e);
            },
            xScale: d3.scale.linear(),
            xRange: [0, 0],
            xDomain: [0, 100],

            yAxis: d3.svg.axis().orient("left"),
            yTickCount: 36,
            yTicks: function(e) {
                return instance.yAxis.ticks(e);
            },
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

				instance.xAxis.scale(instance.xScale);
                instance.yAxis.scale(instance.yScale);
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
				
				instance.xTicks(instance.xTickCount);
				instance.yTicks(instance.yTickCount);
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
				
				
				//redraw axis
				d3.select("#xaxis").attr("transform", "translate(" +
					translation[0] + ", " + parseFloat(self.chartScaler.yScale(0) + translation[1]) + ")")
					.call(self.chartScaler.xAxis);

				d3.select("#yaxis").attr("transform", "translate(" +
					parseFloat(self.chartScaler.xScale(0) + translation[0]) + "," + translation[1] + ")")
					.call(self.chartScaler.yAxis);
				
				
				self.svgBG.selectAll(".scaledData")
					.attr('x', function(d) {
						return instance.chartScaler.xScale(d.x[0]) + translation[0];
					})
					.attr('y', function(d) {
						return instance.chartScaler.yScale(d.y[0]) + translation[1];
					})
					.attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(d.width); })
					.attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(d.height); })
					.on('click', function(d) { 
						currentSelection = this;
						currentSelectionObject = d;
					})
					.each(function(d) {		
						addContinent(this, d);
						//var rotation = "rotate(" + d.Rotation + " "	+ (d.width/2) + " " + (d.height/2) + ")";
						//var img = d3.select(this).select("image").attr("transform", rotation);
					});
                
				self.svgBG.selectAll(".creature")
					.attr('x', function(d) {
						return instance.chartScaler.xScale(d.x) + translation[0];
					})
					.attr('y', function(d) {
						return instance.chartScaler.yScale(d.y) + translation[1];
					})
					.attr("width", function(d) { return d.width; })
					.attr("height", function(d) { return d.height; })
					.on('click', function(d) { 
						currentSelection = this;
						currentSelectionObject = d;
					})
					.each(function(d) {		
						//var rotation = "rotate(" + d.Rotation + " "	+ (d.width/2) + " " + (d.height/2) + ")";
						//var img = d3.select(this).select("image").attr("transform", rotation);
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
						.attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(d.width); })
						.attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(d.height);})
						.attr("preserveAspectRatio", "none")
						//.attr("transform", "rotate(-45 0 0)");
					
					instance.continents
						.append("image")
						.attr("xlink:href", function(d){
							return path + '/' + d.continent;
						})
						.attr("width", "100%")
						.attr("height", "100%")
						.each(function(d) {
							d.Rotation = 0; 
					 	})
						.attr("preserveAspectRatio", "none");
					
					instance.draw(instance.zoomHandler.offset, instance.zoomHandler.zoom);
				});
				
				SpeciesList.data.forEach(function(d) {
					//Go through all species and get the data from the gbif api
					(function(specie) {
						var url = eolTraits.replace(urlPlaceHolder, specie.id);
						//console.log("request url:" + url);

                        //grab year data for species
						$.ajax({
						  url: url,
						  dataType: "jsonp",
						  success: function (data) {
							console.log(data)
						
                            var locDataURL = gbifOccurance.replace(urlPlaceHolder, specie.name.replace(' ', ''));
                            //and here we'll grab the location data
                            $.ajax({
                                url: locDataURL,
                                dataType: "json",
                                success: function(data) {
                                    
                                    var locations = data.results.map(function(loc) {
                                        var newData = {
                                            "x": loc.decimalLongitude,
                                            "y": loc.decimalLatitude
                                        }
                                        return newData;
                                    });
                                    
                                    //add all locations to the species
                                    specie.locations = locations;
                                    
                                    //test creation of icon for the species
                                  instance.svgBG.selectAll("creatures")
                                    .data(locations).enter().append("svg")
                                    .each(function(d) {
                                        d.x = parseFloat(d.x);
                                        d.y = parseFloat(d.y);
                                        //console.log(d);
                                        d.width = 50;
                                        d.height = 50;
                                    })
                                    .attr("class", "creature")
                                    .style("display", "block")
                                    .attr("width",  "50px")
                                    .attr("height", "50px")
                                    .attr("preserveAspectRatio", "none")
                                    .append("image")
                                    .attr("xlink:href", function(d){
                                        return iconFolder + '/' + specie.name.replace(' ', '') + '.png';
                                    })
                                    .attr("width", "50px")
                                    .attr("height", "50px")
                                    .each(function(d) {
                                        d.Rotation = 0; 
                                    })
                                    .attr("preserveAspectRatio", "none");
                                        
                                    console.log(locations);
                                }
                            });
                          }
						}); 
					})(d);
				});
			},

			moveContinent: function(continent, continentObject) {
				//Cretaceous Period = 144 MYA - 65 MYA
					//Early = 144 - 98
					//Late = 98 - 65
				//Jurassic Period = 205 MYA - 144 MYA
					// Early = 205 - 180
					// Midlle = 180 - 159
					//Late = 159 - 144
				//Triassic Period = 227 MYA - 205 MYA
					//Late = 227 - 205
				currentSliderVal = -slider.value();
				if (currentSliderVal != previousSliderVal) {
					if (count == 10) {
						previousSliderVal = currentSliderVal;
						count = 0;
					}
					else
						count++;

					//This is up here for debugging purposes only - This section will be moved down after
					d3.select(continent).attr('x', instance.chartScaler.xScale(continentObject.x[0]) + instance.zoomHandler.offset[0]);
					d3.select(continent).attr('y', instance.chartScaler.yScale(continentObject.y[0]) + instance.zoomHandler.offset[1]);
					var rotation = "rotate(" + continentObject.rot[0] + " "	+ (continentObject.width/2) + " " + (continentObject.height/2) + ")";
					d3.select(continent).select("svg").attr("transform", rotation);
					d3.select(continent).attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(continentObject.width); });
					d3.select(continent).attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(continentObject.height); });

					var xPos, yPos, rot;
					//Late Triassic Period
					if (currentSliderVal <= 227 && currentSliderVal > 205) {

					}
					//Early Jurassic Period
					else if (currentSliderVal <= -205 && currentSliderVal > 180) {

					}
					//Middle Jurassic Period
					else if (currentSliderVal <= 180 && currentSliderVal > 159) {

					}
					//Late Jurassic Period
					else if (currentSliderVal <= 159 && currentSliderVal > 144) {

					}
					//Early Cretaceous Period
					else if (currentSliderVal <= 144 && currentSliderVal > 98) {

					}
					//Late Cretaceous Period
					else if (currentSliderVal <= 98 && currentSliderVal > 65) {

					}
					//Present Day - Index[1] - Index[0]
					else if (currentSliderVal <= 65 && currentSliderVal >= 0) {
						xPos = CalculateSliderPosition(65, 0, currentSliderVal, continentObject.x[0], continentObject.x[1]);
						yPos = CalculateSliderPosition(65, 0, currentSliderVal, continentObject.y[0], continentObject.y[1]);
						d3.select(continent).attr('x', instance.chartScaler.xScale(xPos) + instance.zoomHandler.offset[0]);
						d3.select(continent).attr('y', instance.chartScaler.yScale(yPos) + instance.zoomHandler.offset[1]);
					}
				}
			}
		}
	}

	/* 
	 * This is for debugging purposes only
	 * Allows us to move, rotate and scale the continents using WASD, QE and ZC respectively
	 */
	window.addEventListener("keydown", function(e) {
		switch (e.key){
			case ("w"):
				currentSelectionObject.y[0] += 1;
				break;
			case ("s"):
				currentSelectionObject.y[0] -= 1;
				break;
			case ("a"):
				currentSelectionObject.x[0] -= 1;
				break;
			case ("d"):
				currentSelectionObject.x[0] += 1;
				break;
			case ("q"):
				currentSelectionObject.rot[0] -= 1;
				break;
			case ("e"):
				currentSelectionObject.rot[0] += 1;
				break;
			case ("z"):
				currentSelectionObject.width -=1;
				currentSelectionObject.height -=1;
				break;
			case ("c"):
				currentSelectionObject.width += 1;
				currentSelectionObject.height += 1;
				break;
			case ("p"):
				console.log("Continent: " + currentSelectionObject.continent +
							"\nX: " + currentSelectionObject.x + 
							"\nY: " + currentSelectionObject.y +
							"\nHeight: " + currentSelectionObject.height +
							"\nWidth: " + currentSelectionObject.width +
							"\nRotation: " + currentSelectionObject.rot);
		}

		d3.select(currentSelection).attr('x', instance.chartScaler.xScale(currentSelectionObject.x[0]) + instance.zoomHandler.offset[0]);
		d3.select(currentSelection).attr('y', instance.chartScaler.yScale(currentSelectionObject.y[0]) + instance.zoomHandler.offset[1]);
		var rotation = "rotate(" + currentSelectionObject.rot[0] + " "	+ (currentSelectionObject.width/2) + " " + (currentSelectionObject.height/2) + ")";
		d3.select(currentSelection).select("image").attr("transform", rotation);
		d3.select(currentSelection).attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(currentSelectionObject.width); });
		d3.select(currentSelection).attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(currentSelectionObject.height); });
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

				

				//create x axis title
				instance.svgFG.append("g")
					.attr("class", "axis").attr("id", "xaxis")

				//create y axis title
				instance.svgFG.append("g")
					.attr("class", "axis").attr("id", "yaxis");
				
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
        			yRange: [0, temp.width],
					xDomain: [-179, 179],
					yDomain: [179, -179],

					cLatDomain:[0, 360],
					cLonDomain:[0, 360],
					cLatRange:[0, temp.width],
					cLonRange:[0,temp.width]
    			});
			}
			return instance;
		}
	}
})();

/*=============================================================================
Calculates the coordinate between two values on the slider.
	This is a helper function.
=============================================================================*/
function CalculateSliderPosition(maxSliderVal, minSliderVal, sliderVal, valOne, valTwo) {
	//Get the difference between the two values
	var sliderValDiff = maxSliderVal - minSliderVal;

	//Calculate the percentage between the two values
	var percent = (sliderVal - minSliderVal) / sliderValDiff;

	//Find the largest and smallest coordinate value
	var largestCoord = valOne > valTwo ? valOne : valTwo;
	var smallestCoord = valOne < valTwo ? valOne : valTwo;

	//Calculate the difference between the two coordinates
	var coordDiff = largestCoord - smallestCoord;

	//Calculate the amount to add to the smallestCoord
	var coordAmount = coordDiff * percent;

	if (valOne < valTwo)
		return smallestCoord + coordAmount;
	return largestCoord - coordAmount;
}

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
	var formatter = d3.format(",.0f");
	//Initialize slider
	slider = d3.slider()
					.min(-227)
					.max(0)
					//.ticks(227)
					.tickValues([-227, -205, -180, -159, -144, -98, -65, 0])
					//.stepValues([-250, -240, -230, -220, -210, -200, -190, -180, -170, -160, -150, -140, -130, -120, -110, -100, -90, -80, -70, -60, -50, -40, -30, -20, -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0])
					.showRange(false)
					.value(0)
					.tickFormat(function(d) {
						return -formatter(d) + "mya";
					});
	//Render the slider into the div
	d3.select("#slider").call(slider);

	//Set the current and previous slider values
	currentSliderVal = -slider.value();
	previousSliderVal = -slider.value();

	/*var dragBehaviour = d3.behavior.drag();
	dragBehaviour.on("drag", function(){
		chart.fuck();
	});
	d3.select("#slider").call(dragBehaviour);*/

	chart.loadData();
	setChart(chart);
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