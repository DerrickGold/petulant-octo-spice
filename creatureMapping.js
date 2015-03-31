//Domain = input
//range = output

/*=============================================================================
Species Map:
	Creates a chart that plots species on the world through time.
=============================================================================*/
var urlPlaceHolder = "###";
var gbifSpecies = "http://api.gbif.org/v1/species/search?q=" + urlPlaceHolder;

var gbifOccurance = "http://api.gbif.org/v1/occurrence/search?scientificname=" + urlPlaceHolder + "&hasCoordinate=true";

var eolIDLookup =  "http://eol.org/api/search/1.0.json?q=" + urlPlaceHolder + "&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl=";

//with this api, we are mostly just grabbing year of appearance for a given species
var eolTraits = "http://www.eol.org/api/traits/" + urlPlaceHolder + '/';

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
			
			creaturesInstanced: false,
			
			clusterScale: d3.scale.linear().clamp(true),
			clusterPerSpecie: 10,
			clusterRange: [0, 10],
			clusterDomain: [0, 100],
			
			//a list of all species (from SpeciesList.data)
			//for the current time period.
			//this is the list of species to draw on screen
			currentTimePeriod: null,
			
			clusterPoints: function(inLocations, radius) {
				//all locations start off ungrouped
				var unGrouped = inLocations.slice();
				var groups = [];
				
				
				unGrouped.forEach(function(unGroup) {
					
					var canGroup = groups.filter(function(g) {
						return Math.abs(unGroup.x - g.start.x) < radius && Math.abs(unGroup.y - g.start.y) < radius;
					});
					
					//a group exists for this ungrouped element
					if(canGroup.length > 0) {
						canGroup[0].data.push(unGroup);
						
					} else {
						//otherwise, make a new group
						groups.push({start: unGroup, data: []});
					}
				});
				return groups;
			},
			//Searches EOL database for the years a specie
			//was alive between
			eolGetSpecieYears: function (specie, doneCB) {
				var url = eolTraits.replace(urlPlaceHolder, specie.id);
				console.log(url);
				$.ajax({
					url: url,
					dataType: "jsonp",
					success: function (data) {	
						//first grab the traits that actually has the year values
						var dates = data["@graph"].filter(function(d) {
							var param = d["dwc:measurementValue"];
							return  param && typeof(param) == 'string';
						});

						//get years in which creature existed  
						var first = d3.max(dates, function(d) {
							return d["dwc:measurementValue"];
						});

						var last = d3.min(dates, function(d) {
							return d["dwc:measurementValue"]; 
						});
						//store the dates back to the species
						specie.dates = [first, last];				
						if(doneCB) doneCB(specie);
						
					}	
				});
			},
			
			//get the scientific name for a specie from the GBIF database
			gbifGetScientificName: function(specie, doneCB) {
				//then we need to look up the scientific name for the species
				var url = gbifSpecies.replace(urlPlaceHolder, specie.name);
				console.log(url);
				$.ajax({
					url: url,
					dataType: "json",
					success: function(data) {	
						specie.scientificName = data.results[0].canonicalName;
						if(doneCB)doneCB(specie);
					}
				});
			},
			
			//gets the location for all the occurances of remains in 
			gbifGetOccurances: function(specie, offset, limit, doneCB) {
				var url = gbifOccurance.replace(urlPlaceHolder, specie.scientificName) + "&limit=" + limit + "&offset=" + offset;
				console.log(url);
				//and here we'll grab the location data
				$.ajax({
					url: url,
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
						specie.locations = specie.locations.concat(locations);
						if(doneCB) {
							doneCB(specie, data.count, offset, limit);
						}
							
					}
				});					
			},
			
			
			
			fetchCreatureData: function(specie) {
				var offset = 0, limit = 300;
				
				function getOccurances(s, o, l) {
					
					instance.gbifGetOccurances(s, o, l, function(z, count, curOffset, curLimit){
						//we are on the last page
						if(curOffset + curLimit >= count) {
							specie.clusters = [instance.clusterPoints(s.locations, 10),
											   instance.clusterPoints(s.locations, 9),
											   instance.clusterPoints(s.locations, 8),
											   instance.clusterPoints(s.locations, 7),
											   instance.clusterPoints(s.locations, 6),
											   instance.clusterPoints(s.locations, 5),
											   instance.clusterPoints(s.locations, 4),
											   instance.clusterPoints(s.locations, 3),
											   instance.clusterPoints(s.locations, 2),
											   instance.clusterPoints(s.locations, 1),
											   instance.clusterPoints(s.locations, 0.7)
											  ];
							return;
						} else {
							//otherwise, lets keep going
							curOffset += curLimit;
							getOccurances(s, curOffset, curLimit);
						}
					});	
				}
				
				(function(z) {
					instance.eolGetSpecieYears(z, function(){
						instance.gbifGetScientificName(z, function(){
							getOccurances(z, 0, 300);	
						});
					});
				})(specie);
			},
			
			
			
			
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
				/*d3.select("#xaxis").attr("transform", "translate(" +
					translation[0] + ", " + parseFloat(self.chartScaler.yScale(0) + translation[1]) + ")")
					.call(self.chartScaler.xAxis);

				d3.select("#yaxis").attr("transform", "translate(" +
					parseFloat(self.chartScaler.xScale(0) + translation[0]) + "," + translation[1] + ")")
					.call(self.chartScaler.yAxis);
				*/
				
				self.svgBG.selectAll(".scaledData")
					.attr('x', function(d) {
						return instance.chartScaler.xScale(d.x[0]) + translation[0];
					})
					.attr('y', function(d) {
						return instance.chartScaler.yScale(d.y[0]) + translation[1];
					})
					.attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(d.width[0]); })
					.attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(d.height[0]); })
					.on('click', function(d) { 
						currentSelection = this;
						currentSelectionObject = d;
					})
					.each(function(d) {		
						addContinent(this, d);
						//var rotation = "rotate(" + d.Rotation + " "	+ (d.width/2) + " " + (d.height/2) + ")";
						//var img = d3.select(this).select("image").attr("transform", rotation);
					});
                
				
					//clear all creatures
					/*instance.svgBG.selectAll("creatures").each(function(c) {
						c.this.remove();
					});*/
				
					//loop through all the species

				
				
					self.svgBG.selectAll(".creature")
					.attr('x', function(d) {
						d.drawX = instance.chartScaler.xScale(d.x) + translation[0];
						return d.drawX;
					})
					.attr('y', function(d) {
						d.drawY = instance.chartScaler.yScale(d.y) + translation[1];
						return d.drawY;
					})
					.attr("width", function(d) { return d.width; })
					.attr("height", function(d) { return d.height; })
					.on('click', function(d) { 
						currentSelection = this;
						currentSelectionObject = d;
					})
					.each(function(d) {		
						if ( d.drawX < -d.width || d.drawX > instance.width ||
							 d.drawY < -d.height || d.drawY > instance.height) {
							
							if( d.this.style("display") != "block") return;

							d.this.transition().style("opacity", "0.0").each("end", function() {
								d.this.style("display", "none");
							});
							
						}
						else  {
							if( d.this.style("display") != "none") return ;
							d.this.style("display", "block");
							d.this.transition().style("opacity", "1.0");
						}				
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
						.attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(d.width[0]); })
						.attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(d.height[0]);})
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
				
				
				//Runs through all our species in our list
				//and fetches the data online.
				SpeciesList.data.forEach(function(d) {
					//Go through all species and get the data from the gbif api
					(function(specie) {
						instance.fetchCreatureData(specie);
					})(d);
				});
			},
			
			/*
				Takes in a species and creates all the svg's associated
				with the remains of that creature, and the locations of 
				those remains.
				
				Specie is formatted to that of an element in the SpeciesList.data
				array.
			*/
			createCreature: function(specie) {
				var translation = instance.zoomHandler.offset;
				var clusterNum = parseInt(instance.clusterScale(instance.zoomHandler.zoom));
				
				var idNum = 0;
				var creatures = instance.svgBG.selectAll("creature")
					.data(specie.clusters[clusterNum]).enter().append("svg")
					.attr("id", function(d) {
						var id = "creatureID" + idNum;
						d.cssID = "#" + id;
						idNum += 1;
						return id;
					})
					.attr("class", function(d) {
						return "creature " + specie.name.replace(' ', '');
					})
					.each(function(d) {
						d.this = instance.svgBG.select( d.cssID);
						d.name = specie.name;
						d.x = parseFloat(d.start.x);
						d.y = parseFloat(d.start.y);
						//console.log(d);
						d.width = 50;
						d.height = 50;
					})
					.style("display", "block")
					.attr("preserveAspectRatio", "none")
					.attr('x', function(d) {
						return instance.chartScaler.xScale(d.x) + translation[0];
					})
					.attr('y', function(d) {
						return instance.chartScaler.yScale(d.y) + translation[1];
					})
				
					//link the image up to the creature
					.append("image")
					.attr("xlink:href", function(d){
						return iconFolder + '/' + specie.name.replace(' ', '') + '.png';
					})
					.attr("width", "50px")
					.attr("height", "50px")
					.attr("preserveAspectRatio", "none");	
			},
			
			clearCreatures: function(d) {
				instance.svgBG.selectAll(".creature").remove();
			},
			
			/*
				Updates which creatures to draw for a given year.
				If the creature already has an svg element created for it,
				a new one is not created. 
				
				If a creature ceases to exist before or after a certain year,
				their svg elements are remove.
				
				If a creature comes into existance in the year, an svg element
				is created for it.
			*/
			updateCreatures: function(year) {
				instance.currentTimePeriod = SpeciesList.data.filter(function(c) {
					return (year < c.dates[0] && year > c.dates[1]);
				});
				
				var toCreate = instance.currentTimePeriod.slice();
				instance.svgBG.selectAll(".creature").remove();
				/*//clear out the creatures that no longer exist
				instance.svgBG.selectAll(".creature").each(function(d) {
					
					var filter = instance.currentTimePeriod.filter(function(c) {
						return d.name == c.name;
					});
					
					//creature no longer needs to be display
					if(!filter.length) {
						instance.svgBG.selectAll('.' + d.name.replace(' ', '')).remove();
					} else {
						//creature already exists, so remove it from our creation stack
						toCreate = toCreate.filter(function(z) {
							return z.name != filter[0].name;
						});
					}
				});*/
				
				//and re-create new ones
				toCreate.forEach(function(c) {
					setTimeout(function() {
						instance.createCreature(c);
					}, 50);
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
				
				if (!instance.creaturesInstanced) {
					instance.creaturesInstanced = true;
					setTimeout(function(){
							instance.updateCreatures(currentSliderVal);
							instance.creaturesInstanced = false;
					}, 1000);	
				}
				

				
				if (currentSliderVal != previousSliderVal) {
					if (count == 10) {
						previousSliderVal = currentSliderVal;
						count = 0;
						//instance.updateCreatures(currentSliderVal);
					}
					else
						count++;

					//This is up here for debugging purposes only - This section will be moved down after
					d3.select(continent).attr('x', instance.chartScaler.xScale(continentObject.x[0]) + instance.zoomHandler.offset[0]);
					d3.select(continent).attr('y', instance.chartScaler.yScale(continentObject.y[0]) + instance.zoomHandler.offset[1]);
					var rotation = "rotate(" + continentObject.rot[0] + " "	+ (continentObject.width[0]/2) + " " + (continentObject.height[0]/2) + ")";
					d3.select(continent).select("svg").attr("transform", rotation);
					d3.select(continent).attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(continentObject.width[0]); });
					d3.select(continent).attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(continentObject.height[0]); });

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
		var currentSliderVal = -slider.value();
		switch (e.key){
			case ("w"):
				currentSelectionObject.y[0] += 1;
				debugMoveContinent();
				break;
			case ("s"):
				currentSelectionObject.y[0] -= 1;
				debugMoveContinent();
				break;
			case ("a"):
				currentSelectionObject.x[0] -= 1;
				debugMoveContinent();
				break;
			case ("d"):
				currentSelectionObject.x[0] += 1;
				debugMoveContinent();
				break;
			case ("q"):
				currentSelectionObject.rot[0] -= 1;
				debugMoveContinent();
				break;
			case ("e"):
				currentSelectionObject.rot[0] += 1;
				debugMoveContinent();
				break;
			case ("z"):
				currentSelectionObject.width[0] -=1;
				currentSelectionObject.height[0] -=1;
				debugMoveContinent();
				break;
			case ("c"):
				currentSelectionObject.width[0] += 1;
				currentSelectionObject.height[0] += 1;
				debugMoveContinent();
				break;
			case ("p"):
				//Late Triassic Period
				if (currentSliderVal <= 227 && currentSliderVal > 205) {
					debugPrintContinent(6, 7);
				}
				//Early Jurassic Period
				else if (currentSliderVal <= -205 && currentSliderVal > 180) {
					debugPrintContinent(5, 6);
				}
				//Middle Jurassic Period
				else if (currentSliderVal <= 180 && currentSliderVal > 159) {
					debugPrintContinent(4, 5);
				}
				//Late Jurassic Period
				else if (currentSliderVal <= 159 && currentSliderVal > 144) {
					debugPrintContinent(3, 4);
				}
				//Early Cretaceous Period
				else if (currentSliderVal <= 144 && currentSliderVal > 98) {
					debugPrintContinent(2, 3);
				}
				//Late Cretaceous Period
				else if (currentSliderVal <= 98 && currentSliderVal > 65) {
					debugPrintContinent(1, 2);
				}
				//Present Day - Index[1] - Index[0]
				else if (currentSliderVal <= 65 && currentSliderVal >= 0) {
					debugPrintContinent(0, 1);
				}
		}
	});

	function debugPrintContinent(indexOne, indexTwo) {
		console.log("Continent: " + currentSelectionObject.continent +
					"\nX: " + CalculateSliderPosition(65, 0, currentSliderVal, currentSelectionObject.x[indexOne], currentSelectionObject.x[indexTwo]) + 
					"\nY: " + CalculateSliderPosition(65, 0, currentSliderVal, currentSelectionObject.y[indexOne], currentSelectionObject.y[indexTwo]) +
					"\nHeight: " + CalculateSliderPosition(65, 0, currentSliderVal, currentSelectionObject.height[indexOne], currentSelectionObject.height[indexTwo]) +
					"\nWidth: " + CalculateSliderPosition(65, 0, currentSliderVal, currentSelectionObject.width[indexOne], currentSelectionObject.width[indexTwo]) +
					"\nRotation: " + CalculateSliderPosition(65, 0, currentSliderVal, currentSelectionObject.rot[indexOne], currentSelectionObject.rot[indexTwo]));
	}

	function debugMoveContinent() {
		d3.select(currentSelection).attr('x', instance.chartScaler.xScale(currentSelectionObject.x[0]) + instance.zoomHandler.offset[0]);
		d3.select(currentSelection).attr('y', instance.chartScaler.yScale(currentSelectionObject.y[0]) + instance.zoomHandler.offset[1]);
		var rotation = "rotate(" + currentSelectionObject.rot[0] + " "	+ (currentSelectionObject.width[0]/2) + " " + (currentSelectionObject.height[0]/2) + ")";
		d3.select(currentSelection).select("image").attr("transform", rotation);
		d3.select(currentSelection).attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(currentSelectionObject.width[0]); });
		d3.select(currentSelection).attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(currentSelectionObject.height[0]); });
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
				instance.zoomHandler.zoomScale(1, 16);
				
				
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
					if (!instance.creaturesInstanced) {
						instance.creaturesInstanced = true;
						setTimeout(function(){
								instance.updateCreatures(currentSliderVal);
								instance.creaturesInstanced = false;
						}, 50);	
					}
					instance.svgBG.selectAll("text").attr("display", "block");
				});

				instance.zoomHandler.onZoom(function(e) {
					instance.draw(e.offset, e.zoom);
				});
				
				var temp = d3.select("#svgSurface").node().getBoundingClientRect();
				instance.chartScaler = ChartScaler.init({
					xRange: [0, temp.width],
        			yRange: [0, temp.height],
					xDomain: [-179, 179],
					yDomain: [90, -90],
					cLatDomain:[0, 180],
					cLonDomain:[0, 360],
					cLatRange:[0, temp.height],
					cLonRange:[0,temp.width]
    			});
				
				
				//fix up clustering for species
				
				instance.clusterDomain = [instance.zoomHandler.minZoom, instance.zoomHandler.maxZoom];
				instance.clusterScale.domain(instance.clusterDomain).range(instance.clusterRange);
			}
			return instance;
		}
	}
})();
