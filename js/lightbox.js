var LightBox = {
    _lightBox: null,
    _content: null,

    _width: "600px",
    _height: "600px",
	
	_x: 0,
	_y: 0,
	
	xPos: function(newX) {
		if(newX == "undefined") return this._x;
		this._x = newX;
		return this;
	},
	yPos: function(newY) {
		if(newY == "undefined") return this._y;
		this._y = newY;
		return this;
	},
	
    width: function(val) {
        if(val == "undefined") return this._width;
        this._width = val;
        return this;
    },

    height: function(val) {
        if(val == "undefined") return this._height;
        this._height = val;
        return this;
    },
    
    //initialize light box and hide it in page
    init: function() {
            
        if( this._lightBox == null) {
            this._lightBox = document.createElement('div');
            $(this._lightBox).attr('id', 'lightBox').hide();
         
            this._content = document.createElement('div');
            $(this._content).attr('class', 'lightBoxContent');
            $(this._content).appendTo(this._lightBox);
    
            var that = this;
            //add check for click outside box to close it
            $(this._lightBox).mousedown(function(e) {
                that.clickOut(e, function(){
                    that.close();
                });
            });
            
            
            $(this._lightBox).on('click', '#lightBoxCloseBtn',function(e) {
                that.close();
            });
            
            $('body').append(this._lightBox);
            return this;
        }
    },
        
    clickOut: function(e, cb) {
        var box = $(this._lightBox).find('.lightBoxContent');
        if(!box.is(e.target) && box.has(e.target).length==0)
            cb(box);
    },
    
    close: function() {
        $(this._lightBox).find('.lightBoxContent').empty();
        $(this._lightBox).hide();
    },
    
    show: function(data) {
        if(this._content != null) { 
            $(this._content).html(data)
                .css('width', this._width).css('height', this._height)
				.css('left', this._x + "px").css('top', this._y + "px" );
            $(this._lightBox).show();
        }
    }   
};