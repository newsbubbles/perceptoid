/* LODTree - Quick Level of Detail based Angular Lookup Tree
	Requires: kdTree.js from https://github.com/ubilabs/kd-tree-javascript
	To use LODTree...
		put this in the <head>
		  <script src="js/kdTree.js"></script>
		  <script src="js/LODTree.js"></script>
		create an LOD var 
			lod = LODTree(30); //30 slices of a circle
	There are no radians, a radian is a division of pi, in this case we use unit m
	thus the "c" indexes of any rise&run or angle is correspondent to however many divisions you add
	divisions are pi / m, and vice versa... how many ways can you slice a pie? -N
	idea: include elliptical and 3d matrix lookup tables
*/
function LODTree(divisions){ 
	console.log(divisions);
	var start = Date.now();
	if (divisions <= 0 || divisions > 256) return;
	var n = 360 / Math.PI * 2;
	var m = Math.PI * 2 / divisions; 
	var cc = 0, spoints = [], apoints = [];
	var trees = {slope: null, quadrant: null, angle: null}
	for (c=0;c<Math.PI*2;c+=m){
		//x and y plot a unit circle at 128 radius
		var x = Math.floor(Math.cos(c) * 128);
		var y = Math.floor(Math.sin(c) * 128);
		//console.log(x, y);
		var atan = Math.floor(Math.atan(y/x) * 128);
		var acos = Math.floor(Math.atan(x/y) * 128);
		var tan = Math.tan(y/x);
		var r2 = x * x + y * y;
		var r = Math.sqrt(r2);
		var tsin = y / r, 
			tcos = x / r,
			ttan = y / x;
		var theta = {
			sin: tsin,
			cos: tcos,
			tan: ttan,
			csc: 1 / tsin,
			sec: 1 / tcos,
			cot: 1 / ttan
		};
		var slope = Math.floor((y/x) * 256);
		var quad = acos + 2;
		var unit = {c: cc, m: cc * m, x: x, y: y, r2: r2, r: r, theta: theta, xtan: acos, ytan: atan, quadrant: quad, slope: slope, deg: cc / divisions * 360, lod: divisions};
		//unit.scaling = [];
		var s = 1;
		//for (i=0;i<100;i=i+s){
		//	unit.scaling[] = {x: Math.floor(unit.x * (i / 10)), y: Math.floor(unit.y * (i / 10))});
		//	s = (i <= 10) ? 1: 10;
		//}
		if (x != 0 && y != 0) spoints.push(unit);
		apoints.push(unit);
		cc++;
	}
	trees.slope = new kdTree(spoints, difference, "x");
	trees.angle = new kdTree(apoints, difference, "x");
	var tend = Date.now();
	console.log((tend - start) + 'ms to calculate and build ' + divisions + ' node lookup tree');
	var o = {
		erMsg: { 
			DEFAULT: 'Use this.setSlope or setAngle methods first to perform lookups'
		},
		div: divisions,
		s: spoints,
		a: apoints,
		trees: trees,
		sPrime: 0,
		aPrime: 0,
		unit: null,
		distance: 0,
		setSlope: function(s){
			this.sPrime = Math.floor(s * 256);
			var u = this.trees.slope.nearest(this.sPrime, 1);
			this.unit = u[0][0];
			this.distance = u[0][1];
		},
		setAngle: function(a){
			var u = this.trees.angle.nearest(this.aPrime, 1);
			this.unit = u[0][0];
			return this.unit;
		},
		setLine: function(a, b){
			this.setSlope(this.slope(a, b));
			return this.unit;
		},
		slope: function(a, b){
			var rise = a.y - b.y;
			var run = a.x - b.x;
			return rise / run;
		},
		getAngle: function(a, b){
			this.setLine(a, b);
			return this.unit.deg;
		},
		getSlope: function(a, b){
			this.setLine(a, b);
			return this.unit.slope;
		},
		getUnit: function(a, b){
			this.setLine(a, b);
			return this.unit;
		},
		interpolate: function(a, b, d){
			this.setLine(a, b);
			var u = this.unit;
			
		},
		getLeft: function(){
			if (this.unit == null) return this.err(this.DEFAULT);
			
		},
		getFront: function(){
			if (this.unit == null) return this.err(this.DEFAULT);
		},
		getRight: function(){
			if (this.unit == null) return this.err(this.DEFAULT);
		
		},
		getNormalAngle: function(){
			if (this.unit == null) return this.err(this.DEFAULT);
			
		},
		toVector: function(m){
			//Give direction and magnitude
			return { theta: this.unit.c, magnitude: m};
		},
		dot: function(v1, v2){
			return v1.x * v2.x + v1.y * v2.y;
		},
		vectorVertex: function(v1, v2){
			//set v1 theta at 0 deg
			//v2 angle is relative to v2
			//if v2.magnitude < v1.magnitude u.magnitude=
			var x = { angle: this.unit};
			x.magnitude = (v2.magnitude / v1.magnitude);
			return x;
		},
		err: function(e){
			console.error(e);
			return false;
		}
	};
	return o;
}
	
function difference(a, b){
	return a - b;
}
