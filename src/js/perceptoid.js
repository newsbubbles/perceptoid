/*
	Perceptoid.js - persistent perceptive centroid which filters, learns, and transports 3D data through a 2D plane
	Version: 0.1
	Author: Nathaniel Dwight Gibson
	Perceptoid Theory & Creation: Nathaniel Dwight Gibson
	Requires: tracking.js, kdTree.js, LODTree.js
	Date Created: 2016-07-22
	Uses: 
		Data analysis for n-dimensional point clouds, 
		3D depth approximation,
		object position and orientation tracking,
		automatic object classification
	Note: In the title line, I mention 3D and 2D
*/

/*
	TODO Today: 
		linked lists, layouts, relationships, clustering, z-Depth, delta, paper
		delaunay TODOs - use linked lists!
		5D/6D with color added to all math

*/

//Quick vector math
var Vec = function(p){
	var o = {x: p.x, y: p.y, d: p.d};
	o.rgb = false;
	if (p.hasOwnProperty('r')){
		o.r = p.r;
		o.g = p.g;
		o.b = p.b;
		o.rgb = true;
	}
	o.add = function(v) { this.x += v.x; this.y += v.y; if (this.rgb){ this.r += v.r; this.g += v.g; this.b += v.b;} };
	o.subtract = function(v) { this.x -= v.x; this.y -= v.y; if (this.rgb && typeof v.r !== 'undefined'){ this.r -= v.r; this.g -= v.g; this.b -= v.b;}};
	o.scale = function(s) { this.x *= s; this.y *= s; };
	o.colorScale = function(s) { this.r *= s; this.g *= s; this.b *= s;};
	o.distance = function(b){
		var dx = b.x - this.x;
		var dy = b.y - this.y;
		return dx*dx + dy*dy;
	};
	o.colorDistance = function(b){
		var dr = b.r - this.r;
		var dg = b.g - this.g;
		var db = b.b - this.b;
		return dr*dr + dg*dg + db*db;		
	};
	return o;
};

var Vec3 = function(p){
	var o = {r: p.r, g: p.g, b: p.b};
	o.add = function(v) { this.r += v.r; this.g += v.g; this.b += v.b; };
	o.subtract = function(v) { this.r -= v.r; this.g -= v.g; this.b -= v.b; };
	o.scale = function(s) { this.r *= s; this.g *= s; this.b *= s; };
	o.distance = function(b){
	};
	return o;
};

//Centroid
var Centroid = function(obj){
	return {
		x: obj.x,
		y: obj.y,
		/*r: obj.r,*/
		r: 127,
		g: 127,
		b: 127,
		normal: {}, /* A vector in form: {angle, magnitude} */
		neighborhood: [], /* A distance normalized list of LOD unit vectors sorted highest first */
		neighborhoodFinite: [], /* A finite distance from graph x=0, y=0 on the canvas */
		vectorsum: {
			x: 0,
			y: 0,
			d: 0,
			r: 0,
			g: 0,
			b: 0
		},
		lastVectorsum: null,
		velocity: Vec({
			x: 0,
			y: 0,
			d: 0,
			r: 0,
			g: 0,
			b: 0
		}),
		lastContext: null,
		vectorstat: {maxDistance: 0, minDistance: 0, maxX: 0, minX: 0, maxY: 0, minY: 0}
	};	
};

//Helper functions
var merge = function(a, b){
	for (v in b){
		if (b.hasOwnProperty(v)){
			a[v] = b[v];
		}
	}
}
function rgbToHsl(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}
/*
var colorQ = {
	div: 60,
	matrix: {
		hue: []
	},
	initialized: false,
	hueRgb: function(h){
		//input hue, output RGB color
		if (!this.initialized) this.init();
		return this.matrix.hue
	},
	initHueMatrix: function(){
		this.matrix.hue = [];
		var step = 1 / this.div;
		var onethird = this.div / 3;
		var c = 0, p = 1;
		function interpolate(s, f, r){
			//s = start, f = finish, c = step

		}
		for (var i = 0; i < 1; i += step){
			this.matrix.hue.push({
				r: (p == 1) ? 255 - ((c / onethird) * 255) : (p == 3) ? (c / onethird) * 255: 0, 
				g: (c > onethird && c < onethird * 2) ? : 0,
				b: (c > onethird * 2 && c < onethird * 3) ? : 0,
				h: i,
				s: 1,
				l: 0.5
			});
			c++;
			if (c == onethird){
				c = 0;
				p += 1;
			}
		}
	},
	init: function(){
		this.initHueMatrix();
		this.initialized = true;
	}
}*/

//Perceptoid!
function Perceptoid(i){

	//Modes
	//can be: follow, avoid, stay, search | scan
	i.lookup = {}
	i.lookup.modes = ['follow','stay','avoid','search','respect','scan']; //ordered by highest general priority
	//The nucleus (inner radius) of a 
	i.lookup.nucleus = {
		primitives: ['atom','cell']
	};
	//scan mode uses delaunay.js to render a mesh of the local neighbors
	//respect is a special behavioural rule for augmenting position/heading around the neighbor
	//search mode causes the perceptoid to navigate through the full point cloud by nearest neighbor
	//	until it's reached an object that it was told to search for
	//	TODO use the same idea from kdtType 2 in lightning where it uses full point cloud tree using process of elimination
	//		ordered by radial distance from the perceptoid's centroid


	//The relationships between perceptoids which are clustered together
	//are viewed from the perspective of a peer.  This is a peer-2-peer relationhip
	//in this case, the modalities take an extra dimension, so that each connected peer
	//perceptoid will affect this perceptoid in a specific way based on what it
	//should do with that peer.  These relationships can be automatically generated by
	//convNet, or they can be manually/programatically set
	i.lookup.peerRelationships = [
	
	];
	i.lookup.avoid = [];

	var mode = {
		points: {
			movement: 1,
			orientation: 0,
			alignment: 0
		},
		color: {
			follow: true,
			useLimits: 1 /* 1 = only within rgb limits, 2 = 1 and only within rgb radius sphere */
		},
		peers: {
			movement: 1,
			orientation: 1,
			alignment: 1
		}
	};
	if (typeof i.mode !== 'undefined') merge(mode, i.mode);
	i.mode = mode;

	//Drawing / Rendering preferences for canvas
	var draw = {
		radius: true,
		velocity: true,
		movement: true,
		links: true,
		limits: false,
		color: false,
		style: {
			scan: 'fill', 	/* [fill, line, graham] */
			movement: { 	/* r, g, b starting point for movement line color */
				r: 127,
				g: 12,
				b: 200,
				a: 0.8,
				velocity: {  /* velocity of color each step (bounces off 0 - 255) */
					r: 1,
					g: 6,
					b: -12
				}
			}
		},
		color: {
			radius: 'rgba(255,255,0,0.5)',
			innerRadius: 'rgba(255,128,0,0.5)',
			scan: {
				r: 0,
				g: 255,
				b: 0,
				a: 0.3
			}
		}
	};
	if (typeof i.draw !== 'undefined') merge(draw, i.draw);
	i.draw = draw;

	//}
	i.last = {}; // instance of the last set of centroid data
	if (typeof i.staticLocation === 'undefined') i.saticLocation = false;
	if (typeof i.staticHeading === 'undefined') i.staticHeading = false;
	if (typeof i.ease === 'undefined') i.ease = 0.001;
	if (typeof i.easeAlign === 'undefined') i.easeAlign = 0.001;
	if (!i.hasOwnProperty('isHyperPointer')) i.isHyperPointer = false;
	if (!i.hasOwnProperty('scanOpacity')) i.scanOpacity = 1;
	if (!i.hasOwnProperty('nmin')) i.nmin = 1;
	if (!i.hasOwnProperty('scanType')) i.scanType = 'delaunay';
	if (!i.hasOwnProperty('color')) i.color = false;
	if (!i.hasOwnProperty('colorMiddle')) i.colorMiddle = null;
	if (!i.hasOwnProperty('colorEase')) i.colorEase = 0.001;
	if (!i.hasOwnProperty('radialDivisions')) i.radialDivisions = 10;
	if (!i.hasOwnProperty('hue')) i.hue = true;
	if (!i.hasOwnProperty('adjustHue')) i.adjustHue = false;
	if (!i.hasOwnProperty('hr')) i.hr = 0.1;
	i.rVoronoi = new Voronoi();

	//Spatial movement limitations (constrain along x axis = set x0, x1 to same number)
	//Color movement limitations (constrain along r, g and b axis)
	i.setLimits = function(l){
		l.range = {};
		if (l.hasOwnProperty('x0') && l.hasOwnProperty('y0')){
			l.w = l.x1 - l.x0;
			l.h = l.y1 - l.y0;
			l.range.x = l.w;
			l.range.y = l.h;
			if (l.hasOwnProperty('xMargin')) l.xm2 = l.xMargin * 2;
			if (l.hasOwnProperty('yMargin')) l.ym2 = l.yMargin * 2;	
		}
		if (l.hasOwnProperty('r0') && l.hasOwnProperty('r1')) l.range.r = l.r1 - l.r0;
		if (l.hasOwnProperty('g0') && l.hasOwnProperty('g1')) l.range.g = l.g1 - l.g0;
		if (l.hasOwnProperty('b0') && l.hasOwnProperty('b1')) l.range.b = l.b1 - l.b0;
		merge(this.limits, l);
	};
	i.setColorLimits = function(limits, cm){
		var c = {
			r0: (cm.hasOwnProperty('r')) ? cm.r - this.cr: 0,
			g0: (cm.hasOwnProperty('g')) ? cm.g - this.cr: 0,
			b0: (cm.hasOwnProperty('b')) ? cm.b - this.cr: 0,
			r1: (cm.hasOwnProperty('r')) ? cm.r + this.cr: 255,
			g1: (cm.hasOwnProperty('g')) ? cm.g + this.cr: 255,
			b1: (cm.hasOwnProperty('b')) ? cm.b + this.cr: 255
			/*range: {}			*/
		}
		merge(limits, c);
	};
	//var colm = i.hasOwnProperty('colorMiddle');
	var colm = {
		r: 127,
		g: 127,
		b: 127
	};
	if (i.hasOwnProperty('colorMiddle')) merge(colm, i.colorMiddle);
	i.colorMiddle = colm;

	var cm = i.colorMiddle;
	var limits = {
		x0: 0,
		y0: 0,
		x1: this.space.x,
		y1: this.space.y,
		r0: (cm.hasOwnProperty('r')) ? cm.r - i.cr: 0,
		g0: (cm.hasOwnProperty('g')) ? cm.g - i.cr: 0,
		b0: (cm.hasOwnProperty('b')) ? cm.b - i.cr: 0,
		r1: (cm.hasOwnProperty('r')) ? cm.r + i.cr: 255,
		g1: (cm.hasOwnProperty('g')) ? cm.g + i.cr: 255,
		b1: (cm.hasOwnProperty('b')) ? cm.b + i.cr: 255,
		range: {}
	};	
	if (i.hasOwnProperty('limits')) merge(limits, i.limits);
	i.limits = limits;
	i.setLimits(i.limits);

	i.centroid = new Centroid(i);
	i.points = []; //points from the kdTree form [[{x,y},d],...]
	i.lastPoints = [];
	//i.totalMinMax = {min: 65535, max: 0};
	i.initStats = function(){
		return {
			density: 0,
			minNeighbors: 0,
			maxNeighbors: 0,
			radialGrid: [],
			radGridLevels: 8
		}
	};
	i.stats = i.initStats();
	i.radialDensity = [];

	i.memory = {
		_rawnormalhistory: [],
		
	};
	
	//Initializers
	i.setPoints = function(points){
		this.clearInputData();
		this.points = points;
	};
	i.setVectors = function(vectors){
		this.clearInputData();
		this.centroid.neighborhood = vectors;
	};
	i.addVector = function(a, b, d){
		//TODO split Inliers / Outliers and deal with their movement and orientation separately
		//ie: if outer radius movement velocity = 0
		var u = lod.setLine(a, b);
		var v = lod.toVector(d);
		var xR = b.x - a.x, yR = b.y - a.y,
			rR = b.pixel.r - a.r, gR = b.pixel.g - a.g, bR = b.pixel.b - a.b;
		//neighborhood is a max n/r array of relative x,y,d points (ie: angle + magnitude)
		//push neighborhood points
		var hslR = rgbToHsl(rR, gR, bR);
		var hslP = (b.pixel.hasOwnProperty('h')) ? [b.pixel.h, b.pixel.s, b.pixel.l]: rgbToHsl(b.pixel.r, b.pixel.g, b.pixel.b);
		this.centroid.neighborhood.push({x: xR, y: yR, d: d, r: rR, g: gR, b: bR, h: hslR[0], s: hslR[1], l: hslR[2]});
		this.centroid.neighborhoodFinite.push({x: b.x, y: b.y, d: d, r: b.pixel.r, g: b.pixel.g, b: b.pixel.b, h: hslP[0], s: hslP[1], l: hslP[2]});

		var rD = Math.floor(d / this.stats.radGridLevels);
		if (typeof this.stats.radialGrid[rD] === 'undefined') this.stats.radialGrid[rD] = 0;
		this.stats.radialGrid[rD] += 1;
		//var xRa = Math.abs(xR), yRa = Math.abs(yR);
		this.centroid.vectorsum.x += xR;
		this.centroid.vectorsum.y += yR;
		this.centroid.vectorsum.r += rR;
		this.centroid.vectorsum.g += gR;
		this.centroid.vectorsum.b += bR;
		this.centroid.vectorsum.xa += a.x - b.x;
		this.centroid.vectorsum.ya += a.y - b.y;
		this.centroid.vectorsum.d += d;
		if (d > this.centroid.vectorstat.maxDistance){
			this.centroid.vectorstat.maxDistance = d;
			this.centroid.vectorstat.maxX = xR;
			this.centroid.vectorstat.maxY = yR
		}
		if (d < this.centroid.vectorstat.minDistance){
			this.centroid.vectorstat.minDistance = d;
			this.centroid.vectorstat.minX = xR;
			this.centroid.vectorstat.minY = yR		
		}
		/*this.centroid.vectorstat.maxDistance = (d > this.centroid.vectorstat.maxDistance) ? d: this.centroid.vectorstat.maxDistance;
		this.centroid.vectorstat.minDistance = (d < this.centroid.vectorstat.minDistance) ? d: this.centroid.vectorstat.minDistance;
		this.centroid.vectorstat.maxX = (xRa > this.centroid.vectorstat.maxX) ? xRa: this.centroid.vectorstat.maxX;
		this.centroid.vectorstat.minX = (xRa < this.centroid.vectorstat.minX) ? xRa: this.centroid.vectorstat.minX;
		this.centroid.vectorstat.maxY = (yRa > this.centroid.vectorstat.maxY) ? yRa: this.centroid.vectorstat.maxY;
		this.centroid.vectorstat.minY = (yRa < this.centroid.vectorstat.minY) ? yRa: this.centroid.vectorstat.minY;*/
	};
	i.getVectorSumFinite = function(){
		return {
			x: this.centroid.x + this.centroid.vectorsum.x,
			y: this.centroid.y + this.centroid.vectorsum.y,
			d: this.centroid.d + this.centroid.vectorsum.d,
			r: this.centroid.r + this.centroid.vectorsum.r,
			g: this.centroid.g + this.centroid.vectorsum.g,
			b: this.centroid.b + this.centroid.vectorsum.b
		}
	},
	i.getVectorSumFlipX = function(){
		//used as a hyperplane pointer!
		return {
			x: this.centroid.x - this.centroid.vectorsum.x,
			y: this.centroid.y + this.centroid.vectorsum.y,
			d: this.centroid.d + this.centroid.vectorsum.d,
			r: this.centroid.r + this.centroid.vectorsum.r,
			g: this.centroid.g + this.centroid.vectorsum.g,
			b: this.centroid.b + this.centroid.vectorsum.b
		}	
	},
	i.getVectorSumRelative = function(centroid){
		return this.centroid.vectorsum;
	}
	i.getNormalVectorSumFinite = function(centroid){
		var vs = this.centroid.vectorsum;
		var m = this.centroid.neighborhood.length;
		return {
			x: this.centroid.x - vs.x / m,
			y: this.centroid.y - vs.y / m,
			d: this.centroid.d - d / m,
			m: m,
			r: this.centroid.r - vs.r / m,
			g: this.centroid.g - vs.g / m,
			b: this.centroid.b - vs.b / m
		};
	};
	i.getNormalVectorSumSmooth = function(){
		var vs1 = this.getNormalVectorSum(this.centroid);
		var vs2 = this.getNormalVectorSum(this.last);
		return {
			x: (vs1.x + vs2.x) / 2,
			y: (vs1.y + vs2.y) / 2,
			d: (vs1.d + vs2.d) / 2,
			m: 2,
			r: (vs1.r + vs2.r) / 2,
			g: (vs1.g + vs2.g) / 2,
			b: (vs1.b + vs2.b) / 2
		};
	};
	i.getMovementVector = function(){
		return this.centroid.vector
	};
	//Peer related functions
	//Cascade movement?
	//max distance (if over max, move toward by (ease))
	i.peers = LL(); //peers is a linked list;
	i.hasPeers = false;
	i.addPeer = function(p, r){
		//p should be a perceptoid
		//r is the relationship
		var rel = this.getNewRelationship();
		merge(rel, r);
		var rV = Vec(this.centroid);
		rel.startDist = rV.distance(p.centroid);
		this.peers.push({p: p, r: rel});
		this.hasPeers = true;
	};
	i.getNewRelationship = function(){
		return {
			distMax: 2,
			distMin: 1,
			ease: 0.01,
			easeAlign: 0.25
		};
	}

	//Overclocked Delaunay and Voronoi capabilities
	i.triangulate = function(){
		switch (this.scanType){
		case 'delaunay':
			this.delaunay = Triangulate(this.centroid.neighborhoodFinite);
			break;
		case 'graham':
			var hull = new ConvexHullGrahamScan();
			hull.addPoint
			this.graham = hull.getHull();
			break;
		case 'voronoi':
			var r = this.r;
			this.voronoi = this.rVoronoi.compute(this.centroid.neighborhoodFinite, {
				xl: this.centroid.x - r,
				xr: this.centroid.x + r,
				yt: this.centroid.y - r,
				yb: this.centroid.y + r
			});
			break;
		//case ''
		}
		
	};
	i.getPolygonalArea = function(centroid){
		//delaunay triangulate
		//Note from delaunay.js" If the bounding triangle 
		// is too large and you see overflow/underflow errors. If it is too small 
		// you end up with a non-convex hull.
		//  ... use that to help calculate z distance of perceptoid!
		//this.centroid.perimiter = ...
		//this.centroid.area = ...
		//z-distance delta can also be calculated when a
		//delaunay statistics of general triangle type density in entire neighborhood
		// ie: 2 angles can be used to represent the triangle 
	};
	i.getPopulationDensity = function(centroid){
		var area = this.getPolygonalArea();
		var population = this.centroid.neighborhood.length;
		return population / area;
	};
	
	//Rhill-Voronoi capabilities
	
	//closest neighbor delta matrix
	//delta of delta
	//in frame n - 1, all delta and all centroid data can be used to try
	//to calculate fluid inner movement transforms
	//using closest neighbor lookup in the neighbor's kdtree
	//	points in n can be paired with points in n-1
	//	longer vectors denote less LOD, and more 
	
	//DELTA - all localized changes mapped to delta
	i.getNewDeltaFrame = function(){
		return {
			x: 0,
			y: 0,
			velocity: {
				x: 0,
				y: 0,
				d: 0
			},
			n: {
				size: 0,
				hyperVector: {},
				perimiter: 0,
				area: 0
			}		
		};
	}
	i.getNewDeltaMatrix = function(){
		return {
			cur: i.getNewDeltaFrame(),
			min: i.getNewDeltaFrame(),
			max: i.getNewDeltaFrame(),
			avg: i.getNewDeltaFrame(),
			subtract: function(d2){
				//subtract the values from delta matrix d2
			},
			add: function(d2){
			
			}
		}		
	}
	
	//Set delta matrix
	//each item is a delta level
	i.delta = i.getNewDeltaMatrix();
	i.delta2 = {};
	
	i.getDelta = function(l){
		return this.delta;
	};
	i.setDelta = function(l){
		
	};
	//Puts a property into a delta frame
	//Merges the data from p into frame f
	//f = frame, p = property
	i.putDelta = function(f, p){

	};
	//Puts an entire frame in a delta matrix
	//d = the delta matrix to put the frame in
	//ctx = cur, min, max, avg
	//f = the delta frame
	i.putDeltaFrame = function(d, ctx, f){

	};
	//behaviour function overrides (not overwriting the function, but bypassing it with your own)
	//for custom rules as to how the boid behaviour algorithm of how the perceptoid should calculate follow, stay, avoid, and search behaviours
	// arguments passed to override functions are: [this.centroid, this.last]

	//z-Infinity: VectorSum Clear frequency
	//The VectorSum is a 2D vector magnitude which is the sum of the x/y difference of all neighboring points, 
	//	It's valence is vectorsum / maxVectorsum possible / time - maxVectorsum determined as MaxN * r
	//	it has not been rooted, it is left as a magnitude
	//	it is buffered in such a way that each successive call to clearInputs adds the normal vector magnitude to 
	//		the previous magnitude, until it resets at "infinity" along the Hyperplane z-Axis
	//		this frequency is set, while planes that can be measured along the HZ-axis can only
	//		be in the resolution of what you set zInfinity to.  Numbers like 20 are great to experiment with.
	//		Such that if the 2D hyperplane is closer to 0, it's exponentially closer to it's next neighbor plane
	//		but still only zInfinity - zDepth steps away from infinity.  This is a parabolic equation.
	//		zDepth is not an exact match to real depth, but rather a try at a relational approximation of depth-of-focus for the perceptoid
	//	The inner radius of the perceptoid should be able to fluctuate in some relationship to the target zPlane
	//Higher numbers of zInfinity mean more precision toward infinity, but be careful for 16-bit integer cap
	i.zInfinity = 20;	//steps until infinity barrier; frequnency of vectorsum clear
	//the depth of the zPlane ther perceptoid is targeting; manual clear frequency dropout
	//and the moveXY cutoff magnitude depth
	i.zPlanes = {
		/* this is somehow related to the real size of the 2D plane you're trying to interact with (or point to a spot on if using perceptoid as hyperpointer)
			Think of it as a very big circle that you scale down so that the rectangle your target hyperplane fits inside of it (circumscribed) */
		target: {
			depth: Math.floor(i.zInfinity * 0.15),
			dropoutVector: {},
			intersected: false
		},
		/* moveXY should stay a low depth because it's a low order of magnitude of movement*/
		moveXY: {
			depth: Math.floor(i.zInfinity * 0.01),
			dropoutVector: {},
			intersected: false
		}
	};

	//zPlanes - the lookup table for what frequency each step toward infinity is at zDepth normalized
	//trying to set it so that zDepth can tuned to a unit of depth measure like feet or meters
	//different scenes with different objects will have a zdepth.
	//1/Zc might match the difference between units approaching hyperplane z-infinity and real world finite depth units
	i.lookup.zPlanes = [];
	for (var zc = 0; zc < i.zInfinity; zc++)
		i.lookup.zPlanes.push(i.zInfinity * (1 / zc));
	i.zStep = 0;
	i.clearRef = null;
	i.cfd = false;
	i.dropoutVector = {};
	
	//Input data clearing (used automatically when a new frame of points or vectors are a
	i.clearInputData = function(){
		this.last = this.centroid;
		this.lastPoints = this.points;
		//this.points = [];
		//this.last.neighborhood = this.centroid.neighborhood;
		//this.last.vectorsum = this.centroid.vectorsum;
		//if max radius is 5 / 30, and 
		this.centroid.neighborhood = [];
		this.centroid.neighborhoodFinite = [];
		this.activated = false;
		if (this.zStep >= this.zInfinity){
			var vs = this.centroid.vectorsum;
			//this.centroid.vectorsum = (this.clearRef == null) ? {x: 0 , y: 0, d: 0}: {x: vs.x - this.clearRef.x, y: vs.y - this.clearRef.y, d: 0};
			this.events.peakNormalVectorSum(vs);
			this.centroid.vectorsum = {x: 0 , y: 0, d: 0, r: 0, g: 0, b: 0};
			this.centroid.vectorstat = {maxDistance: 0, minDistance: this.r, maxX: 0, minX: this.r, maxY: 0, minY: this.r};
			this.zStep = 0;
			//this.cfd = false;
			this.zPlanes.target.intersected = false;
			this.zPlanes.moveXY.intersected = false;
			this.clearRef = {x: vs.x, y: vs.y, d: vs.d};
		}else{
			//Hyper zPlane dropout points
			//if (this.centroid.neighborhood.length > 0){
				if (!this.zPlanes.moveXY.intersected){
					if (this.zStep >= this.zPlanes.moveXY.depth){
						var vec = this.getVectorSumFinite();
						this.zPlanes.moveXY.dropoutVector = vec;
						this.zPlanes.moveXY.intersected = true;
						//This is a naive direct placement test
						//this.moveCentroidTo(vec.x, vec.y);
						//var m = this.movement;
						//m.xFrameVelocity += (1 - 1 / vec.x) * m.xFactor;
						//m.yFrameVelocity += (1 - 1 / vec.y) * m.yFactor;
					}
				}
			//}
			if (!this.zPlanes.target.intersected){
				if (this.zStep >= this.zPlanes.target.depth){
					//Dropout vector is used for drawing a line to the finite point on the canvas
					this.dropoutVector = (this.isHyperPointer) ? this.getVectorSumFlipX(): this.getVectorSumFinite();
					this.zPlanes.target.intersected = true;
				}
			}
		}
		this.zStep++;
		//Remove and place in some event function
		//IF hyperpointer, than output this vector as scaled virtual hyperplane coordinates
		//drawLine(this.centroid, (this.isHyperPointer) ? this.getVectorSumFlipX(): this.getVectorSumFinite());
		//if (this.dropoutVector.hasOwnProperty('x')) drawLine(this.centroid, this.droupoutVector);
	};
	
	i.resetCentroid = function(){
		i.centroid = Centroid(this);
		i.last = {};
	};
	
	/***
	Events
		bound with 'on' method perceptoid.on('activate', function(){});
		only one function can be bound to each event type per perceptoid
		bindable events:
			activate - when a perceptoid goes from 0 neighbors to > 0 neighbors
			activate-thresh - when a perceptoid goes from below threshold to above in neighbor count
			activate-thresh-density - when perceptoid density goes from below thresh to above
				density is calculated as n / maxn * centroid.vectorsum.d
			deactivate - opposite of activate
			deactivate-thresh - opposite of activate-thresh
			deactivate-thresh-density - opposite of activate-thresh-density
			
	***/
	i.events = {
		activate: function(data){
		
		},
		deactivate: function(data){
		
		},
		changeNormalQuadrant: function(data){
		
		},
		peakNormalVectorSum: function(data){
			//The moment directly before the normal vector sum resets
			//data represents a 2D magnitude scalar as an integer... 
			//	sqrt it to get it's normalized line distance
			//	or perform some other faster process to get a normalized interpolation lookup for something of that magnitude
			
		},
		dropoutNormalVectorSum: function(data){
			//When the normal vector drops out of it's propagation toward it's peak magnitude
			//this is used for scaling down motion
		},
		addVector: function(data){
			//When a vector is added (for line drawing for instance)
		},
		/* Movement */
		move: function(data){

		},
		changeDirection: function(data){

		},
		moveStart: function(data){

		},
		moveEnd: function(data){

		}
	};
	i.on = function(event, func){
		if (this.events.hasOwnProperty(event)) this.events[event] = func;
	}
	i._callEvent = function(event, data){
		this.events[event](data);
		return this;
	}

	/*** Behaviour - based on Boids algorithm
		order/level of operation: align/points, cohere/points, separate/peers
		seperate only is applied when the perceptoid is in a network
		
		needed: data about movement velocity vectors from lodtree with a n-1 frame of neighbors
			lodtree used to group neighbors into a radial array with weights
			
	***/
	i.step = function(){
		//Should be called per frame of point cloud tree data
	
		//Clear the data
		this.clearInputData();

		//Populate the local neighborhood
		var cl = 0;
		var useHue = this.color && this.hue && this.colorMiddle != null;
		var plen = this.points.length;
		var cent = this.centroid;
		var centvec = Vec({x: cent.x, y: cent.y, r: cent.r, g: cent.g, b: cent.b});
		var lo, hi, flo, fhi, context, plr, spcpos;
		if (useHue){
			cmid = this.colorMiddle;
			lo = cmid.h - this.hr;
			hi = cmid.h + this.hr;
			flo = lo;
			fhi = hi;
			context = {x: 0, y: 0, r: 0, g: 0, b: 0, h: cmid.h, s: 1, l: 0.5};
			plr = (1 / plen) * this.colorEase;
		}
		for (var li = 0; li < plen; li++){
			var t = this.points[li];
			var p = t[0];
			var d = t[1];
			//If within color radius
			var cwr = true;
			//If within spatial radius
			var swr = (d < this.r2);

			//Color Filter: Only follow local neighborhood within color range
			//	if color, include R, G, B, H, S, L along with X, Y
			if (this.color && swr){
				//If Hue is turned on (default) then HSL will be used instead of RGB
				if (this.hue){
					//True color mode, filters only points within range determined by hr (hue radius)
					var hsl = rgbToHsl(p.pixel.r, p.pixel.g, p.pixel.b);
					var ph = hsl[0];
					p.pixel.h = hsl[0]; p.pixel.s = hsl[1]; p.pixel.l = hsl[2];
					spcpos = false;
					if (lo < 0){
						//lo becomes hi, negative space
						cwr = (ph >= lo + 1 || ph <= hi);
						flo = 1 + lo;
					}else{
						if (hi > 1){
							//hi becomes lo, negative space
							cwr = (ph <= hi - 1 || ph >= lo);
							fhi = hi - 1;
						}else{
							//lo and hi within 0 and 1, positive space
							cwr = (ph >= lo && ph <= hi);
							spcpos = true;
						}
					}
				}else{
					//RGB color mode (R, G, an B are a "product" of H, S, and L)
					//	thus their coordinate space appears detached from the true color
					var ul = this.mode.color.useLimits;
					if (ul >= 1){
						//Only include point if within color limits
						var pix = p.pixel;
						var lim = this.limits;
						cwr = (pix.r > lim.r0 && pix.r < lim.r1 &&
							pix.g > lim.g0 && pix.g < lim.g1 &&
							pix.b > lim.b0 && pix.b < lim.b1)
					}
					if (ul >= 2 && cwr){
						//Only include point if within the color radius cubed
						var cdist = centvec.colorDistance(p.pixel);
						cwr = (cdist < this.cr3);
					}
				}
			}
			//If point is within local space/color range, add it's vector to neighborhood
			if (swr && cwr){
				//Fire the add vector event for anyone wanting to grab direct vector information
				this.events.addVector({
					centroid: cent,
					point: p,
					distance: d
				});
				//Add the vector to the local neighborhood
				this.addVector(cent, p, d);
				cl++;
			}
			//Context is used to shift the hue when the percepoid finds itself below minimum neighborhood while using color
			//	If a point is not within color range, add a scaled version to context color
			if (!cwr && useHue){
				var distlo = p.pixel.h - flo, disthi = p.pixel.h - fhi;
				var distShort = (distlo > disthi) ? disthi: distlo;
				//var phr = (p.pixel.h > ) (spcpos) ? p.pixel.h - context.h: context.h - p.pixel.h;
				context.h += distShort * plr;
				//hue is circular
				context.h += (context.h < 0) ? 1: (context.h > 1) ? -1: 0;
				//context.s += p.pixel.s * plr;
				//context.l += p.pixel.l * plr;
			}
		}
		var g = (this.activated) ? true: false;
		this.activated = (cl > this.nmin);
		//If activation toggles on or off, fire events: activate, deactivate
		if (g != this.activated){
			if (this.activated){
				this.events.activate(this);
			}else{
				this.events.deactivate(this);
			}
		}
		//If activated, flock toward local neighborhood points
		if (this.activated){
			if (useHue) this.centroid.lastContext = context;
			//In scan mode calculate triangulation function: delaunay, quickhull, voronoi, etc.
			if (this.scan){
				this.triangulate();
			}
			//Point neighborhood flocking
			//console.log('--Start: ' + this.centroid.velocity.r);
			if (this.mode.points.alignment == 0){
				this.centroid.velocity.add(this.align());		//Point the centroid
				//console.log('align: ' + this.centroid.velocity.r);
			}
			if (this.mode.points.movement == 0){
				this.centroid.velocity.add(this.cohere());		//Cohere
				//console.log('cohere: ' + this.centroid.velocity.r);
				this.centroid.velocity.add(this.separate());	//Separate
				//console.log('separate:  ' + this.centroid.velocity.r);
				this.moveCentroidRelative(cent.velocity);		//Move the centroid
			}
			if (this.lookup.avoid.length > 0){
				var av = this.lookup.avoid;
				for (var ia = 0; ia < av.length; ia++){
					this.centroid.velocity.add(this.moveAvoid(av[ia]));
				}
			}
		}else{
			//If the hue and color is activated, AND adjustHue: change color middle to new color
			if (useHue && this.adjustHue && this.centroid.lastContext != null && this.colorMiddle.h != this.centroid.lastContext.h){
				//console.log(this.colorMiddle.h, this.centroid.lastContext.h);
				this.colorMiddle.h = this.centroid.lastContext.h;
			}
		}
		//Peer neighborhood flocking
		if (this.hasPeers && !this.activated){
			if (this.mode.peers.movement == 0){
				this.centroid.velocity.add(this.peerCohere());
				this.centroid.velocity.subtract(this.peerSeparate());
				this.moveCentroidRelative(this.centroid.velocity);
			}
		}
		this.clip();
		//Fire the move event so caller can read perceptoid information
		if (this.centroid.velocity.x != 0 || this.centroid.velocity.y != 0){
			this.events.move(this);
		}
		//this.addMovePointNow();
	}

	i.moveFollow = function(){
		this.centroid.velocity.add(this.objectCohere(i));
		this.centroid.velocity.add(this.objectAlign(i));
	};

	i.moveAvoid = function(i){
		//subtracts from velocity using cohere, align
		this.centroid.velocity.subtract(this.objectCohere(i));
		this.centroid.velocity.subtract(this.objectAlign(i));
	};

	//Object based movement and alignment
	//Must use an object which has: {x, y, velocity: [x, y]}
	i.objectCohere = function(obj){
		//find vector diff, add scaled vdiff return
		var v = this.centroid.velocity;
		var d2 = distance(this.centroid, obj);
		//v.scale(1 / this.centroid.neighborhood.length);
		//v.subtract(this.centroid.vectorsum);
		//v.scale(1 / this.centroid.neighborhood.length);
		v.scale(this.ease);
		return v;		
	};
	i.objectAlign = function(){

	};
	
	i.steer = function(){
		//moves the centroid 1 frame
		//align -> cohere -> separate, or...
		//separate -> align -> cohere
		if (!this.staticHeading) this.align();
		if (!this.staticLocation) this.cohere();
		this.separate();
	};
	i.getNormal = function(){
		//get overall rise/run by adding all x/y together
		//rotate vector toward heading normal as 0deg
	};
	i.clip = function(){
		if (this.centroid.x > this.limits.x1){ this.centroid.x = this.limits.x1; this.centroid.velocity.x=0;}
		if (this.centroid.x < this.limits.x0){ this.centroid.x = this.limits.x0; this.centroid.velocity.x=0;}
		if (this.centroid.y > this.limits.y1){ this.centroid.y = this.limits.y1; this.centroid.velocity.y=0;}
		if (this.centroid.y < this.limits.y0){this.centroid.y = this.limits.y0; this.centroid.velocity.y=0;}
		if (this.color){
			if (this.centroid.r > this.limits.r1){ this.centroid.r = this.limits.r1; this.centroid.velocity.r=0;}
			if (this.centroid.r < this.limits.r0){this.centroid.r = this.limits.r0; this.centroid.velocity.r=0;}
			if (this.centroid.g > this.limits.g1){ this.centroid.g = this.limits.g1; this.centroid.velocity.g=0;}
			if (this.centroid.g < this.limits.g0){this.centroid.g = this.limits.g0; this.centroid.velocity.g=0;}
			if (this.centroid.b > this.limits.b1){ this.centroid.b = this.limits.b1; this.centroid.velocity.b=0;}
			if (this.centroid.b < this.limits.b0){this.centroid.b = this.limits.b0; this.centroid.velocity.b=0;}
		}
		if (isNaN(this.centroid.x) || isNaN(this.centroid.y)) this.resetCentroid();
	};
	i.cohere = function(){
		var v = this.centroid.velocity;
		var d = 1 / this.centroid.neighborhood.length;
		v.scale(d);
		v.colorScale(d);
		v.subtract(this.centroid.vectorsum);
		v.scale(this.ease);
		v.colorScale(this.colorEase);
		return v;
	};
	i.separate = function(){
		//calculate the distance to this.neighbor
		var v = Vec({x:0, y:0, d:0, r:0, g:0, b:0});
		var n = this.centroid.neighborhood;
		for (var i = 0; i < n.length; i++){
			// > ir2 means that it's in the outer ring of neighbors
			// In this case I'm making it separate as much as possible from the outer neighbors
			// This is the "atomic" approach as compared to the "cellular" approach to inner-outer radii neighbors
			if (n[i].d > this.ir2){
				v.subtract(n[i]);
				v.add(this.centroid);
			}
		}
		v.scale(this.ease);
		v.colorScale(this.colorEase);
		return v;
	};
	//alignment / orientation
	i.align = function(){
		//Changing ease changes the speed: more ease, more speed
		//Play with number of neighbors compared to radius sizes compared to point density of screen

		//Should it avoid neighborhood size and polygonal perimiter delta changes?
		//	for instance, if known flock velocity is ->A and 
		//calcualte normal vector for all points, compare to last normal vector or last n normal vectors for 
		//store a current vector sum scaled by ease - compare to last n vector sums
		//that gets velocity
		//then... add to this.centroid.velocity
		//or to scale that vector by some ease value, and then 
		//set that as the centroid's normal
		//TODO
		//polygonal circumference of delaunay triangluation is an area measurement
		//	use are measurements to follow the z-Dilation of an object a perceptoid is following
		//	change the centroids inner and outer radii accordingly
		//TODO
		// include the Z axis!  z-align, z-cohere, and z-separate
		var cur = this.centroid;
		var last = this.last;
		var v = this.centroid.velocity;
		var d = 1 / cur.neighborhood.length;
		if (typeof last.vectorsum !== 'undefined'){
			if (cur.neighborhood.length > 0 ){
				var a = Vec(cur.vectorsum);
				a.subtract(last.vectorsum);
				var scale = 1 / (cur.neighborhood.length + last.neighborhood.length);
				a.scale(scale);
				a.colorScale(scale);
				//this.centroid.moveVector
				v.add(a);
				v.scale(d);
				v.colorScale(d);
				v.subtract(a);
				v.scale(this.easeAlign);
				v.colorScale(this.colorEase);
			}
		}
		return v;
		//as secondary rule, anti-wobble... compare relative 
		/*v.x = v.y = 0;
		var nd = 0;
		for (var i = 0; i < n; i++) 
		{
			var b2 = boids[i];
			if (b != b2)
			{
				var d = geom.Vector2D.distance2(b.pos, b2.pos);
				if (d < r)
				{					
					v.add(b2.vel);
					nd++;
				}
			}
		}
		if(nd)
		{			
			v.scale(1 / nd);
			v.subtract(b.vel);
			v.scale(1/8);
		}
		return v;*/
	};
	//Peer Based flocking rules
	i.peerCohere = function(){
		var v = Vec({x:0,y:0,d:0});
		//var v = Vec(this.centroid);
		this.peers.reset();
		var n = this.peers.next();
		while (n != null){
			var vv = Vec(n.p.centroid);
			vv.subtract(this.centroid);
			v.add(vv);
			n = this.peers.next();
		}
		v.scale(1 / this.peers.count);
		//v.subtract(this.centroid);
		v.scale(0.0005);
		return v;
	};
	i.peerSeparate = function(){
		//calculate the distance to this.neighbor
		var v = Vec({x:0, y:0, d:0});
		//var v = Vec(this.centroid);
		this.peers.reset();
		var n = this.peers.next();
		while (n != null){
			var rV = Vec(this.centroid);
			var d = rV.distance(n.p.centroid);
			var dRel = d / n.r.startDist;
			if (dRel < n.r.distMin){
				v.subtract(n.p.centroid);
				v.add(this.centroid);
				v.scale(0.1);
			}
			n = this.peers.next();
		}
		return v;
	};
	
	//Simple API modality settings, movement and orientation of centroid
	i.stay = function(){
		i.mode.points = 1;
	};
	i.follow = function(){
		i.mode.points = 0;
	};
	i.avoid = function(){
		i.mode.points = 3;
	};
	i.search = function(objClass){
		//takes an object class from the NN
		//search for it by travelling nearest neighbors
	};
	i.moveCentroidTo = function(x, y){
		this.centroid.x = x;
		this.centroid.y = y;
	};
	i.colorCentroidRelative = function(p){
		this.centroid.r = this.centroid.r - p.r;
		this.centroid.g = this.centroid.g - p.g;
		this.centroid.b = this.centroid.b - p.b;		
	};
	i.moveCentroidRelative = function(p){
		this.centroid.x = this.centroid.x - p.x;
		this.centroid.y = this.centroid.y - p.y;
		if (this.color) this.colorCentroidRelative(p);
	};
	i.moveCentroidRelativeFlip = function(p){
		this.centroid.x = this.centroid.x + p.x;
		this.centroid.y = this.centroid.y + p.y;
		if (this.color) this.colorCentroidRelative(p);
	};
	i.getRelativeLocation = function(){
		//returns x, y location as relative to limits
		return {
			x: (this.limits.w != 0) ? (this.centroid.x - this.limits.x0) / this.limits.w: 0,
			y: (this.limits.h != 0) ? (this.centroid.y - this.limits.y0) / this.limits.h: 0
		};
	};
	i.setRadius = function(r){
		i.r = r;
		i.r2 = r * r;
	};
	i.setColorRadius = function(c){
		i.cr = c;
		i.cr3 = c * c * c;
		this.setColorLimits(this.limits, this.colorMiddle);
	};
	i.setVelocity = function(v){
	
	};
	i.setNormalHeading = function(n){
	
	};
	i.colorStay = function(){
		this.colorMiddle = {
			r: this.centroid.r,
			g: this.centroid.g,
			b: this.centroid.b
		};
		this.mode.color.follow = true;
		this.mode.color.useLimits = 1;
	};
	i.setColorMiddle = function(c){
		if (c.hasOwnProperty('r')){
			this.colorMiddle = {
				r: c.r,
				g: c.g,
				b: c.b
			};
		}
		if (!c.hasOwnProperty('h')){
			var hsl = rgbToHsl(c.r, c.g, c.b);
			this.colorMiddle.h = hsl[0];
			this.colorMiddle.s = hsl[1];
			this.colorMiddle.l = hsl[2];
		}
		this.setColorLimits(this.limits, this.colorMiddle);
	};
	i.containsPoint = function(p){
		var v = Vec(this.centroid);
		var d = v.distance(p);
		return (d < this.r2);
	};
	
	//convNet training
	//initialization and capture for frames / time
	i.train = function(action, framedata, timestamp){
	
	};
	i.steerCompensate = function(){
		//gives compensation to the perceptoid when it is confirmed to still be tracking the same object
		//NN: inputs from working data: seperateRatio, alignRatio, cohereRatio
		//
	};

	/* Movement - for storing fuzzy lists of 0 rotated, centroid relative vectors
		output address [[p1, p2], [p1, p2], ...]
		threshold is the velocity ^ 2 distance of minimal velocity to be considered moving
	*/
	/*
	i.movement = {};
	i.movement.threshold = 0.1;
	i.movement.on = false;
	i.movement.onLast = false;
	i.movement.history = LL();
	i.resetMovement = function(){
		this.movement.cur = LL();
		this.movement.curStart = Date.now();
	};
	i.resetMovement();
	i.addMovePoint = function(p){
		this.movement.cur.push(p);
		this.movement.on = (this.centroid.velocity.x > this.movement.threshold || this.centroid.velocity.y > this.movement.threshold);
		if (this.movement.on != this.movement.onLast){
			if (this.movement.on){
				this.startMovement();
			}else{
				this.finishMovement();
			}
		}
		this.movement.onLast = this.movement.on;
	};
	i.addMovePointNow = function(){
		this.addMovePoint({x: this.centroid.x, y: this.centroid.y});
	}
	i.addMovePointNow();
	//i.addMovePoint({x: this.centroid.x, y: this.centroid.y});
	i.getMovment = function(){
		return this.movement.cur;
	};
	i.getMovementRelative = function(p){
		//returns current movement in as it's finite relation to p ... p.x, p.y
		//for use at end of a movement to store as end-relative
	};
	i.getMovementHistory = function(){

	};
	i.getMovementColor = function(){
		var c = this.movement.history.count;
		var m = this.draw.style.movement;
		m.r += m.velocity.r;
		m.g += m.velocity.g;
		m.b += m.velocity.b;
		if (m.r > 255){ m.r = 255; m.velocity.r *= -1;}
		if (m.r < 0){ m.r = 0; m.velocity.r *= -1;}
		if (m.g > 255){ m.g = 255; m.velocity.g *= -1;}
		if (m.g < 0){ m.g = 0; m.velocity.g *= -1;}
		if (m.b > 255){ m.b = 255; m.velocity.b *= -1;}
		if (m.b < 0){ m.b = 0; m.velocity.b *= -1;}
		return 'rgba(' + m.r + ',' + m.g + ',' + m.b + ', ' + m.a + ')';
	};
	i.startMovement = function(){
		this.resetMovement();
		this.movement.loc = {
			start: {x: this.centroid.x, y: this.centroid.y},
			end: false,
		};
	};
	i.finishMovement = function(){
		//commit the movement to history
		this.movement.history.push({
			time: {
				end: Date.now(),
				start: this.movement.curStart
			},
			loc: {
				end: {x: this.centroid.x, y: this.centroid.y},
				start: {x: this.movement.loc.start.x, y: this.movement.loc.start.y}
			},
			movement: this.movement.cur,
			color: this.getMovementColor()
		});
	};
	i.clipMovements = function(){
		//centroid.velocity: > movement.threshold = start, < movement.threshold = end
	};
	*/

	//Data streams - for streaming live perceptoid data to somewhere else
	//	or analyzing the time samples for grabbing sums / minmax / avgmean / deltas and
	//		throwing the stream into the perceptoid cluster's super-Centroid
	//		or give it a data encoder function which can be set which stores the
	//			centroids over the time axis
	//	Delta Stream - Thanks Perico!
	//	Stream compression idea: just stream delta like in video compression
	//		as long as delta holds enough data about the perceptoids,
	//		a receiving perceptoid on the other side of two networked computers can replay
	//		live peer-2-peer gaming: 
	//			perceptoids can be linked and syncrhonized to 0 latency as long as the connection is quick enough
	//			delta streaming might be possible, but either that or compressed bytecode representations of the important control data for each perceptoid
	//			the two linked perceptoids would have like a quantum link
	//			so in the future when data is sent through the quantum hyperplane, a perceptoid might be on either end of the call ;)
	
	//Message system
	//add and get next messages to display next
	//to the perceptoids
	i.messages = {
		messages: [],
		add: function(m){
			var d = new Date();
			var message = {
				x: 0,
				y: 0,
				text: '',
				time: d.now()
			};
			merge(message, m);
			this.messages.push(message);
		},
		get: function(){
			//return current 0 message
		},
		nextMessage: function(){
			//next shifts the 0 message off the array
		}
	};

	i.stream = function(){
		return {
			type: 'point', /* May be: point, peer, centroid, delaunay, cluster, network
							  Anything, as long as when you compare streams they are the same type 
							  A frame could very easily be based on finite frames or frames over measured time*/
			maxFrameBuffer: 64,
			frameBuffer: {
				id: 0,
				name: 'stream',
				current: null, 
				last: null,
				frames: {
					id: 0,
					next: null
				}
			},
			read: function(){
				//pops first frame off of the frame buffer and sets second frame to current node
			},
			write: function(frame){
				//adds a frame to the last node
			}
		}
	};
	
	i.r2 = i.r * i.r;
	i.ir2 = i.ir * i.ir;
	if (i.hasOwnProperty('cr')) i.cr3 = i.cr * i.cr * i.cr;
	//Golden ratio for inner/outer radius growth checking
	i.rRo = i.r * 1.61803398875;
	i.rRi = i.r * 0.61803398875;
	return i;
}

/*** Notes
include n-frame time regresssion in action histogram
automatic action slicing?  Using the motion and transforms of the perceptoid to slice timestamped data into actions/sub-actions
The arc-slice of the min/max point angles in the neighborhood that fall near the radius distance
	can be quantified as a normal vector
The normal vector of all angles 
***/

/*
	PerceptoidLayout - pre-defined or custom, flexible layouts for perceptoids
		Grid, circle, Spiral, Polygonal shape, Cross, Matrix
		Layout defined as a set of point relationships
			peer: minDistance, maxDistance, 
		A layout affects each perceptoid in it by modifying it's vector to try to maintain the same distance from a given peer
		Input options: type, data, 
		Layout positions come in relative x,y from a centroid
			Only x,y information is provided to a scale -1 to 1, 
			this is multiplied by the size
		include option to set default relationships in layout

*/
var PerceptoidLayout = function(i){
	//size, type, [ radius ]
	if (!i.hasOwnProperty('size') || 
		!i.hasOwnProperty('type')) 
		return null;
	var s = i.size;
	var o = new LL(null);
	switch (i.type){
	case 'grid':
		break;
	case 'circle':
		if (i.hasOwnProperty('radius')){
			var fc = Math.PI * 2;
			var stepSize = fc / s;
			var id = 0;
			for (var a = 0; a < fc; a+=stepSize){
				var x = Math.floor(Math.cos(a) * i.radius);
				var y = Math.floor(Math.sin(a) * i.radius);
				o.push({i: id, x: x + i.x, y: y + i.y});
				id++;
			}
		}
		break;
	case 'spiral':
		//startradius, endradius
		break;
	case 'custom':
		break;
	case 'cross':
		break;
	case 'matrix':
		break;
	}
	return o;
};

/*
	PerceptoidCluster - Grouping perceptoids
		peer 2 peer behaviour rules between perceptoids
		a cluster includes a layout
		A cluster has it's own centroid
	separates from neighbors
*/
var PerceptoidCluster = function(i){
	//Initialize the perceptoid cluster
	i.centroid = Centroid(i);
	i.layout = PerceptoidLayout(i);
	/* setNeighbors
		n: a list of centroids
		must be perceptoid centroids because velocity data already exists
	*/
	i.setNeighbors = function(n){
		this.centroid.neighborhood = n;
		this.neighborFactor = 1 / this.centroid.neighborhood.length;
	};
	// n: a centroid
	i.addNeighbor = function(n){
		this.centroid.neighborhood.push(n);
		this.neighborFactor = 1 / this.centroid.neighborhood.length;
	};

	//Go through layout and create perceptoids
	//with the proto function provided by i
	//Create left-right peers in each one
	i.layout.reset();
	var n = i.layout.next();
	while (n != null){
		//merge the layout 
		var p = i.proto();
		merge(p, n);
		i.addNeighbor(Perceptoid(p));
		n = i.layout.next();
	}
	i.getPerceptoidArray = function(){
		return this.centroid.neighborhood;
	};

	i.setLayout = function(l){
		i.layout = PerceptoidLayout(l);
	};
	i.separate = function(dRange){
		var v = Vec({x: 0, y: 0, d: 0});
		if (typeof dRange === 'undefined') return v;
		var c = Vec(this.centroid);
		for (var i = 0; i < this.peers.length; i++){
			//Difference
			c.subtract(this.peers[i].centroid);
			v.add(this.centroid);
		}
		v.scale(this.ease);
		return v;
	};
	i.moveCentroidTo = function(p){
		this.centroid.x = p.x;
		this.centroid.y = p.y;
	}
	return i;
};

/*
	Network functionality for perceptoid clusters
	Can use webRTC for network, or internal (same hyperplane) network
	Different clusters have different relationships to each other cluster on the network
		they are linked to other clusters
		if they are linked to 
*/
var PerceptoidNetwork = function(i){

};
