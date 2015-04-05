var currentSelection = null;
var currentSelectionObject = null;
var firstIndex = 0, secondIndex = 0, sliderPosFirst = 0, sliderPosSecond = 0;
var slider;
var currentSliderVal = 0, previousSliderVal = 0, count = 0;

//Domain = input
//range = output


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
            xScale: d3.scale.linear(),
            xRange: [0, 0],
            xDomain: [0, 100],

            yAxis: d3.svg.axis().orient("left"),
            yScale: d3.scale.linear(),
            yRange: [0, 0],
            yDomain: [0, 100],
			
			//scale the size and width for continents relative to the world (in degrees)
			ContinentScaleLat: d3.scale.linear(),
			cLatRange: [0, 180],
			cLatDomain: [0, 180],
		
			ContinentScaleLon: d3.scale.linear(),
			cLonRange: [0, 360],
			cLonDomain: [0, 360],
			
			//scale for x and y positioning of species on map
			//this scale dynamically changes on zoom
			specieXScale: d3.scale.linear(),
			specieXRange: [0, 0],
			specieXDomain: [0, 100],
			
			specieYScale: d3.scale.linear(),
			specieYRange: [0, 0],
			specieYDomain: [0, 100],
			
            scale: function(s) {
                var newXRange = [instance.xRange[0], instance.xRange[1]];
                var newYRange = [instance.yRange[0], instance.yRange[1]];
				
				var newCLatRange = [instance.cLatRange[0], instance.cLatRange[1]];
				var newCLonRange = [instance.cLonRange[0], instance.cLonRange[1]];
				
				
                instance.xScale.domain(instance.xDomain).range(newXRange);
                instance.yScale.domain(instance.yDomain).range(newYRange);

				instance.ContinentScaleLat.domain(instance.cLatDomain).range(newCLatRange);
				instance.ContinentScaleLon.domain(instance.cLonDomain).range(newCLonRange);
				
				
				newXRange = [instance.specieXRange[0], instance.specieXRange[1] * s];
                newYRange = [instance.specieYRange[0], instance.specieYRange[1] * s];
				instance.specieYScale.domain(instance.specieYDomain).range(newYRange);
				instance.specieXScale.domain(instance.specieXDomain).range(newXRange);
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



