/*
When a custom list of species are to be displayed, they lose their time information,
this restablishes that time information when comparing species of different time periods
by drawing their relation to the time slider

*/
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
	
	var y1 = 25;//offset of where the top of the sliderbar starts
	var y2 = 90;//offset of where to draw specie icons
	var base = 50;//offset of the bottom of the year text is drawn on the time slider
	//y position to draw the horizontal line between the two dates of a given specie
	var newY = ((chart.customSpeciesList.length/maxDisplay) * (y2 - base)) + base;
	
	
	var creature = timeLineMapSVG.append("svg")
		.attr("class", function() {
			return "SpecieTime";
		})
		.attr('x', position - 25)
		.attr('y', y2)
		.attr("width", "50px").attr("heigth", "50px")
		//link the image up to the creature
		.append("image")
		.attr("xlink:href", function(d){
			return  "creatureIcons/" + specie.name.replace(' ', '') + ".png";
		})
		.attr("title", function() {
			return specie.name + ": " + specie.dates[0] + "mya - " + specie.dates[1] + "mya";	
		})
		.attr("width", "50px").attr("height", "50px");
	
	
		var colors = lineColors,
			col =  colors(chart.customSpeciesList.length);
	
	

	//now create line to draw ontop of the slider
	timeLineMapSVG.append("line").attr("class", "sliderMappingLine")
					.attr("x1", position).attr("x2", position)
					.attr("y1", y1).attr("y2", y2)
					.attr("stroke", col);
	
	timeLineMapSVG.append("line").attr("class", "sliderMappingLine")
				.attr("x1", position).attr("x2", position2)
				.attr("y1", newY).attr("y2", newY)
				.attr("stroke", col);
	
		//now create line to draw ontop of the slider
	timeLineMapSVG.append("line").attr("class", "sliderMappingLine")
					.attr("x1", position2).attr("x2", position2)
					.attr("y1", y1).attr("y2", newY)
					.attr("stroke", col);

}

function clearSpecieSliderMap() {
	d3.selectAll(".sliderMappingLine").remove();
	d3.selectAll(".SpecieTime").remove();
}




/*=============================================================================
Initialize all callbacks that update the html interface from the data changes
in the d3 application side.
=============================================================================*/
function initCallBacks(slider, chart) {
	var leftOffset = parseInt($(".CreaturesBox").css("min-width").replace("px", ''));
	var topOffset = parseInt($("#titleBox").css("height").replace("px", ''));
			
	var myLightBox = LightBox.init();
	var popUpHeight = parseInt($("#lightBox .lightBoxContent").css("height").replace("px", ''));
	
	//scale for graphing the number of remains a specie has
	var remainsScale = d3.scale.linear();
	var remainsDomain = [0, 0];
	//want the output to match the width of our creature listing box
	var remainsRange = [2, leftOffset];
	remainsScale.range(remainsRange);

	var autoCompleteSource = [];
			
	$('#autocomplete').autocomplete({
		source: [],
		select: function(e, o) {
			e.preventDefault();
			
			//check if specie is already selected
			chart.addToCustomSpecieList(o.item.value.id, function(s) {
				chart.displayCustomList();
				mapSpecieToSlider(slider, s);				
			});
			$("#CreaturesBoxTitle").text("Your Selected Species").addClass("active");
			
			//<button name="clear" type="button" id="clearButton">Clear</button>
			if(!$("#clearButton").length) {
				var button = $(document.createElement("button"))
									.attr("type", "button").attr("id", "clearButton")
									.text("Clear Selected Species");
				
				button.on('click', function() {
					chart.clearCustomSpecieList();
					clearSpecieSliderMap();
					$("#CreatureBoxListClip").css("height", "480px");
					$(this).remove();
				});
				
				$("#CreatureBoxListClip").css("height", "460px");
				$(".CreaturesBoxControls").append(button);
				//$(".CreaturesBoxControls").append(button);
			}
		}
	});
	


	
	
	chart.onYearChanged(function(force, year) {
		if(!chart.isUsingCustomSpecieList()) {
			$("#CreaturesBoxTitle")
				.removeClass("active")
				.text("Species " + parseFloat(year).toFixed(1) + " Million Years Ago");
		}
	});
	
	
	chart.onSpecieFetched(function(e, specie) {
		
		if(!autoCompleteSource)
			autoCompleteSource = [];
		
		autoCompleteSource.push({label: specie.name, value: specie});
		
		$('#autocomplete').autocomplete("option", "source", autoCompleteSource);	
		console.log("updating auto complete");
	});

	//set up callbacks for chart actions
	chart.onCreatureClick(function(e, creature) {

		console.log(creature);				
		var boxX = parseInt(creature.drawX + creature.width) + leftOffset;
		var boxY = parseInt(creature.drawY + creature.height) + topOffset;

		if(boxY + popUpHeight > window.innerHeight) boxY -= popUpHeight;

		myLightBox.xPos(boxX);
		myLightBox.yPos(boxY);

		var infoBox = $(".InfoBox");

		//add name
		$(infoBox).find("#nameBox").text(creature.name);
		//add cluster details
		$(infoBox).find("#clusterInfo").text(function() {
			var numCreatures = creature.inCluster.length + 1;
			return 	numCreatures + " remains";	
		});

		$(infoBox).find("#eolURL").attr("href", "http://eol.org/pages/###/overview".replace("###", creature.id));

		myLightBox.show($(infoBox).html());	
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
						.css("width", remainsScale(c.locations.length))
						.css("height", "20")
						.css("background-color", "red");
						//.css("overflow", "visible");




			var name = $(document.createElement("div")).text(c.name).appendTo(bar);
			nameEntry.append(bar);

			//if list is empty, just add the creature
			if (!$(".creatureFilter").length) {
				console.log("empty list!");
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
		console.log("click");
		$(this).toggleClass('CreatureListOff');
		chart.toggleSpecie($(this).attr('data-filter-id'));
	});
}
