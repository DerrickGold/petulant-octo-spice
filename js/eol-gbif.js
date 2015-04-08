var urlPlaceHolder = "###";
var gbifSpecies = "http://api.gbif.org/v1/species/search?q=" + urlPlaceHolder;
var gbifMatch = "http://api.gbif.org/v1/species/match?name=" + urlPlaceHolder;
var gbifOccurance = "http://api.gbif.org/v1/occurrence/search?scientificname=" + urlPlaceHolder + "&hasCoordinate=true";
var gbifDescriptions = "http://api.gbif.org/v1/species/" + urlPlaceHolder + "/descriptions";
var eolIDLookup =  "http://eol.org/api/search/1.0.json?q=" + urlPlaceHolder + "&page=1&exact=true&filter_by_taxon_concept_id=&filter_by_hierarchy_entry_id=&filter_by_string=&cache_ttl=";
//with this api, we are mostly just grabbing year of appearance for a given species
var eolTraits = "http://www.eol.org/api/traits/" + urlPlaceHolder + '/';
var pageIDURL = "http://en.wikipedia.org/w/api.php?action=query&titles=###&format=json&callback=?&redirects";
var wikiPageUrl = "http://en.wikipedia.org/w/api.php?action=parse&pageid=###&format=json&callback=?";
var header = { 'Api-User-Agent': 'Mozilla/5.0 (Windows NT 6.3; rv:36.0) Gecko/20100101 Firefox/36.0' };

var DataBaseAPI = (function() {
	var instance;
	
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
						if(!specie.scientificName) specie.scientificName = specie.name;
						specie.gbifID = data.results[0].key;
						
						//console.log(specie);
						//console.log(data);
						//specie.description = data.results[0].descriptions[0];
						if(doneCB)doneCB(specie);
					}
				});
			},
			
			//gets the location for all the occurances of remains in 
			gbifGetOccurances: function(specie, offset, limit, doneCB) {
				var url = gbifOccurance.replace(urlPlaceHolder, specie.scientificName) + "&limit=" + limit + "&offset=" + offset;
				//and here we'll grab the location data
				console.log(url);
				$.ajax({
					url: url,
					dataType: "json",
					success: function(data) {
						var locations = data.results.map(function(loc) {
							
								var continent = [null]
								var newData = {
									"remainType": loc.basisOfRecord,
									"x": loc.decimalLongitude,
									"y": loc.decimalLatitude,
									"media": loc.media,
									"country":loc.country,
									"longitude": loc.decimalLongitude,
									"latitude": loc.decimalLatitude,
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
							if(data.endOfRecords) {
								doneCB(specie, -1, offset, limit);
							} else {
								doneCB(specie, data.count, offset, limit);
							}
						}
							
					}
				
				});					
			},
			
			gbifGetDescription: function(specie, doneCB) {
				$.ajax({
					url: gbifDescriptions.replace(urlPlaceHolder, specie.gbifID),
					dataType: "json",
					success: function(data) {
						//console.log("gbif desc");
						//console.log(data);
						
						var descriptions = "";
						data.results.forEach(function(desc) {
							descriptions = descriptions.concat(desc.description);
						});
						
						if(doneCB) doneCB({status: 0, description: descriptions});	
					},
					error: function(data) {
						//console.log("gbif desc failed");
						//console.log(data);
						if(doneCB) doneCB({status: 1, description: null});		
					}
				});
				
				
			},
			
			
			wikipediaGetPageID: function(name, doneCB) {
				$.ajax({
					url:  pageIDURL.replace("###", name.replace(' ', "%20")), 
					data: {format:"json"},
					dataType: "jsonp", 
					headers: header,
					success: function(data) {						
						var id = Object.keys(data.query.pages)[0];
						if(id < 0 || !id) {
							if(doneCB)doneCB({status: 1, pageid: null});	
							return;
						}
						
						if(doneCB)doneCB({status: 0, pageid: id});
					},
					error: function(data) {
						if(doneCB)doneCB({status: 1, pageid: null});	
					},
				});
			},
			
			
			
			wikipediaGetDescription: function(pageid, doneCB) {	
				$.ajax({
					url:  wikiPageUrl.replace('###', pageid), 
					data: {format:"json"},
					dataType: "jsonp", 
					headers: header,
					success: function(data) {
						//console.log("wikipedia desc");
						//console.log(data);
						
						
						var descID = 0;
						data.parse.sections.forEach(function(section) {
							if (section.line == "Description" || section.anchor == "Description") {
								descID = section.index;
								return;
							}
						});
					
						$.ajax({
							url:  wikiPageUrl.replace('###', pageid) + "&section=" + descID, 
							data: {format:"json"},
							dataType: "jsonp", 
							headers: header,
							success: function(descData) {
								//console.log("DesckData");
								//console.log(descData);
								if(doneCB) doneCB({status: 0, description: descData.parse.text["*"]});
							},
							error: function(data) {
								//console.log("Error");
								if(doneCB) doneCB({status: 1, description: null});
							}
						});				
	
					},
					error: function(data) {
						//console.log("wikipedia desc error");
						if(doneCB) doneCB({status: 1, description: null});
					}	
				});
			},
			
			
			
			fetchCreatureData: function(specie, cb) {
				var offset = 0, limit = 300;
				
				function getOccurances(s, o, l) {
					
					instance.gbifGetOccurances(s, o, l, function(z, count, curOffset, curLimit){
						//we are on the last page
						if(curOffset + curLimit >= count || count < 0) {
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
			},
			
			

			fetchDescription: function(specie, cb) {
				//console.log(specie);
				instance.wikipediaGetPageID	(specie.scientificName, function(data) {
					//console.log("Wikipedia ID lookup");
					//console.log(data);
					
					//couldn't find the wikipedia page, lets try the gbif database
					if(data.status != 0) {
						instance.gbifGetDescription(specie, cb);
					} else {
						//have page id, lets grab it
						instance.wikipediaGetDescription(data.pageid, cb);
					}


				});
				
				
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