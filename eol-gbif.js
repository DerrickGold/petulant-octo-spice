var DataBaseAPI = (function() {
	var instance;
	
/*
								var continent = instance.continentData.filter(function(c) {
									var continentScreenX = instance.chartScaler.xScale(c.x[0]),
										continentWidth = instance.chartScaler.ContinentScaleLon(c.width[0]);
									
									var continentScreenY = instance.chartScaler.yScale(c.y[0]),
										continentHeight = instance.chartScaler.ContinentScaleLat(c.height[0]);								
									
									
									var creatureX = instance.chartScaler.xScale(newData.x),
										creatureY = instance.chartScaler.yScale(newData.y);
									
									
									
									return (creatureX >= continentScreenX && creatureX <= continentScreenX + continentWidth &&
											creatureY >= continentScreenY && creatureY <= continentScreenY + continentHeight);
									
									
								});



*/
	
	
	
	function _init() {
		return {
			
			
			
			//Searches EOL database for the years a specie
			//was alive between
			eolGetSpecieYears: function (specie, doneCB) {
				var url = eolTraits.replace(urlPlaceHolder, specie.id);
				//console.log(url);
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
							return parseFloat(d["dwc:measurementValue"]);
						});

						var last = d3.min(dates, function(d) {
							return parseFloat(d["dwc:measurementValue"]); 
						});
						//store the dates back to the species
						//var oldFirst = first;
						//first = Math.max(first, last);
						//last = Math.min(oldFirst, last);
						
						specie.dates = [first, last];				
						if(doneCB) doneCB(specie);
						
					}	
				});
			},
			
			//get the scientific name for a specie from the GBIF database
			gbifGetScientificName: function(specie, doneCB) {
				//then we need to look up the scientific name for the species
				var url = gbifSpecies.replace(urlPlaceHolder, specie.name);
				//console.log(url);
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
				//console.log(url);
				//and here we'll grab the location data
				$.ajax({
					url: url,
					dataType: "json",
					success: function(data) {
						var locations = data.results.map(function(loc) {
							
								var continent = [null]
								var newData = {
									"x": loc.decimalLongitude,
									"y": loc.decimalLatitude,
									"continent": null
								};

						
								newData.continent = {
									all: continent,
									closest: continent[0],
								};		
								
								return newData;
						});
						
						locations = locations.filter(function(loc) {
							return (loc.x && loc.y);
						});
						
						//add all locations to the species	
						if (!specie.locations) specie.locations = [];
						specie.locations = specie.locations.concat(locations);
						if(doneCB) {
							doneCB(specie, data.count, offset, limit);
						}
							
					}
				});					
			},
			
			fetchCreatureData: function(specie, cb) {
				var offset = 0, limit = 300;
				
				function getOccurances(s, o, l) {
					
					instance.gbifGetOccurances(s, o, l, function(z, count, curOffset, curLimit){
						//we are on the last page
						if(curOffset + curLimit >= count) {
							if(cb) cb(specie);
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