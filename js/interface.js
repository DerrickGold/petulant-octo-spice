
/*=============================================================================
Initialize all callbacks that update the html interface from the data changes
in the d3 application side.
=============================================================================*/
function initCallBacks(chart) {
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
			chart.makeCustomSpecieList(o.item.value);
			chart.displayCustomList();
		}
	});
	

	$('#clearButton').on('click', function() {
		
		chart.clearCustomSpecieList();
	});
	
	
	chart.onSpecieFetched(function(e, specie) {
		
		if(!autoCompleteSource)
			autoCompleteSource = [];
		
		autoCompleteSource.push({label: specie.name, value: specie.id});
		
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
