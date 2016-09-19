/**
 * ...
 * @author grgrdvrt
 */

var geom = (function() {
	
	function Vector2D(x, y)
	{
		this.set(x || 0, y || 0);
	}
	
	Vector2D.distance = function(v1, v2)
	{
		var dx = v2.x - v1.x;
		var dy = v2.y - v1.y;
		return Math.sqrt(dx * dx + dy * dy);
	}
	
	Vector2D.distance2 = function(v1, v2)
	{
		var dx = v2.x - v1.x;
		var dy = v2.y - v1.y;
		return dx * dx + dy * dy;
	}
	
	var v2dp = Vector2D.prototype;
	
	v2dp.add = function(v) { this.x += v.x; this.y += v.y; }
	v2dp.subtract = function(v) { this.x -= v.x; this.y -= v.y;}
	v2dp.scale = function(s) { this.x *= s; this.y *= s; }
	v2dp.set = function(x, y) { this.x = x; this.y = y; }
	v2dp.getLength = function() { return Math.sqrt(this.x * this.x + this.y * this.y); }
	v2dp.getLength2 = function() { return this.x * this.x + this.y * this.y; }
	v2dp.setLength = function(l)
	{
		if(this.x == 0 && this.y == 0)this.x = 1;
		var length = this.getLength();
		this.scale(l / length);
	}
	
	function Rectangle(x, y, width, height)
	{
		this.x = x || 0;
		this.y = y || 0;
		this.width = width || 0;
		this.height = height || 0;
	}
	
	var rp = Rectangle.prototype;
	
	
	return {Vector2D:Vector2D,
			Rectangle:Rectangle};
})();