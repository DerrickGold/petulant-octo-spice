/*=============================================================================
Species Map:
	Creates a chart that plots species on the world through time.
=============================================================================*/
var iconFolder = "creatureIcons/";
var dataFolder = "data/"
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
			dbAccessor: DataBaseAPI.init(),
    		chartScaler: null,
			
			cullMax: 300,
			
			divSelector: null,
			specieIconSelector: ".creature",
			
			//SVG surfaces
			svgDisplay: null,
			svgLayers: null,
			
			continents: null,
			continentMM: null, //minimap continents
			viewPortMM: null, //viewport on minimap
		
			creaturesInstanced: false,
			creatureInstantiatedList: [],
			creatureCache: null,
				
			
			//A list of all species (from SpeciesList.data) for the current time period. This is the list of species to draw on screen
			currentTimePeriod: null,
			
			//Our main initial species list from file
			speciesList: {},
			customSpeciesList: [],
			
			
			
			clusterScale: d3.scale.linear().clamp(true),
			clusterPerSpecie: 10,
			clusterRange: [0, 10],
			clusterDomain: [0, 100],
			
			//Keeps track of the largest count of locations for a given specie this is used for statistics and graphing
			mostLocations: 0,

			//Country to continent list
			countryToContinent: null,
			
			//Set up callback system for creature clicking
			_onCreatureClick: null,
			onCreatureClick: function(v) {
				instance._onCreatureClick = function(e, s) {
					v(e, s);	
				}
			},
			
			//Set up callback system for when creatures are
			//Instantiating
			_onCreatureStartUpdate: null,
			onCreatureStartUpdate: function(v) {
				instance._onCreatureStartUpdate = function(e, s) {
					v(e, s);
				}
			},
			//Set up callback for when a creature is instantiated
			_onCreatureUpdate: null,
			onCreatureUpdate: function(v) {
				instance._onCreatureUpdate = function(e, s) {
					v(e, s);
				}
			},		
			//Set up callback for when a creature is instantiated
			_onStatisticsUpdate: null,
			onStatisticsUpdate: function(v) {
				instance._onStatisticsUpdate = function(e, s) {
					v(e, s);
				}
			},			
			//Set up callback system for when creatures are instantiating
			_onSpecieFetched: null,
			onSpecieFetched: function(v) {
				instance._onSpecieFetched = function(e, s) {
					v(e, s);
				}
			},	
			
			//Set up callback system for when the year is changed
			_onYearChanged: null,
			onYearChanged: function(v) {
				instance._onYearChanged = function(e, s) {
					v(e, s);
				}
			},	
			
			//Set up callback system for when the year is changed
			_onCreatureRightClick: null,
			onCreatureRightClick: function(v) {
				instance._onCreatureRightClick = function(e, s) {
					v(e, s);
				}
			},	
			
			//Generate an object with overall statistics for the visualization
			getStatistics: function() {
				return {
					maxRemains: instance.mostLocations
				};
			},
			
			//Finds an anchor point for a cluster to a specific continent
			findContinentAnchor: function(specieCluster) {
				var continent = instance.continentData.map(function(c) {
					var continentScreenX = parseInt(instance.chartScaler.xScale(c.x[0])),
						continentWidth = parseInt(instance.chartScaler.ContinentScaleLon(c.width[0]));

					var continentScreenY = parseInt(instance.chartScaler.yScale(c.y[0])),
						continentHeight = parseInt(instance.chartScaler.ContinentScaleLat(c.height[0]));								


					var creatureX = parseInt(instance.chartScaler.xScale(specieCluster.x)),
						creatureY = parseInt(instance.chartScaler.yScale(specieCluster.y));

					
					var x2 = continentScreenX + (continentWidth/2);
					var y2 = continentScreenY + (continentHeight/2);
					
					var distance = Math.pow(creatureX - x2, 2) + Math.pow(creatureY - y2, 2);

					return {
						dist: distance,
						name: c.continent,
						anchorX: specieCluster.x - c.x[0],
						anchorY: specieCluster.y - c.y[0],
						cData: c			
					}

				});

				var continentKeys = Object.keys(instance.countryToContinent);
				continentKeys.forEach(function(name) {
					//console.log(instance.countryToContinent[name]);
					if (specieCluster.country == name)
					{
						var i;
						for (i = 0; i < continent.length; i++) {
							if (continent[i].name == instance.countryToContinent[name] + ".png")
								continent[i].dist = 0;
						}
					}
				})

				//Return the closest continent
				return continent.sort(function(a, b) {
					return a.dist - b.dist;	
				})[0];
	
			},
			clusterPoints: function(inLocations, radius) {
				//All locations start off ungrouped
				var unGrouped = inLocations.slice();
				var groups = [];
				
				
				unGrouped.forEach(function(unGroup) {
					
					var canGroup = groups.filter(function(g) {
						return Math.abs(unGroup.x - g.start.x) < radius && Math.abs(unGroup.y - g.start.y) < radius;
					});
					
					//A group exists for this ungrouped element
					if(canGroup.length > 0) {
						canGroup[0].inCluster.push(unGroup);
						
					} else {
						
						//For the group, find the anchor point
						var anchor = instance.findContinentAnchor(unGroup);

						//otherwise, make a new group
						groups.push({start: unGroup, inCluster: [unGroup], continent: anchor});
					}
				});
				return groups;
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
				instance.draw(this.zoomHandler.offset, this.zoomHandler.zoom);	
			},

			drawMiniMap: function(translation, scale) {
				CalculateIndexes();
				var currentSliderVal = -slider.value();
				//Updating minimap is low importance, so just update every so often
				if(instance._updateMinimap) return;
				instance._updateMinimap = true;
				
				setTimeout(function() {
					instance._updateMinimap = false;
					instance.continentMM					
						.attr('x', function(d) {
							d.xPos = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.x[firstIndex], d.x[secondIndex]);
							return instance.chartScaler.xScale(d.xPos);
						})
						.attr('y', function(d) {
							d.yPos = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.y[firstIndex], d.y[secondIndex]);
							return instance.chartScaler.yScale(d.yPos);
						})
						.attr("width", function(d) {
							d.newWidth = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.width[firstIndex], d.width[secondIndex]);
							return instance.chartScaler.ContinentScaleLon(Math.abs(d.newWidth)) + "px";
						})
						.attr("height", function(d) {
							d.newHeight = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.height[firstIndex], d.height[secondIndex]);
							return instance.chartScaler.ContinentScaleLat(Math.abs(d.newHeight)) + "px";
						})
						.each(function(d) {
							var img = d3.select(this).select("image");
								img.attr("transform", function(d) {
								var posX = instance.chartScaler.xScale(d.xPos);
								var posY = instance.chartScaler.yScale(d.yPos);
								var newRot = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.rot[firstIndex], d.rot[secondIndex]);
								var rotation = "rotate(" + newRot  +")";
								return rotation;
							});

						});	
					
					//Once zoomed in, draw a square around the view port
					if(scale > 1) {
						if(!instance.viewPortMM) {
							instance.viewPortMM = instance.svgLayers["minimap"].append("rect")
														.attr("id", "viewport");
						
						}
						
						instance.viewPortMM
							.attr("width", instance.width/scale)
							.attr("height", instance.height/scale)
							.attr("x", -translation[0]/scale)
							.attr("y", -translation[1]/scale);
						
					} else {
						if(instance.viewPortMM) instance.viewPortMM.remove();
						instance.viewPortMM = null;
					}
				}, 20);
			},
			
		/*=====================================================
		Draw
		=====================================================*/
			draw: function(translation, scale) {
				var self = this;
				instance.chartScaler.scale(scale);
				
				//This handles panning and zooming for background
				instance.svgLayers["background"]
					.attr("viewBox", function() {
						return (-translation[0]/scale) + " " + (-translation[1]/scale)
								 + " " + (instance.width /scale) + " " + (instance.height / scale);
					});

				CalculateIndexes();
				var currentSliderVal = -slider.value();
				instance.continents
					.attr('x', function(d) {
						d.xPos = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.x[firstIndex], d.x[secondIndex]);
						return instance.chartScaler.xScale(d.xPos);
					})
					.attr('y', function(d) {
						d.yPos = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.y[firstIndex], d.y[secondIndex]);
						return instance.chartScaler.yScale(d.yPos);
					})
					.attr("width", function(d) {
						d.newWidth = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.width[firstIndex], d.width[secondIndex]);
						return instance.chartScaler.ContinentScaleLon(d.newWidth) + "px";
					})
					.attr("height", function(d) {
						d.newHeight = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.height[firstIndex], d.height[secondIndex]);
						return instance.chartScaler.ContinentScaleLat(d.newHeight) + "px";
					})
					.each(function(d) {
						var continentRotation;
						d3.select(this).select("image").attr("transform", function(d) {
							var posX = instance.chartScaler.xScale(d.xPos);
							var posY = instance.chartScaler.yScale(d.yPos);
							var newRot = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, d.rot[firstIndex], d.rot[secondIndex]);
							var rotation = "rotate(" + newRot  +")";
							continentRotation = newRot;
							return rotation;
						});
						d.continentRotation = continentRotation;
					});
				
				instance.drawMiniMap(translation, scale);
				//Loop through all the species
				if(!instance.creatureCache)
					instance.creatureCache = instance.svgLayers["creatures"].selectAll(instance.specieIconSelector);
				
				instance.creatureCache
					.attr('x', function(d) {
						var anchoredX = d.continent.cData.xPos + (d.continent.anchorX * (d.continent.cData.newWidth / d.continent.cData.width[0]));
						d.drawX = (instance.chartScaler.specieXScale(anchoredX) + translation[0]);// * (d.continent.cData.newWidth / d.continent.cData.width[0]);
						return d.drawX;
					})
					.attr('y', function(d) {
						var anchoredY = d.continent.cData.yPos + (d.continent.anchorY * (d.continent.cData.newHeight / d.continent.cData.height[0]));
						d.drawY = (instance.chartScaler.specieYScale(anchoredY) + translation[1]);// * (d.continent.cData.newHeight / d.continent.cData.height[0]);
						return d.drawY;
					})
					.each(function(d) {
						d3.select(this).select("image").attr("transform", function(d) {
							var rotAroundX = -(d.continent.anchorX * (d.continent.cData.newWidth / d.continent.cData.width[0])) * 2 * scale;
								//(-d.continent.anchorX * 2 * scale);// * (d.continent.cData.newWidth / d.continent.cData.width[0]);
							var rotAroundY = (d.continent.anchorY * (d.continent.cData.newHeight / d.continent.cData.height[0])) * 2 * scale;
								//(d.continent.anchorY * 2 * scale);// * (d.continent.cData.newHeight / d.continent.cData.height[0]);
							var rotation = "rotate(" + d.continent.cData.continentRotation + ", " + rotAroundX  + ", " + rotAroundY + ")";
							return rotation;
						});
					});
			},
			
		/*=====================================================
		Load data
		=====================================================*/
			createContinents: function(layer, path, dataset) {
				var creature = instance.svgLayers[layer].selectAll()
					.data(dataset).enter()
					.append("svg")
					.attr("class", "scaledData")
					.attr("display", "inline-block")
					.attr("overflow", "visible")
					.each(function(d) {		
						 addContinent(this, d);
						d.xPos = d.x[0];
						d.xPos = d.y[0];
						d.drawWd = d.width[0];
						d.drawHt = d.height[0];
					})
					//Do not comment this out for now - this is used to be able to click on continents and manually move them around
					.on('click', function(d) { 
						currentSelection = this;
						currentSelectionObject = d;
					})
					.attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(d.width[0]) + "px"; })
					.attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(d.height[0]) + "px";})
					.attr("preserveAspectRatio", "none")
					.attr("transform", function(d) { return d.rotation; })
					.attr("primitiveUnits", "userSpaceOnUse")
					
				creature.append("g").append("image")
					.attr("xlink:href", function(d){
						return path + '/' + d.continent;
					})
					.attr("width", "100%")
					.attr("height", "100%")
					.attr("preserveAspectRatio", "none");
				
				return creature;
			},
			
			loadData: function(fn) {
				d3.json(dataFolder + "continents.json", function(e, dataset) {
					var path = dataset.path;
					dataset = dataset.data;
					instance.continentData = dataset;
					
					instance.continents = instance.createContinents("background", path, dataset);
					instance.continentMM = 	instance.createContinents("minimap", path, dataset);
					instance.draw(instance.zoomHandler.offset, instance.zoomHandler.zoom);
				});
				
				d3.json(dataFolder + "countrys.json", function(e, d) {
					instance.countryToContinent = d;
				});

				d3.json(dataFolder + "species.json", function(e, species) {
				//Runs through all our species in our list and fetches the data online.
					instance.speciesList = species;
					instance.speciesList.data.forEach(function(d) {
						//Go through all species and get the data from the gbif api
						(function(specie) {
							instance.dbAccessor.fetchCreatureData(specie, function(s){
								//Keep track of the max number of locations for a species
								if(specie.locations.length > instance.mostLocations) {
									instance.mostLocations = specie.locations.length;
									var statistics = instance.getStatistics();
									if(instance._onStatisticsUpdate) 
										instance._onStatisticsUpdate(null, statistics);
								}
								s.clusters = [instance.clusterPoints(s.locations, 10),
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
								if(instance._onSpecieFetched)
									instance._onSpecieFetched(null, specie);
								setTimeout(function() {
									specie.dataFetched = true;
									$(instance.divSelector).trigger("NewCreatureReady", [specie]);
								}, 10);
							});
						})(d);
					});
					
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
				if(!specie.clusters) return;
				
				var translation = instance.zoomHandler.offset;
				var clusterNum = parseInt(instance.clusterScale(instance.zoomHandler.zoom));
				
				var idNum = 0;
				var creatures = instance.svgLayers["creatures"].selectAll()
					.data(specie.clusters[clusterNum]).enter()
					.append("svg")
					.attr("class", function(d) {
						return "creature " + specie.name.replace(' ', '');
					})
					.each(function(d) {
						d.id = specie.id;
						d.clusterNum = clusterNum;
						d.this = d3.select(this);
						d.name = specie.name;
						d.x = parseFloat(d.start.x);
						d.y = parseFloat(d.start.y);
						//console.log(d);
						d.width = 50;
						d.height = 50;
						if(specie.description)
							d.description = specie.description.description;
						
						d.scientificName = specie.scientificName;
						d.gbifID = specie.gbifID;
					})
					.attr('x', function(d) {
						var anchoredX = d.continent.cData.xPos + (d.continent.anchorX * (d.continent.cData.newWidth / d.continent.cData.width[0]));
						d.drawX = (instance.chartScaler.specieXScale(anchoredX) + translation[0]);// * (d.continent.cData.newWidth / d.continent.cData.width[0]);
						return d.drawX;
					})
					.attr('y', function(d) {
						var anchoredY = d.continent.cData.yPos + (d.continent.anchorY * (d.continent.cData.newHeight / d.continent.cData.height[0]));
						d.drawY = (instance.chartScaler.specieYScale(anchoredY) + translation[1]);// * (d.continent.cData.newHeight / d.continent.cData.height[0]);
						return d.drawY;
					})
					.attr("width", "50px")
					.attr("height", "50px")
					.attr("overflow", "visible")
                    .on('click', function(d, e) {
						if(instance._onCreatureClick){
							instance._onCreatureClick(d3.select(this), d);
						}
					})
					.on('contextmenu', function(d) {
						d3.event.preventDefault();	
						if(instance._onCreatureRightClick)
							instance._onCreatureRightClick(null, d);
					})
					.attr("display", function() {
						if(specie.hide) return "none";
						return "block";
					})
					//Link an image up to the creature
					.append("image")
					.attr("xlink:href", function(d){
						return iconFolder + specie.name.replace(' ', '') + '.png';
					})
					.attr("width", "50px")
					.attr("height", "50px")
					.attr('x', "-25px")
					.attr('y', "-25px")
					.attr("preserveAspectRatio", "none")
					.attr("title", specie.name)
					.each(function(d) {
						d3.select(this).attr("transform", function(d) {
							var rotAroundX = -d.continent.anchorX * 2 * instance.zoomHandler.zoom;
							var rotAroundY = d.continent.anchorY * 2 * instance.zoomHandler.zoom;
							var rotation = "rotate(" + d.continent.cData.continentRotation + ", " + rotAroundX + ", " + rotAroundY + ")";
							return rotation;
						});
					});
				return creatures;
			},
			
			clearCreatures: function(d) {
				if(!instance.creatureCache) return;
				instance.creatureCache.remove();
				instance.creatureCache = null;
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
				if(!instance.currentTimePeriod) return;
				instance.clearCreatures();
				//and re-create new ones
				instance.currentTimePeriod.forEach(function(c) {
					instance.createCreature(c);
				});	
			},			
			
			instantiateAllCreatures: function (cb) {
				if (!instance.creaturesInstanced) {
					instance.creaturesInstanced = true;
					setTimeout(function(){
						instance.updateCreatures(-slider.value());
						instance.creaturesInstanced = false;
						if(cb) cb();	
					}, 10);	
				}
			},
			

			updateCreatureListing: function(year) {
				if(instance._onCreatureStartUpdate)
					instance._onCreatureStartUpdate(null, null);
				
				var list = null;
				if(!instance.customSpeciesList.length) 
					list = instance.speciesList.data;
				else
					list = instance.customSpeciesList;
				
				//instance.creatureInstantiatedList
				instance.currentTimePeriod = list.filter(function(c) {
					
					var id = String(c.id);
					if(c.dataFetched  && ((c.dates && year < c.dates[0] && year > c.dates[1]) || instance.customSpeciesList.length)) {
						//only recreate creatures as their timeline shifts
						if(!instance.creatureInstantiatedList[id]) {
							if(instance._onCreatureUpdate) instance._onCreatureUpdate(true, c);
							instance.creatureInstantiatedList[id] = c;
							var newCreatures = instance.createCreature(c);
							instance.creatureCache = null;
						}
						
						
						return true;
					} else {
						//only remove creatures that should no longer exist
						if(instance.creatureInstantiatedList[id]) {
							instance.creatureInstantiatedList[id] = false;
							d3.selectAll("." + c.name.replace(' ', '')).remove();
							instance.creatureCache = null;
						}
						if(instance._onCreatureUpdate) instance._onCreatureUpdate(false, c);
						c.hide = false;  
					}
				});			
				
			},

			moveContinent: function(continent, continentObject) {
				if(instance._movingContinents) return;
				instance._movingContinents = true;
				setTimeout(function() {
					instance._movingContinents = false;
					instance.updateCreatureListing(-slider.value());
					if(instance._onYearChanged) instance._onYearChanged(null, -slider.value());
					instance.redraw();
				}, 30);
			},
			
			toggleSpecie: function(specieID) {
				if(instance.creatureInstantiatedList[String(specieID)]) {
					var specie = instance.creatureInstantiatedList[String(specieID)];
					specie.hide = !specie.hide;
					
					d3.selectAll('.' + specie.name.replace(' ' , '')).attr("display", function(){ 
						if(specie.hide) return "none";
						return "block";
					});
				}
			},
			
			addToCustomSpecieList: function(specieID, cb) {
				//check if specie is already in list
				var check = instance.customSpeciesList.filter(function(c) {
					return parseInt(c.id) == parseInt(specieID);
				});
				if(check.length) return;
				
				
				var specie = instance.speciesList.data.filter(function(c) {
					return parseInt(c.id) == parseInt(specieID);
				})[0];
				
				instance.customSpeciesList.push(specie);
				if(cb)cb(specie);
			},
			
			clearCustomSpecieList: function() {
				instance.customSpeciesList = [];
				instance.updateCreatureListing(-slider.value());	
				instance.instantiateAllCreatures();
				if(instance._onYearChanged) instance._onYearChanged(null, -slider.value());
			},
			
			isUsingCustomSpecieList: function() {
				return (instance.customSpeciesList.length > 0) ? true : false;	
			},
			
			//with a custom list, we are displaying species regardless of their year
			//as well as 
			displayCustomList: function() {
				//reset all currently instantiated creatures
				instance.creatureInstantiatedList.forEach(function(i) {
					if(instance._onCreatureUpdate) instance._onCreatureUpdate(false, i);
					
					i.hide = false;
					instance.creatureInstantiatedList[String(i.id)] = false;
				});
				d3.selectAll(instance.specieIconSelector).remove();
				instance.updateCreatureListing(0);	
				instance.instantiateAllCreatures();
			}
		}
	}

	/****************************************************************************************************
	 * Description: This is for debugging purposes only. Allows us to move, rotate and scale the 		*
	 *				continents using WASD, QE and ZC respectively.										*
	 *				REMOVE THIS UPON COMPLETION OF THE PROJECT											*
	 * Syntax: --- (Automatically called when key is pressed on keyboard)								*
	 ****************************************************************************************************/
	window.addEventListener("keydown", function(e) {
		CalculateIndexes();
		var currentSliderVal = -slider.value();
		switch (e.key){
			case ("w"):
				currentSelectionObject.y[8] += 1;
				debugMoveContinent();
				break;
			case ("s"):
				currentSelectionObject.y[8] -= 1;
				debugMoveContinent();
				break;
			case ("a"):
				currentSelectionObject.x[8] -= 1;
				debugMoveContinent();
				break;
			case ("d"):
				currentSelectionObject.x[8] += 1;
				debugMoveContinent();
				break;
			case ("q"):
				currentSelectionObject.rot[8] -= 1;
				debugMoveContinent();
				break;
			case ("e"):
				currentSelectionObject.rot[8] += 1;
				debugMoveContinent();
				break;
			case ("z"):
				currentSelectionObject.width[8] -=1;
				debugMoveContinent();
				break;
			case ("x"):
				currentSelectionObject.width[8] += 1;
				debugMoveContinent();
				break;

			case ("c"):
				currentSelectionObject.height[8] -=1;
				debugMoveContinent();
				break;
			case ("v"):
				currentSelectionObject.height[8] += 1;
				debugMoveContinent();
				break;
			case ("r"):
				var allContinentObjects = debugGetContinentObjects();
				for (var i = 0; i < allContinentObjects.length; i++) {
					allContinentObjects[i].x[8] = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, allContinentObjects[i].x[firstIndex], allContinentObjects[i].x[secondIndex]);
					allContinentObjects[i].y[8] = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, allContinentObjects[i].y[firstIndex], allContinentObjects[i].y[secondIndex]);
					allContinentObjects[i].height[8] = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, allContinentObjects[i].height[firstIndex], allContinentObjects[i].height[secondIndex]);
					allContinentObjects[i].width[8] = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, allContinentObjects[i].width[firstIndex], allContinentObjects[i].width[secondIndex]);
					allContinentObjects[i].rot[8] = CalculateSliderPosition(sliderPosFirst, sliderPosSecond, currentSliderVal, allContinentObjects[i].rot[firstIndex], allContinentObjects[i].rot[secondIndex]);
				}
				break;
			case ("p"):
				debugPrintContinent(sliderPosFirst, sliderPosSecond, firstIndex, secondIndex);
				break;
			case ("o"):
				debugPrintAllContinents(sliderPosFirst, sliderPosSecond, firstIndex, secondIndex);
				break;
		}
	});

	/****************************************************************************************************
	 * Description: This is a helper function that simply prints out the details of the selected 		*
	 *				continent.																			*
	 *				REMOVE THIS FUNCTION UPON COMPLETION OF THE PROJECT									*
	 * Syntax: debugPrintContinent(sliderPosOne, sliderPosTwo, leftIndex, rightIndex);					*
	 ****************************************************************************************************/
	function debugPrintContinent(sliderPosOne, sliderPosTwo, indexOne, indexTwo) {
		var currentSliderVal = -slider.value();
		console.log("Continent: " + currentSelectionObject.continent +
					"\nX: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, currentSelectionObject.x[8], currentSelectionObject.x[8]) +
					"\nY: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, currentSelectionObject.y[8], currentSelectionObject.y[8]) +
					"\nWidth: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, currentSelectionObject.width[8], currentSelectionObject.width[8]) +
					"\nHeight: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, currentSelectionObject.height[8], currentSelectionObject.height[8]) +
					"\nRotation: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, currentSelectionObject.rot[8], currentSelectionObject.rot[8]));
	}

	/****************************************************************************************************
	 * Description: This is a helper function that simply prints out the details of all continents.		*
	 *				REMOVE THIS FUNCTION UPON COMPLETION OF THE PROJECT									*
	 * Syntax: debugPrintAllContinents(sliderPosOne, sliderPosTwo, leftIndex, rightIndex);				*
	 ****************************************************************************************************/
	function debugPrintAllContinents(sliderPosOne, sliderPosTwo, indexOne, indexTwo) {
		var currentSliderVal = -slider.value();
		var allContinentObjects = debugGetContinentObjects();
		for (var i = 0; i < allContinentObjects.length; i++) {
			console.log("Continent: " + allContinentObjects[i].continent +
						"\nX: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, allContinentObjects[i].x[8], allContinentObjects[i].x[8]) +
						"\nY: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, allContinentObjects[i].y[8], allContinentObjects[i].y[8]) +
						"\nWidth: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, allContinentObjects[i].width[8], allContinentObjects[i].width[8]) +
						"\nHeight: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, allContinentObjects[i].height[8], allContinentObjects[i].height[8]) +
						"\nRotation: " + CalculateSliderPosition(sliderPosOne, sliderPosTwo, currentSliderVal, allContinentObjects[i].rot[8], allContinentObjects[i].rot[8]));
		}
	}

	/****************************************************************************************************
	 * Description: This is a helper function that simply moves each continent per key press.			*
	 *				REMOVE THIS FUNCTION UPON COMPLETION OF THE PROJECT									*
	 * Syntax: debugPrintContinent();																	*
	 ****************************************************************************************************/
	function debugMoveContinent() {
		var posX = instance.chartScaler.xScale(currentSelectionObject.x[8]);// + instance.zoomHandler.offset[0];
		var posY = instance.chartScaler.yScale(currentSelectionObject.y[8]);// + instance.zoomHandler.offset[1];
		d3.select(currentSelection).attr('x', posX);
		d3.select(currentSelection).attr('y', posY);
		var rotation = "rotate(" + currentSelectionObject.rot[8] + ")";
		d3.select(currentSelection).select("image").attr("transform", rotation);
		d3.select(currentSelection).attr("width", function(d) { return instance.chartScaler.ContinentScaleLon(currentSelectionObject.width[8]); });
		d3.select(currentSelection).attr("height", function(d) { return instance.chartScaler.ContinentScaleLat(currentSelectionObject.height[8]); });
	}

	function CalculateIndexes() {
	    var currentSliderVal = -slider.value();
	    //Late Triassic Period (227 - 205) Goes back a little farther
	    if (currentSliderVal <= 250 && currentSliderVal > 205) {
	        sliderPosFirst = 250;
	        sliderPosSecond = 205;
	        firstIndex = 6;
	    }
	    //Early Jurassic Period
	    else if (currentSliderVal <= 205 && currentSliderVal > 180) {
	        sliderPosFirst = 205;
	        sliderPosSecond = 180;
	        firstIndex = 5;
	    }
	    //Middle Jurassic Period
	    else if (currentSliderVal <= 180 && currentSliderVal > 159) {
	        sliderPosFirst = 180;
	        sliderPosSecond = 159;
	        firstIndex = 4;
	    }
	    //Late Jurassic Period
	    else if (currentSliderVal <= 159 && currentSliderVal > 144) {
	        sliderPosFirst = 159;
	        sliderPosSecond = 144;
	        firstIndex = 3;
	    }
	    //Early Cretaceous Period
	    else if (currentSliderVal <= 144 && currentSliderVal > 98) {
	        sliderPosFirst = 144;
	        sliderPosSecond = 98;
	        firstIndex = 2;
	    }
	    //Late Cretaceous Period
	    else if (currentSliderVal <= 98 && currentSliderVal > 65) {
	        sliderPosFirst = 98;
	        sliderPosSecond = 65;
	        firstIndex = 1;
	    }
	    //Present Day - Index[1] - Index[0]
	    else if (currentSliderVal <= 65 && currentSliderVal >= 0) {
	        sliderPosFirst = 65;
	        sliderPosSecond = 0;
	        firstIndex = 0;
	    }
	    secondIndex = firstIndex + 1;
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
				
				instance.width = d3.select(instance.divSelector).node().getBoundingClientRect().width;
				instance.height =d3.select(instance.divSelector).node().getBoundingClientRect().height;
				
				instance.svgDisplay = d3.select(instance.divSelector).append("svg")
					.attr("id", "svgSurface")
					.attr("width", instance.width + "px")
					.attr("height", instance.height + "px")
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

						instance.redraw();
					}));
				//Create background and add axis to it
				instance.svgLayers = {
					"background": instance.svgDisplay.append("svg").attr("id", "svgBG"),
					"creatures": instance.svgDisplay.append("svg"),
					"foreground": instance.svgDisplay.append("svg"),
					"minimap": instance.svgDisplay.append("svg")
				};
				
				//Set up the minimap
				var scale = 0.2;
				var xPos = instance.width - (instance.width * scale);
				var yPos = instance.height - (instance.height * scale);
				instance.svgLayers["minimap"] = instance.svgLayers["minimap"]
					.attr("x", xPos)
					.attr("y", yPos)
					.append("g");
				
				instance.svgLayers["minimap"]
					.attr("transform", "scale(" + scale + ")")
					.attr("overflow", "hidden")
					.append("rect").attr("width", "100%").attr("height", "100%").attr("fill", "black");
							
				instance.zoomHandler.startZoom(function(e) {
				});

				instance.zoomHandler.endZoom(function(e) {
					instance.instantiateAllCreatures();
				});

				instance.zoomHandler.onZoom(function(e) {
					//setTimeout(function() {
					instance.draw(e.offset, e.zoom);
					//}, 10);
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
					cLonRange:[0,temp.width],
					
					specieXRange:[0, temp.width],
					specieYRange:[0, temp.height],
					specieXDomain: [-179,179],
					specieYDomain: [90, -90]
					
    			});

				//Fix up clustering for species
				instance.clusterDomain = [instance.zoomHandler.minZoom, instance.zoomHandler.maxZoom];
				instance.clusterScale.domain(instance.clusterDomain).range(instance.clusterRange);
			}
			
			$(instance.divSelector).on("NewCreatureReady", function(e, specie) {
				//console.log("trigger new creature!");
				//console.log(specie);
				instance.updateCreatureListing(-slider.value());
			});
			
			if(instance._onYearChanged) instance._onYearChanged(null, -slider.value());
			return instance;
		}
	}
})();
