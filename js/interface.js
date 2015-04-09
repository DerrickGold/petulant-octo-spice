//keep track of mouse position
var mouse = {x: 0, y: 0};

/*=============================================================================
When a custom list of species are to be displayed, they lose their time information,
this restablishes that time information when comparing species of different time periods
by drawing their relation to the time slider

=============================================================================*/
var lineColors = d3.scale.category20b();

function mapSpecieToSlider(slider, specie) {
	/*
	
		All the x positioning here will break if we ever
		move the slider bar... oh well.
	*/
	var position = getPixelCount(specie.dates[0]) + 25,
		position2 = getPixelCount(specie.dates[1]) + 25;
	
	var timeLineMapSVG = d3.select(".d3slider-axis");

	
	var maxDisplay = 10;//space out lines for best drawing of 10 elements
	var specieNum = chart.customSpeciesList.length;
	var speciePosScale = d3.scale.linear().domain([0, maxDisplay]).range([position, position2]);
	
	var speciePos = speciePosScale(specieNum);
	
	var y1 = 25;//offset of where the top of the sliderbar starts
	var y2 = 90;//offset of where to draw specie icons
	var base = 50;//offset of the bottom of the year text is drawn on the time slider
	//y position to draw the horizontal line between the two dates of a given specie
	var newY = ((specieNum/maxDisplay) * (y2 - base)) + base;
	
	
	var className = "sliderMappingLine";

	
	
	var colors = lineColors,
		col =  colors(specieNum);
	
	var defWidth = 2;

	//first date line
	var lines = [	timeLineMapSVG.append("line").attr("class", className)
						.attr("x1", position).attr("x2", position)
						.attr("y1", y1).attr("y2", newY)
						.attr("stroke", col).attr("stroke-width", defWidth),
	
					//horizontal line
					timeLineMapSVG.append("line").attr("class", className)
						.attr("x1", position).attr("x2", position2)
						.attr("y1", newY).attr("y2", newY)
						.attr("stroke", col).attr("stroke-width", defWidth),

					//end date line
					timeLineMapSVG.append("line").attr("class", className)
						.attr("x1", position2).attr("x2", position2)
						.attr("y1", y1).attr("y2", newY)
						.attr("stroke", col).attr("stroke-width", defWidth),

	
					//line to creature
					timeLineMapSVG.append("line").attr("class", className)
						.attr("x1", speciePos).attr("x2", speciePos)
						.attr("y1", newY).attr("y2", y2)
						.attr("stroke", col).attr("stroke-width", defWidth)
				];

	
	var creature = timeLineMapSVG.append("svg")
		.attr("class", function() {
			return "SpecieTime";
		})
		.attr('x', speciePos - 25)
		.attr('y', y2)
		.attr("width", "50px").attr("height", "50px")
		.on("mouseenter", function() {
			//console.log("clicked");
			//d3.selectAll(className).attr("stroke", "white");	
			lines.forEach(function(line) {
				line.attr("stroke", "white");
			});
		})
		.on("mouseleave", function() {
			lines.forEach(function(line) {
				line.attr("stroke", col).style("stroke-width", 2);
			});
		})	
	
		//link the image up to the creature
		.append("image")
		.attr("xlink:href", function(d){
			return  "creatureIcons/" + specie.name.replace(' ', '') + ".png";
		})
		.attr("title", function() {
			return specie.name + ": " + specie.dates[0] + "mya - " + specie.dates[1] + "mya";	
		})
		.attr("width", "50px").attr("height", "50px");
}

function clearSpecieSliderMap() {
	d3.selectAll(".sliderMappingLine").remove();
	d3.selectAll(".SpecieTime").remove();
}


function activateUserSpeciesMode() {
	
	if(!$("#clearButton").length) {
		$("#CreaturesBoxTitle").text("Your Selected Species").addClass("active");
		
		
		var button = $(document.createElement("button"))
							.attr("type", "button").attr("id", "clearButton")
							.text("Clear Selected Species");

		button.on('click', function() {
			chart.clearCustomSpecieList();
			clearSpecieSliderMap();
			$("#CreatureBoxListClip").css("height", "500px");
			$(this).remove();
		});

		$("#CreatureBoxListClip").css("height", "440px");
		$(".CreaturesBoxControls").append(button);
	}		
}

function updateSpeciesBoxTitle(chart, year) {
	if(!chart.isUsingCustomSpecieList()) {
		$("#CreaturesBoxTitle")
			.removeClass("active")
			.text("Species " + parseFloat(year).toFixed(1) + " Million Years Ago");
	}	
}
/*=============================================================================
Popup Menu creation
=============================================================================*/
function createCreaturePopup(e, creature) {
	//grab the lightbox instance
	var popUpHeight = parseInt($("#lightBox .lightBoxContent").css("height").replace("px", ''));
	var myLightBox = LightBox.init();
	
	myLightBox.height("300");
	
	var boxX = mouse.x;
	var boxY = mouse.y;

	myLightBox.xPos(boxX);
	myLightBox.yPos(boxY);

	var infoBox = $(".InfoBox");

	$(infoBox).find(".resizeableTextBox").each(function() {
		$(this).css("display", "none");
	});

	//add name
	$(infoBox).find("#nameBox").text(creature.scientificName);
	//add cluster details
	$(infoBox).find("#clusterInfo").text(function() {
		var numCreatures = creature.inCluster.length;
		return 	"Locations (" + numCreatures + ")";	
	});

	var aboutText = $(infoBox).find("#aboutTextBox.resizeableTextBox");

	
	var db = DataBaseAPI.init();
	db.fetchDescription(creature, function(data) {
		if(data.status) {
			console.log("Failed to find description");	

		} else {
			
			var html = $.parseHTML( data.description);
			//cleanup the wikipedia html a bit
			$(html).each(function() {
				//if dom is empty, hide it
				if(!$(this).length || !$(this).text().length) {
					$(this).hide();	
				}
				
				//if there is just a table wrapped in div, make the div height 0
				if($(this).find("> .infobox.biota").length > 0) {
					$(this).css("height", "0px");
				}
				
				//remove all urls, as they refer to wikipedia stuff
				$(this).find("a").each(function(i, urls){ 
					var thisUrl = $(urls).prop("href");
					var newUrl = db.wikiBaseUrl + thisUrl;
					//use the wikipedia url, and make it open on new tab/window
					$(urls).prop("href", "#");
					$(urls).css("cursor", "initial");
				});
				
				var descTitle = $(this).find("#Description");
				if($(descTitle).length > 0) {
					console.log("removing description title");
					$(this).hide();
				}
				
			});
			
			
			$(".lightBoxContent #aboutTextBox").append(html);
		}

	});


	var clusterList = $(infoBox).find("#clusterList.resizeableTextBox");
	clusterList.empty();


	creature.inCluster.forEach(function(location){
		var remainBox = $(document.createElement("div")).addClass("clusterListLI");

		var li = $(document.createElement("li")).append(remainBox);

		var infoDiv = $(document.createElement("div"))
						.addClass("clusterInner")
						.appendTo(remainBox);

		//country of origin
		$(document.createElement("div")).addClass("clusterLIInfo").text(location.country).appendTo(infoDiv);
		//type of remain
		$(document.createElement("div")).addClass("clusterLIInfo").text(location.remainType).appendTo(infoDiv);
		//longitude and latitude it was found
		$(document.createElement("div")).addClass("clusterLIInfo").text("lat: " + location.latitude.toFixed(2) 
																		+ " lon: " + location.longitude.toFixed(2))
																		.appendTo(infoDiv);

		
		
		//console.log(location);
		if(location.media) {
			var imgDiv = $(document.createElement("div")).addClass("clusterInnerImg").appendTo(remainBox);
			
			location.media.forEach(function(m) {
				$(document.createElement("a")).addClass("clusterLIImg")
						.attr("href", m.references).attr("target", "_blank").text("IMG").appendTo(imgDiv);
			});
			
		}
		//next add any media associated with it
		clusterList.append(li);
	});

	//set information to show first on open
	myLightBox.show($(infoBox).html());	

	//make sure the window stays on screen
	var diffx = parseInt(myLightBox.xPos()) + parseInt(myLightBox.width()) - window.innerWidth;
	var diffy = parseInt(myLightBox.yPos()) + parseInt(myLightBox.height()) - window.innerHeight;
	if(diffx > 0 || diffy > 0) {
		console.log("off screen!");
		var newPosX = myLightBox.xPos(),
			newPosY = myLightBox.yPos();

		newPosX -= (diffx > 0) * diffx;
		newPosY -= (diffy > 0) * diffy;
		myLightBox.xPos(newPosX).yPos(newPosY);
	} 

	$(".lightBoxContent .InfoContent").scrollTop();
	//$(".lightBoxContent #clusterList").scrollTop();
	$(".lightBoxContent #aboutTextBox").toggle();
	$(".lightBoxContent #specieInfo").addClass("active");	
	
}


/*=============================================================================
Initialize all callbacks that update the html interface from the data changes
in the d3 application side.
=============================================================================*/
function initCallBacks(slider, chart) {
	
	var leftOffset = parseInt($(".CreaturesBox").css("min-width").replace("px", ''));
	var topOffset = parseInt($("#titleBox").css("height").replace("px", ''));
			
	var myLightBox = LightBox.init();
	
	
	//scale for graphing the number of remains a specie has
	var remainsScale = d3.scale.linear();
	var remainsDomain = [0, 0];
	//want the output to match the width of our creature listing box
	var remainsRange = [2, leftOffset];
	remainsScale.range(remainsRange);

	var autoCompleteSource = [];
			
	
	
	//add listener to tack mouse location
	//this is used to determine where to popup the window
	//on specie clicking
	document.addEventListener('mousemove', function(e){ 
		mouse.x = e.clientX || e.pageX; 
		mouse.y = e.clientY || e.pageY 
	}, false);	

	
	
	$('#autocomplete').autocomplete({
		source: [],
		select: function(e, o) {
			e.preventDefault();
			
			//check if specie is already selected
			chart.addToCustomSpecieList(o.item.value.id, function(s) {
				chart.displayCustomList();
				mapSpecieToSlider(slider, s);				
			});
			activateUserSpeciesMode();
		}
	});
	


	
	chart.onYearChanged(function(e, year) {
		updateSpeciesBoxTitle(chart, year);
	});
	
	
	chart.onSpecieFetched(function(e, specie) {
		if(!autoCompleteSource) autoCompleteSource = [];
		autoCompleteSource.push({label: specie.name, value: specie});
		$('#autocomplete').autocomplete("option", "source", autoCompleteSource);
		$("#creatureLoadCount").text("Creatures loaded: " + autoCompleteSource.length + " / " + (chart.speciesList.data.length));
	});

	//set up callbacks for chart actions
	chart.onCreatureClick(function(e, creature) {
		var creatureSVG = e;
		var creatureImg = e.select("image");

		
		var circleContainer = d3.select("body").append("svg")
								.attr("class", "circleContainer")
								.style("display", "inline")
								.style("position", "absolute")
								.attr("width", "70px")
								.attr("height", "70px")
								.style("left", mouse.x - 35 + "px")
								.style("top", mouse.y - 35 + "px" )
								.append("circle")
								.attr("stroke", "red")
								.attr("stroke-width", "5")
								.attr("fill", "none")
								.attr("r", "30")
								.attr("cx", 35)
								.attr("cy", 35);
		

						//.attr("transform", creatureImg.attr("transform"));
						
		
		createCreaturePopup(e, creature);
	});

	
	myLightBox.onClose(function() {
		//chart.svgLayers["foreground"].selectAll("circle").remove();
		d3.selectAll(".circleContainer").remove();
	});
	
	
	
	$(".lightBoxContent").on("click", "#specieInfo", function() {
		if($(".lightBoxContent #aboutTextBox").css('display') != 'none')
			return;
			
		if($(".lightBoxContent #clusterList").css('display') != 'none') {
			$(".lightBoxContent #clusterList").hide();
			$(".lightBoxContent #clusterInfo").removeClass("active");	
		}
		
		$(".lightBoxContent .InfoContent").scrollTop();
		$(".lightBoxContent #aboutTextBox").show();
		$(".lightBoxContent #specieInfo").addClass("active");
	});
	
	$(".lightBoxContent").on("click", "#clusterInfo", function() {
		if($(".lightBoxContent #clusterList").css('display') != 'none')
			return;		
	
		if($(".lightBoxContent #aboutTextBox").css('display') != 'none') {
			$(".lightBoxContent #aboutTextBox").hide();
			$(".lightBoxContent #specieInfo").removeClass("active");	
		}
		
		$(".lightBoxContent .InfoContent").scrollTop();
		$(".lightBoxContent #clusterList").show();
		$(".lightBoxContent #clusterInfo").addClass("active");
	});		
	
	
	
	$(".lightBoxContent").on("click", "#closeInfo", function() {
		myLightBox.close();
	});			
	
	$("#aboutButton").on("click", function() {
		var infoBox = $(".AboutMenuBoxContainer");
		//get myLightBox instance.
		var lb = LightBox.init();
		var pos = $('.chartContainer').position();
		lb.xPos(pos.left);
		lb.yPos(pos.top);
		lb.width(774).height(500);
		lb.show($(infoBox).html());	
	});
	
	$('.lightBoxContent').on("click", "#aboutCloseButton", function() {
		myLightBox.close();
	});
	
	

	//update creature listing as creatures are instantiated
	chart.onCreatureUpdate(function(append, c) {
		if(append) {

			var nameEntry = $(document.createElement("div"))
				.attr("class", "creatureFilter")
				.attr("data-filter-id", c.id)
				.attr("sort", c.name)
				.attr("title", function() {
					return c.locations.length + " remain(s) found globally."
				});


			var bar = $(document.createElement("div")).addClass("remainsChart")
						.attr("count", c.locations.length)
						.css("width", remainsScale(c.locations.length));
						//.css("overflow", "visible");




			var name = $(document.createElement("div")).text(c.name).appendTo(bar);
			nameEntry.append(bar);

			//if list is empty, just add the creature
			if (!$(".creatureFilter").length) {
				//console.log("empty list!");
				$(".CreaturesList").append(nameEntry);
				return; 
			}

			//otherwise, do binary search to find insertion point
			//code taken from 
			//http://stackoverflow.com/questions/14495400/jquery-insert-div-at-right-place-in-list-of-divs
			//cause I'm lazy
			var sortval = c.name;
			var $first = $(".creatureFilter:first");
			if (sortval <= $first.attr('sort')) {
				nameEntry.insertBefore($first);
				return;
			}

			var $last = $(".creatureFilter:last");
			if (sortval >= $last.attr('sort')) {
			   nameEntry.insertAfter($last);
				return;
			}

			var count = 0;
			var $div = $(".creatureFilter");
			do {
			   var index = parseInt($div.length / 2)
			   var $compare = $div.eq(index);
			   var compare = $compare.attr('sort');
			   if (sortval == compare) {
				  break;
			   }
			   else if (sortval < compare) {
				  $div = $div.slice(index, $div.length);
			   }
			   else {
				  $div = $div.slice(0, index);
			   }
			}
			while ($div.length > 1);

			if (sortval <= compare) { nameEntry.insertBefore($compare); }
			else { nameEntry.insertAfter($compare); }


		} else {
			$('[data-filter-id="' + c.id + '"]').remove();
		}
	});

	//some sort of statistical change occured
	//update the interface accordingly
	chart.onStatisticsUpdate(function(e, stats) {

		//update our remains chart
		remainsDomain[1] = stats.maxRemains;
		remainsScale.domain(remainsDomain);

		//and go through each creatures remains bars and update them
		$('.remainsChart').each(function() {
			$(this).css("width", function() {
				return remainsScale($(this).attr("count"));
			});

		});

	});
	
	//set listener to filter stuff
	$('.CreaturesList').on('click', '.creatureFilter', function() {
		//console.log("click");
		$(this).toggleClass('CreatureListOff');
		chart.toggleSpecie($(this).attr('data-filter-id'));
	});

	
	//start up with about screen
	$("#aboutButton").trigger('click');
	
}
