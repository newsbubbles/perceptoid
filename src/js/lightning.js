  
  	/** Lightning stack - 3d control with any camera
  		creator: Nathaniel Dwight Gibson
  		License: GNU General public licnese
  		Blockchain code: fdc656779d118d3831e4ede79b05970c5d741570db995c2a942c6dc797c7b87e
  		v0.1 release: 2016-06-20
  		Advantages
  			Better time-based object tracking
  			Better object recognition
  			Faster than FAST
  		Features
  			Can be used in low light situations with even higher frame rate and better performance
  			Conforms to LOD (level of detail) compression standards for 3d data
  			Can be used at any zoom
  			Quickly converges on highest frame rate and constant relative point cloud size
  			Can recognize objects, object groups, and juxtapositions at any angle
  			Can be trained in-line by intuitively asking questions
  			Can be trained in-line 
  		Design Priorities
	  		Data collection should be almost instantaneous
	  		The data collected should only include the most simplified representation of 
	  			multi-level aproximated clustering ie: cluster chain
	  				lvl 0: connected edge lines
	  				lvl 1: vertex clusters
	  				lvl 2: vertex cluster clusters
	  				lvl 3: cluster lvl2 movement vertex clusters
	  				lvl 4: statistics based multi-subcluster training (to recognize 3d non-rigid deformations)
	  				lvl 5: object depth recognition inference (to gain a sense of monocular depth perception)
	  				each succeeding level should have to deal with less and less data to keep log(n) down
	  		Training data should only be collected in intuitive real-time ways
	  		All training data should be non-finite (ie: a face object can be recognized in an 6-dimensional rotation)
	  		Training should only happen in real-time through duplexed input streams
	  			ie: object recognition and orientation + spoken commands
	  			or: object RO + text commands
	  		Clean statistical information should be extracted for further NN based analysis
			The Perceptoid
				Based on the idea of virtual centroids which get placed in the point cloud
  		JS Libraries that power Lightning
  		Papers that helped
  		Future ideas
  			dual camera 
  	**/
  	
  	//Video / Canvas Config
  	var canvasId = 'canvas';
  	var videoId = 'video';
  	var rad = 2 * Math.PI;
	var canvas = document.getElementById(canvasId);
	var video = document.getElementById(videoId);

	var trackStats = true;

	var cov = {
		x: Math.floor(videoWidth / 2),
		y: Math.floor(videoHeight / 2),
		adjust: function(p){
			return { x: p.x - this.x, y: p.y - this.y };
		}
	}
	var videoOrigDimensions = {w: videoWidth, h: videoHeight};
	setVideoDimensions(videoWidth, videoHeight);
	var useCamera = true;
	var context = canvas.getContext('2d');
	var aspRat = canvas.height / canvas.width;
	var flipX = false;

	var gridSize, xchunks, ychunks, totalChunks, xchunkSize, ychunkSize;

	//Color
	var useColor = true;
	
	//FAST config (points)
	var showPoints = false;
	var pointSize = 2;
	var showDensityGrid = false;

	//EFTB (exponential FAST threshold barrier)
	var maximizeFramerate = true; //move toward minPoints as much as possible
	var minPoints = 800;
	var maxPoints = 4000;

	//PNOR config (EFTB optimization)
	var PNOR = true;
	var pnor = {
		min: 65565,
		max: 0,
		cuframe: {
			min: 655365,
			max: 0
		},
		adjust: function(){
			//calculate running min/max range against all-time min/max
			var m = this.history.getMedian();
			var range = {
				total: (this.max > this.min) ? this.max - this.min: 0,
				median: (m.max > m.min) ? m.max - m.min: 0
			};
			var a = this.history.total / this.history.size;
			//If flickering happens... ie: history has blank spots, up the low boundary and high
			//If point oscilation happens... lower the low boundary and high
			//if median closer to min
		},
		push: function(frame){
			this.history.push(frame);
			if (this.max < frame.max) this.max = frame.max;
			if (this.min > frame.min) this.min = frame.min;
		},
		history: {
			size: 10,
			total: 0,
			median: 4,
			zeroes: 0,
			frames: [],
			ready: false,
			push: function(frame){
				this.frames.unshift(frame)
				this.total += frame.size;
				if (this.frames.length > this.size){
					var f = this.frames.pop();
					this.total -= f.size;
				}
				if (!this.ready) this.ready = (this.frames.length == this.size);
			},
			getMedian: function(){
				if (this.ready){
					this.frames.sort(function(a, b){
						return a.size - b.size;
					});
					return this.frames[this.median];
				}else{
					return this.frames[Math.floor(this.size / 2) - 1];
				}
			},
			reset: function(){
				this.total = 0;
				this.frames = [];
				this.ready = false;
				this.zeroes = 0;
			}
		}
	};
	
	//kdTree config (lines)
	var kdtType = 4;
	var closestNeighbors = 2;
	var traceThreshold = 0.15;
	var showLines = true;
	var neighborType = 1;
	var minLineWeight = 1;
	var mergeRadius = 4;

	//Density grid & Movement vector grid config 
	setGridSize(10);
	var densityBuffer = 2;

	//Visual element config
	var clearCanvas = true;
	var videoOpacity = 1.0;
	setVideoOpacity(videoOpacity);
	
	//72 angle lookup for training purposes
	//LODTree - LODTree.js
	var lod = LODTree(24); 
	//Any other level of LOD could be used for storing LOD-fuzzy index training stats
	//LOD controls how angles are stored and compared
	
	//var gridSize = 20;
	//var xchunks = gridSize;
	//var ychunks = Math.ceil(xchunks * aspRat);
	//var totalChunks = xchunks * ychunks;
	//var xchunkSize = Math.floor(canvas.width / xchunks);
	//var ychunkSize = Math.floor(canvas.height / ychunks);


	//if there are no controllers, this means that any pattern of points can attract the perceptoid
	/*perceptoids[0].on('addVector', function(d){
		context.strokeStyle = 'rgba(0,255,255,0.5)';
		drawLine(d.centroid, d.point);
	});*/
	
	function setPointRange(mini, maxi){
		minPoints = mini * 2;
		maxPoints = maxi * 2;
	}
	
	function setGridSize(size){
		gridSize = size;
		xchunks = gridSize;
		ychunks = Math.ceil(xchunks * aspRat);
		totalChunks = xchunks * ychunks;
		xchunkSize = Math.floor(videoWidth / xchunks);
		ychunkSize = Math.floor(videoHeight / ychunks);
	}
	
	function setVideoScale(s){
		setVideoDimensions(s * videoOrigDimensions.w, s * videoOrigDimensions.h); 
		tracking.track('#' + videoId, tracker, { camera: useCamera });
	}
	
	function setVideoDimensions(w, h){
		videoWidth = w;
		videoHeight = h;
		canvas.width = w;
		canvas.height = h;
		video.width = w;
		video.height = h;
		setGridSize(gridSize);
	}
	
	function setClosestNeighbors(num){
		closestNeighbors = num + 1;
	}
	
	function toggleVideo(){
		var v = document.getElementById('video');
		if (v.style.opacity > 0){
			v.style.opacity = 0;
		}else{
			v.style.opacity = videoOpacity;
		}
	}
	
	function setVideoOpacity(f){
		videoOpacity = (f <= 1.0 && f >= 0) ? f: videoOpacity;
		var v = document.getElementById('video');
		v.style.opacity = videoOpacity;		
	}

	//Modified from tracking.js library's /util/Image.js file
	//set up to use a kdtree for the original RGBA pixels and returns gray data along with pixel tree
	tracking.Image.grayscale = function(pixels, width, height, fillRGBA) {
		var gray = new Uint8ClampedArray(fillRGBA ? pixels.length : pixels.length >> 2);
		var p = 0;
		var c = 0;
		var w = 0;
		var color = new kdTree([], distance, ['x','y']);
		for (var i = 0; i < height; i++) {
			for (var j = 0; j < width; j++) {
				var r = pixels[w], g = pixels[w + 1], b = pixels[w + 2];
				var value = r * 0.299 + g * 0.587 + b * 0.114;
				gray[p++] = value;
				if (fillRGBA) {
					gray[p++] = value;
					gray[p++] = value;
					gray[p++] = pixels[w + 3];
				}
				w += 4;
			}
		}
		return gray;
	};

  	var FastTracker = function() {
		FastTracker.base(this, 'constructor');
	};
	tracking.inherits(FastTracker, tracking.Tracker);

	tracking.Fast.THRESHOLD = 20;
	FastTracker.prototype.threshold = tracking.Fast.THRESHOLD;

	FastTracker.prototype.track = function(pixels, width, height) {
		if (trackStats) stats.begin();
		var gray = tracking.Image.grayscale(pixels, width, height);
		var corners = tracking.Fast.findCorners(gray, width, height);
		if (trackStats) stats.end();

		this.emit('track', {
			data: corners,
			pixels: pixels
		});
	};

	var tracker = new FastTracker();
	var ocorners = 0;
	var m = 0;
	
	var canvasBuffer = 1;
	var cbc = 0;

	tracker.on('track', function(event) {
		if (clearCanvas){
			if (cbc >= canvasBuffer){
				context.clearRect(0, 0, canvas.width, canvas.height);
				cbc = 0;
			}
			cbc++
		}
		//var center = canvas.width / 2;
		var corners = event.data;
		var pixels = event.pixels;
		var l = corners.length;
		var cn2 = closestNeighbors * 5; //5 * closestNeighbors;
		///console.log(l, cn2, maxPoints);
		if (l < cn2 + 10){
			console.log("ERR " + tracking.Fast.THRESHOLD);
		}
		if (l <= maxPoints && l > cn2){
			var b = l / 100;
			m = (l > m) ? l: m;
			var i = 0;
			var g = gridCoords(corners[0], corners[1]);
			var gridc = [];
			for (i = 0; i < totalChunks; i++) gridc.push(0);
			var grid = [];
			var gbmax = 0;
		
			var fastPoints = [];

			//var curPixel = {r: -1, g: -1, b: -1};
			function getPixel(x, y){
				var w4 = videoWidth * 4
				var i = y * w4 + x * 4;
				if (pixels.length > i + 4)
					return {r: pixels[i], g: pixels[i + 1], b: pixels[i + 2]};
				else
					return null;
			}
		
			var node = {i: 0, x: corners[0], y: corners[1], pixel: getPixel(corners[0],corners[1]), next: null};
			var origNode = node;
			var lastNode = null;
			var ogi = -1;
			//context.fillStyle = 'rgba(255,255,255,1)';
			for (i = 0; i < l; i += 2) {
				//context.fillRect(corners[i], corners[i + 1], 1, 1);
				g = gridCoords(corners[i], corners[i + 1]);
				var x = corners[i], y = corners[i + 1];
				node.next = {i: (i / 2), x: x, y: y, pixel: getPixel(x, y), next: null, neighbor: null};

				//Build detail volume matrix
				gridc[g.i1] += 1;
				var gcc = gridc[g.i1];
				if (gbmax < gcc) gbmax = gcc;

				//Build point arrays for for use in kdTree + movement vector analysis
				switch (kdtType){
				case 4:
					fastPoints.push({x: node.next.x, y: node.next.y, pixel: node.next.pixel});
					break;
				case 3:
					fastPoints.push({x: node.next.x, y: node.next.y});
					break;
				default:
					if (!grid[g.i1]) grid[g.i1] = {x: g.x1, y: g.y1, points: []};
					grid[g.i1].points.push({x: node.next.x, y: node.next.y});
					//grid point array fill and tree init for cell
					if (g.i1 != ogi && ogi >= 0){
						var gogi = grid[ogi];
						gogi.tree = new kdTree(gogi.points, distance, ['x','y']);
					}
					ogi = g.i1;	
					break;
				}
			
				node = node.next;
			}
			if (kdtType < 3){
				var gogi = grid[ogi];
				if (typeof gogi !== 'undefined') gogi.tree = new kdTree(gogi.points, distance, ['x','y']);
			}
			//console.log(gridc);

			//Fill in Grid
			if (showDensityGrid){
				var st = 6;
				context.strokeStyle = '#f00';
				for (var yy = 0; yy < ychunks; yy++){
					//fill in grid
					for (var xx = 0; xx < xchunks; xx++){
						//Grid intensity line
						//context.strokeStyle = 'rgba(255,255,255,' + (gridc[gi] / gbmax) + ')';
						//context.strokeRect(xx * xchunkSize, yy * ychunkSize, xchunkSize, ychunkSize);
						//Grid intensity inverse black fill (video opacity 1)
						var gb = gridc[gi] / gbmax;
						//var gbb = (gb > 0.15) ? (gb >= 0.95) ? 1: 0.6: 0.2;
						var gbb = Math.floor(gb * st) / st;
						context.fillStyle = 'rgba(0,0,0,' + (1 - gbb) + ')';
						var xxx = xx * xchunkSize;
						var yyy = yy * ychunkSize;
						context.fillRect(xxx, yyy, xchunkSize, ychunkSize);
						//context.fillStyle = (gb == 1) ? '#f00': (gb > 0.5) ? '#ff0': (gb > 0.15) ? '#0f0': '#00f';
						//context.fillText(Math.floor(gb * 100) + "%", xxx, yyy + 24);
						gi++;
					}
				}
			}
		
			//Line drawing in red (line color)
			if (showLines){
				var gi = 0;
				//context.strokeStyle = 'rgba(255,0,0,' + (minLineWeight / closestNeighbors) + ')';
				context.strokeStyle = '#f00';
		
				switch (kdtType){
				case 1:
					//Draw traces kdTree simple >> {FASTEST / least accurate}
					// >> results in random lines and a sort of electricity effect in the point cloud
					for (gi = 0; gi < grid.length; gi++){
						var gb = gridc[gi] / gbmax;
						var grd = grid[gi];
						if (gb > traceThreshold && grd.hasOwnProperty('tree')){
							var tr = grd.tree.nearest(grd.points[0], grd.points.length);
							if (tr.length > 1){
								for (var tri=1;tri<tr.length - 1;tri++){
									drawLine(tr[tri][0], tr[tri - 1][0]);
								}
							}
						}
					}
					break;
				case 2:
					//Draw traces alternative kdTree/DistMax Exclusion method
					for (gi = 0; gi < grid.length; gi++){
						var gb = gridc[gi] / gbmax;
						var grd = grid[gi];
						if (gb > traceThreshold && grd.hasOwnProperty('tree')){
							var tr1 = grd.tree.nearest(grd.points[0], grd.points.length);
							var tr2 = grd.tree.nearest(grd.points[0], grd.points.length);
							if (tr1.length > 1){
								for (var tri=1;tri<tr1.length;tri++){
									drawLine(tr1[0][0], tr1[tri][0]);
								}
							}
							if (tr2.length > 1){
								for (var tri=1;tri<tr2.length - 1;tri++){
									drawLine(tr2[0][0], tr2[tri][0]);
								}
							}
						}
					}
					break;
				case 3:
					//Draw trace alternative Naive Nearest Neighbor lookup >> {SLOW! but most accurate}
					var pointTree = new kdTree(fastPoints, distance, ['x','y']);
					//for (gi = 0; gi < grid.length; gi++){
						//var gb = gridc[gi] / gbmax;
						//var grd = grid[gi];
						var lastPoint = null;
						var searchPoint = fastPoints[0];
						var lineSegments = [];
						if (pointTree){
							for (var fpi = 1; fpi < fastPoints.length; fpi++){
								//var point = grd.points[0];
								//look up simply the next nearest neighbor
								var tr = pointTree.nearest(searchPoint, closestNeighbors);
								//fastPoints.shift();
								//*** OORRRRR....
								//look up the normal vector's nearest neighbor using exponential distance step check
								//look up the forward vector's nearest neighbor using ""
								//Neighbors
								switch (neighborType){
								case 1: //naive
									searchPoint = fastPoints[fpi];
									//drawLine(tr[1][0], tr[0][0]);
									break;
								case 2: //
									
									//drawLine(tr[1][0], tr[0][0]);
									break;
								}
								//connect/draw all lines, weight lines based on recurrence
								for (var li = 0; li < tr.length - 1; li++){
									var p0 = tr[li][0];
									var p1 = tr[li + 1][0];
									var pD = tr[li][1];
									var pS, pF;
									if (p0.x < p1.x && p0.y < p1.y){
										pS = p0;
										pF = p1;
									}else{
										pS = p1;
										pF = p0; 
									}
									if (typeof lineSegments[pS.x] === 'undefined') lineSegments[pS.x] = [];
									if (typeof lineSegments[pS.x][pS.y] === 'undefined')
										lineSegments[pS.x][pS.y] = {weight: 0, pS: pS, pF: pF};
									var nd = lineSegments[pS.x][pS.y]
									nd.weight += 1;
									if (nd.weight > minLineWeight) drawLine(p0, p1);
								}
								//if (lastPoint != null) drawLine(tr[0][0], lastPoint);
								//lastPoint = tr[1][0];
								//in-line clustering is done because the two top lines are commented out
							}
							//**Add in velocity range check (ie: search nearest to step+1 point along vector of segment)
							//If the original point is within a threshold of the end point, connect it
							//possibly record the trace and store data as a trace list {pointA, pointB}
							//resolve shapes as correct paths through the data rather than above
							//correct paths based on k-NN regression (samples come from previously recorded data)
							//if the same layout of points is seen in one grid space as another
							//store localized version of that feature
							//oor... the more a trace combination shows up in a grid space, 
							//Octodirectional vector biasing for cheap orientation detection: Compass biasing?
							//	given an 8 index list of weights of which each sum the number of vectors pointing within range of the index
							//	calculate octodirectional vector bias for attempting to find 2 main perpendicular directions
							//	estimate the overal orientation of the camera or anything else with that information
							//	how many of those are pointing in parallel and how many converge on some visible/invisible point?
						}
						
						//Perceptoid rendering
						//use centroid as an x/y controller
						//use centroid vector as radial control
						//use perceptoid density as a linear control
						//quadrant/bisection multicontrol - get the quadrant normals and output it as 4 normal vectors
						//use thresholding to turn any control into a boolean (transistor) type
						context.strokeStyle = 'rgba(0,255,255,0.5)';
						if (useControlPoints && perceptoids.length > 0){
							for (i = 0; i < perceptoids.length; i++){
								var v = perceptoids[i];
								v.clearInputData();
								var tr = pointTree.nearest(v.centroid, v.n);
								for (var li = 0; li < tr.length; li++){
									var p = tr[li][0];
									var d = tr[li][1];
									if (d < v.r2){
										//console.log(d, v.r);
										drawLine(v.centroid, p);
										v.addVector(v.centroid, p, d);
									}
								}
								if (tr.length > 1){
									context.beginPath();
									context.arc(v.centroid.x, v.centroid.y, v.centroid.r, 0, rad);
									context.stroke();
								}
							}
						}
					//}
					break;
				case 4:
					//Perceptoids only
					//If perceptoid.scan = true then render it's delaunay points
					//console.log(fastPoints.length);
					var pointTree = new kdTree(fastPoints, distance, ['x','y']);
					window.pointTree = pointTree;
					var lastPoint = null;
					var searchPoint = fastPoints[0];
					var lineSegments = [];
					if (pointTree){
						if (perceptoids.length > 0){
							for (i = 0; i < perceptoids.length; i++){
								//Draw perceptoid
								var v = perceptoids[i];
								var cv = Vec({x: v.centroid.velocity.x, y: v.centroid.velocity.y});
								cv.add(v.centroid);
								var tr = pointTree.nearest(cv, v.n);
								v.setPoints(tr);
								v.step();
								if (v.isHyperPointer){
									context.strokeStyle = '#f00';
									drawLine(v.centroid, v.getVectorSumFinite());
								}
								if (v.scan){
									switch (v.scanType){
									case 'delaunay':
										if (typeof v.delaunay === 'undefined') break;
										switch (v.scanRenderStyle){
										case 'line':
											context.beginPath();
											var color = v.draw.color.scan;
											context.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ', ' + color.a + ')';
										
											/*** Modified from: Delauny.js http://grgrdvrt.com/blog/572/delaunoids/ ***/
											var nTriangles = v.delaunay.length;
											var r = v.r2;
											var xOff = 0; //v.centroid.x
											var yOff = 0; //v.centroid.y
											for(w = 0; w < nTriangles; w++)
											{
												var t = v.delaunay[w];
												if(!t)continue;
												
												if (flipX){
													context.moveTo(videoWidth - t.v0.x + xOff, t.v0.y + yOff);
													var d2 = geom.Vector2D.distance2(t.v0, t.v1);
													if(d2 < r) context.lineTo(videoWidth - t.v1.x + xOff, t.v1.y + yOff);
													else context.moveTo(videoWidth - t.v1.x + xOff, t.v1.y + yOff);
					
													var d2 = geom.Vector2D.distance2(t.v1, t.v2);
													if(d2< r) context.lineTo(videoWidth - t.v2.x + xOff, t.v2.y + yOff);
													else context.moveTo(videoWidth - t.v2.x + xOff, t.v2.y + yOff);
					
													var d2 = geom.Vector2D.distance2(t.v2, t.v0);
													if(d2< r) context.lineTo(videoWidth - t.v0.x + xOff, t.v0.y + yOff);													
													else context.moveTo(videoWidth - t.v0.x + xOff, t.v0.y + yOff);
												}else{
													context.moveTo(t.v0.x + xOff, t.v0.y + yOff);
													var d2 = geom.Vector2D.distance2(t.v0, t.v1);
													if(d2 < r) context.lineTo(t.v1.x + xOff, t.v1.y + yOff);
													else context.moveTo(t.v1.x + xOff, t.v1.y + yOff);
					
													var d2 = geom.Vector2D.distance2(t.v1, t.v2);
													if(d2< r) context.lineTo(t.v2.x + xOff, t.v2.y + yOff);
													else context.moveTo(t.v2.x + xOff, t.v2.y + yOff);
					
													var d2 = geom.Vector2D.distance2(t.v2, t.v0);
													if(d2< r) context.lineTo(t.v0.x + xOff, t.v0.y + yOff);													
													else context.moveTo(t.v0.x + xOff, t.v0.y + yOff);
												}
											}
											//ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
											context.stroke();
											/**** END Clip ***/
											break;
										case 'fill':
											var nTriangles = v.delaunay.length;
											var r = v.r2;
											var te = 1 / 3;
											for(w = 0; w < nTriangles; w++)
											{
												var t = v.delaunay[w];
												if(!t)continue;
								
												var maxD = 0;
												var d1 = geom.Vector2D.distance2(t.v0, t.v1);
												maxD = (d1 > maxD) ? d1: maxD;
												var d2 = geom.Vector2D.distance2(t.v1, t.v2);
												maxD = (d2 > maxD) ? d2: maxD;
												var d3 = geom.Vector2D.distance2(t.v2, t.v0);
												maxD = (d2 > maxD) ? d2: maxD;
												if(d1 > r || d2 >r  ||d3 > r)continue;
												
												
				
												context.beginPath();
												/*var cr = ((t.v0.rgb[0] + t.v1.rgb[0] + t.v2.rgb[0]) / 3)<<0;
												var cg = ((t.v0.rgb[1] + t.v1.rgb[1] + t.v2.rgb[1]) / 3)<<0;
												var cb = ((t.v0.rgb[2] + t.v1.rgb[2] + t.v2.rgb[2]) / 3)<<0;*/
												/*var cr = (t.v0.r + t.v1.r + t.v2.r) * te,
													cg = (t.v0.g + t.v1.g + t.v2.g) * te,
													cb = (t.v0.b + t.v1.b + t.v2.b) * te;*/
												var cr = t.v0.r, cg = t.v0.g, cb = t.v0.b;
												context.fillStyle = "rgba(" + cr + ", " + cg + ", " + cb + ", " + v.scanOpacity + ")";
												context.strokeStyle = context.fillStyle;
												if (flipX){
													context.moveTo(videoWidth - t.v0.x, t.v0.y);
													context.lineTo(videoWidth - t.v1.x, t.v1.y);
													context.lineTo(videoWidth - t.v2.x, t.v2.y);
													context.lineTo(videoWidth - t.v0.x, t.v0.y);
													context.fill();
													context.stroke();
												}else{
													context.moveTo(t.v0.x, t.v0.y);
													context.lineTo(t.v1.x, t.v1.y);
													context.lineTo(t.v2.x, t.v2.y);
													context.lineTo(t.v0.x, t.v0.y);
													context.fill();
													context.stroke();
												}
											}
											break;
										}
										break;
									case 'voronoi':
										if (typeof v.voronoi === 'undefined') break;
										var result = v.voronoi;
										if (result.edges == null) break;
										context.beginPath();
										var nEdges = result.edges.length;
										context.strokeStyle = 'rgba(0,255,0,0.8)';
										if (flipX){
											for(i = 0; i < nEdges; i++)
											{
												var e = result.edges[i];
												context.moveTo(videoWidth - e.va.x, e.va.y);
												context.lineTo(videoWidth - e.vb.x, e.vb.y);
											}
										}else{
											for(i = 0; i < nEdges; i++)
											{
												var e = result.edges[i];
												context.moveTo(e.va.x, e.va.y);
												context.lineTo(e.vb.x, e.vb.y);
											}
										}
										//ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
										context.stroke();
										break;
									case 'quickhull':
										break;
									case 'radial':
										//draw a line from the inner most point to the outer most point
										/*context.beginPath();
										var color = v.draw.color.scan;
										context.strokeStyle = 'rgba(' + color.r + ',' + color.g + ',' + color.b + ', ' + color.a + ')';
										for (w = 0; w < tr.length - 1; w++){
											var trv = tr[w][0];
											var trv1 = tr[w + 1][0];
											if (tr[w + 1][1] < v.r2 && tr[w][1] < v.r2){
												context.moveTo(trv.x, trv.y);
												context.lineTo(trv1.x, trv1.y);
											}
										}
										context.stroke();*/
										break;
									}
								}
								if (v.hasOwnProperty('drawLimits')){
									if (v.draw.limits && v.showLimits){
										var lim = v.limits;
										context.fillStyle = 'rgba(255,255,255,0.8)';
										if (flipX){
											context.fillRect(videoWidth - lim.x0 - lim.w - lim.xMargin, lim.y0 - lim.yMargin, lim.w + lim.xm2, lim.h + lim.ym2);
										}else{
											context.fillRect(lim.x0 - lim.xMargin, lim.y0 - lim.yMargin, lim.w + lim.xm2, lim.h + lim.ym2);
										}
									}
								}
								if (v.draw.radius){//} && v.activated){
									context.strokeStyle = v.draw.color.radius;
									context.beginPath();
									context.arc((flipX) ? videoWidth - v.centroid.x: v.centroid.x, v.centroid.y, v.r, 0, rad);
									context.stroke();
									if (v.hasOwnProperty('ir')){ //inner radius (for sensing outliers)
										context.strokeStyle = (v.color) ? 'rgba(' + Math.round(v.centroid.r) + ',' + Math.round(v.centroid.g) + ',' + Math.round(v.centroid.b) + ',1)' : v.draw.color.innerRadius;
										context.beginPath();
										context.arc((flipX) ? videoWidth - v.centroid.x: v.centroid.x, v.centroid.y, v.ir, 0, rad);
										context.stroke();
									}
								}
								/*if (v.draw.movement){
									v.movement.history.reset();

									//while ()
								}*/
								if (v.draw.velocity){
									context.strokeStyle = 'rgba(0,255,255,0.8)';
									var p = Vec({x: -v.centroid.velocity.x, y: -v.centroid.velocity.y});
									//p.scale(v.r);
									p.add(v.centroid);
									drawLine(v.centroid, p);
									/*context.beginPath();
									context.moveTo(v.centroid.x, v.centroid.y);
									context.lineTo(v.centroid.x + v.centroid.velocity.x, v.centroid.y + v.centroid.velocity.y);
									context.stroke();*/
								}
								if (v.draw.links && v.peers.count > 0){
									context.strokeStyle = 'rgba(200,0,255,0.8)';
									v.peers.reset();
									var ln = v.peers.next();
									while (ln != null){
										drawLine(v.centroid, ln.p.centroid);
										ln = v.peers.next();
									}
								}
								if (v.hasOwnProperty('image')){
									//show as an image (rotated to match velocity vector
									var ix = v.centroid.x - v.r;
									if (flipX) ix = videoWidth - ix;
									context.drawImage(v.image, ix, v.centroid.y - v.r);
								}
								if (v.hasOwnProperty('render')){
									v.render();
								}
							}
						}
					}
					break;
				}
			}		
		
			//Fill in Points
			if (showPoints){
				node = origNode;
				context.fillStyle = '#0f0';
				while (node.next != null){
					//context.fillStyle = (node.touching) ? '#f00': '#0f0';
					if (useColor) context.fillStyle = 'rgba(' + node.pixel.r + ', ' + node.pixel.g + ', ' + node.pixel.b + ',1)';
					context.fillRect((flipX) ? videoWidth - node.x: node.x, node.y, pointSize, pointSize);
					node = node.next;
				}
			}
		}
		//context.fillText('hello', 20, 30);
		//document.getElementById('maxlbl').innerHTML = m;
		
		//*** EFTB - Exponential FAST Threshold Barrier ***/
		//Automatically adjust the points generated to maintain point population stabiilty during video capture
		//Optimize the Points generated by fast using a point range
		//Such that you
		//	Stay within acceptable point processing range (at least minPoints points and at most maxPoints)
		//	Control FAST threshold for optimal points, which in turn controls everything else
		if (l > maxPoints){
			tracking.Fast.THRESHOLD = tracking.Fast.THRESHOLD * 1.2;
		}else if (l < minPoints){
			tracking.Fast.THRESHOLD = tracking.Fast.THRESHOLD - (tracking.Fast.THRESHOLD / 10);
		} else {
			//FPS based fine-tuning: brings point population down to minimum range
			if (maximizeFramerate) tracking.Fast.THRESHOLD = tracking.Fast.THRESHOLD + 1
		}
		
		/*** PNOR: Point Noise Oscillation Removal ***/
		// Further Optimization of point range set by EFTB
		// Adjusts the point minimum and maximum according to sensed conditions
		if (PNOR){
			//continue calculating min max
			var fpl = (typeof fastPoints !== 'undefined') ? fastPoints.length: 0;
			if (pnor.max < fpl) pnor.max = fpl;
			if (pnor.min > fpl) pnor.min = fpl;
			pnor.history.push({min: pnor.min, max: pnor.max, size: fpl});
			//if history has filled up to size, adjust by changing minPoints<->maxPoints range
			if (pnor.history.ready){
				pnor.adjust();
			}
		}
		
		//representing the final data...
		//vertice: { angle, distOut'}
		//	Creating a normalized vertice
		//		distIn is the raw line segment distance incoming
		//		distOut "" outgoing
		//	all angles are scaled down by an error factor of 12, 30 possible angles
		//		all angles are relative
		//	distOut is the normalized distance between in distance and out
		//		all other vertices, distOut' = distOut / distIn
		//clusters: [ vertice0, vertice1, ..., verticeN]
		//	all vertices after 0 are relative angles
		//final array: [ cluster0, cluster1, ..., culsterN]
	});

	tracking.track('#' + videoId, tracker, { camera: useCamera });

	// GUI Controllers
	/*var gui = new dat.GUI();

	gui.add(tracker, 'threshold', 1, 100).onChange(function(value) {
		tracking.Fast.THRESHOLD = value;
	});*/

	function gridCoords(x, y){
		var x1 = Math.floor((x / canvas.width) * xchunks);
		var y1 = Math.floor((y / canvas.height) * ychunks);
		var i1 = (y1 * xchunks) + x1;
		return {i1: i1, x1: x1, y1: y1};
	}

	function distance(a, b) {
		var dx = a.x-b.x;
		var dy = a.y-b.y;
		return dx*dx + dy*dy;
	}

	function drawLine(a, b){	
		context.beginPath();
		if (flipX){
			context.moveTo(videoWidth - a.x, a.y);
			context.lineTo(videoWidth - b.x, b.y);
		}else{
			context.moveTo(a.x, a.y);
			context.lineTo(b.x, b.y);
		}
		context.stroke();
	}

	//context.fillStyle = '#00f';
	//if (ocorners) context.fillRect(canvas.width - ocorners[i], ocorners[i + 1], 2, 2);
	//context.fillStyle = '#0f0';
	//context.fillRect(corners[i], corners[i + 1], 1, 1);
	//context.fillRect(canvas.width - corners[i], corners[i + 1], 2, 2);
	/*if (ocorners){
		context.strokeStyle = '#00f';
		context.beginPath();
		if (i < ocorners.length){
			context.moveTo(ocorners[i], ocorners[i - 1]);
		}
		context.lineTo(corners[i], corners[i + 1]);
		context.stroke();
	}*/
	//ocorners = corners;
	/*
	Create a linked list of anchor nodes
	closest neighbor in any direction
	scan lines forward to find down/right neighbors
	fast trig equation for distance
	square cutoff region
	once a neighbor is found it's linked to current link
	*/
	
	

