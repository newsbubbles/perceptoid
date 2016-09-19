/*
	Pong implemented with HTML features.

	Version: 1.1
	Author: David Laurell <david@laurell.nu>
	License: GPLv3

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>.

    Alterations by Nathaniel Dwight Gibson <nathaniel.gibson@gmail.com>
    --------------------------------------------------------------------
    2016-08-24:
    	Created Pong function and put all game inside of that, no namespacing
		Allowed for non-mouse control of game
		Added Perceptoids to the main demo page for control method
			mapped same functionalities as mouse events to perceptoid events
 */

var Pong = function(){
	return {
		game: null,
		options: {
			canvas: null, 
			ctx:null,
			soundLeft:null,
			soundRight:null,
			soundWall:null,
			gameTimeLast: 0
		},
		elements: {
			canvas: 'gameCanvas',
			bounceLeft: 'bounceLeft',
			bounceRight: 'bounceRight',
			bounceWall: 'bounceWall'
		},
		teams: {
			left: {
				id: 'left',
				score: 0,
				color: {
					r: 0,
					g: 128,
					b: 255
				},
				colorTxt: 'rgba(0,128,255,0.8)',
				direction: {
					x: -1,
					y: 0
				}
			}, 
			right: {
				id: 'right',
				score: 0,
				color: {
					r: 255,
					g: 128,
					b: 0
				},
				colorTxt: 'rgba(255,128,0,0.8)',
				direction: {
					x: 1,
					y: 0
				}
			},
			top: {
				id: 'top',
				score: 0,
				color: {
					r: 128,
					g: 0,
					b: 255
				},
				colorTxt: 'rgba(128,0,255,0.8)',
				direction: {
					x: 0,
					y: -1
				}
			},
			bottom: {
				id: 'bottom',
				score: 0,
				color: {
					r: 0,
					g: 255,
					b: 0
				},
				colorTxt: 'rgba(0,255,0,0.8)',
				direction: {
					x: 0,
					y: 1
				}
			}
		},
		onInit: function(){

		},
		initLocation: function(team){
			var x, y, buff = 5;
			switch (team){
			case 'left':
				x = buff;
				y = game.options.canvas.height / 2;
				break;
			case 'right':
				x = game.options.canvas.width - buff;
				y = game.options.canvas.height / 2;
				break;
			case 'top':
				x = game.options.canvas.width / 2;
				y = buff;
				break;
			case 'bottom':
				x = game.options.canvas.width / 2;
				y = game.options.canvas.height - buff;
				break;
			}
			return {x: x, y: y};
		},
		newPlayer: function(name, team, computer){
			var l = this.initLocation(team);
			var lr = (this.teams[team].direction.y == 0);
			return {
				name: name,
				team: team,
				computer: computer,
				y: l.y,
				x: l.x,
				score: 0,
				ratio: {
					height: (lr) ? 1 / 6: 1 / 64,
					width: (lr) ? 1 / 64: 1 / 6
				},
				height: 80,
				width: 4,
				speed: (lr) ? game.options.canvas.height / 150: game.options.canvas.width / 150,
				sound: (team == 'right') ? game.options.soundRight: game.options.soundLeft,
				color: game.teams[team].colorTxt,
				bx: (team == 'right') ? 1: -1,
				move: function(ball){
					/* Move if player is cpu */
					var t = game.teams[this.team];
					var lr = (t.direction.y == 0);
					if (lr){
						if (this.y + 20 < ball.y && this.y + this.height / 2 <= game.options.canvas.height)
							this.y += this.speed * game.game.moveAmount;
						else if(this.y - 20 > ball.y && this.y - this.height / 2 >= 0)
							this.y -= this.speed * game.game.moveAmount;
					}else{
						if (this.x + 20 < ball.x && this.x + this.width / 2 <= game.options.canvas.width)
							this.x += this.speed * game.game.moveAmount;
						else if(this.x - 20 > ball.x && this.x - this.width / 2 >= 0)
							this.x -= this.speed * game.game.moveAmount;
					}
				}
			};
		},
		init: function() {
			this.options.canvas = document.getElementById(this.elements.canvas);
			this.options.ctx = this.options.canvas.getContext("2d");
			this.options.soundLeft = document.getElementById(this.elements.bounceLeft);
			this.options.soundRight = document.getElementById(this.elements.bounceRight);
			this.options.soundWall = document.getElementById(this.elements.bounceWall);


			var cloc = this.initLocation('right');
			this.network = {
				host: '127.0.0.1',
				port: 8099,
				room: 'pong1'
			};
			this.game = {
				mode: 1, /* 1 player or 2 players */
				arena: 'local', /* local or network */
				/*player : ,
				player2 : newPlayer('Player 2', 'right'),*/
				moveAmount: 1,
				computer : {},
				ball : {
					x : this.options.canvas.width / 2,
					y : this.options.canvas.height / 2,
					vx : Math.round(Math.random()) ? 1 : -1,
					vy : Math.random() * 4 - 2,
					bounces : 0,
					radius : 3,
					color: 'rgba(192,192,192,0.8)',
					reset: function(team) {
						this.x = game.options.canvas.width / 2;
						this.y = game.options.canvas.height / 2;
						var r = Math.random() * 4 - 2;
						this.vy = (team.direction.y == 0) ? r: team.direction.y;
						this.vx = (team.direction.x == 0) ? r: team.direction.x;
						this.color = 'rgba(192,192,192,0.8)';
					},
					players: [],
					score: function(team){
						team.score++;
						document.getElementById("score" + team.id).innerHTML = team.score;
						this.reset(team);
					},
					move: function(){
						/* Change direction of ball when hitting rop/bottom wall in 1-2 team modes */
						if (game.game.mode <= 2){
							if (this.y + this.radius > game.options.canvas.height || this.y - this.radius < 0){
								game.playSound(game.options.soundWall);
								if(this.y <= this.radius)
									this.y = this.radius;
								else
									this.y = game.options.canvas.height - this.radius;
								this.vy *= -1;
							}
						}else{ /* 3 an 4 team mode */
							//score top!
							if (this.y + this.radius >= game.options.canvas.height){
								this.score(game.teams.top);
								return;
							}
							//score bottom!
							if (this.y <= 0){
								this.score(game.teams.bottom);
								return;
							}							
						}
						//score left!
						if (this.x + this.radius >= game.options.canvas.width){
							this.score(game.teams.left);
							return;
						}
						//score right!
						if (this.x <= 0){
							this.score(game.teams.right);
							return;
						}
						this.x2 = this.x + this.vx * game.game.moveAmount;
						this.y2 = this.y + this.vy * game.game.moveAmount;
						var qd = this.getQuadDirection();
						/* checking collision between ball and players */
						for (var i = 0; i < this.players.length; i++){
							var v = this.players[i];
							if (!qd[v.team]) continue;
							var h2 = v.height / 2;
							var w2 = v.width / 2;
							var vrx = this.x + this.radius;
							var vry = this.y + this.radius;
							var inbounds = false, crossed = false;
							var lr = (game.teams[v.team].direction.y == 0);
							if (lr){
								inbounds = (this.y > v.y - h2 && this.y < v.y + h2);
								crossed = (this.x2 > v.x - w2 && this.x <= v.x - w2 || this.x2 < v.x + w2 && this.x >= v.x + w2);
							}else{
								inbounds = (this.x > v.x - w2 && this.x < v.x + w2);
								crossed = (this.y2 > v.y - h2 && this.y <= v.y - h2 || this.y2 < v.y + h2 && this.y >= v.y + h2);
							}
							//if (this.y + this.radius >= v.y - v.height / 2 && vry <= v.y + v.height / 2 && vrx >= v.x - this.vx && this.x - this.radius <= v.x + v.width + this.vx){
							if (inbounds && crossed){
								game.playSound(v.sound);
								if(this.vx <= this.maxspeed) {
									this.vx += this.multiplier;
								}									
								this.changeDirection(v);
							}
						}
						this.x = this.x + this.vx * game.game.moveAmount; //this.x2;
						this.y = this.y + this.vy * game.game.moveAmount; //this.y2;
					},
					getQuadDirection: function(){
						var o = {left: false, right: false, up: false, down: false};
						if (this.vx > 0) o.right = true; else o.left = true;
						if (this.vy > 0) o.down = true; else o.up = true;
						//lookup
						o.top = o.up;
						o.bottom = o.down;
						return o;
					},
					changeDirection: function(player){
						var team = game.teams[player.team];
						var lr = (team.direction.y == 0);
						if (lr){
							//if (this.y > player.y && )
							if(player.y > this.y)
								this.vy -= (player.y - this.y) / player.height * this.maxspeed;
							else if(player.y < this.y)
								this.vy += (this.y - player.y) / player.height * this.maxspeed;
							this.vx *= -1;
						}else{
							if(player.x > this.x)
								this.vx -= (player.x - this.x) / player.width * this.maxspeed;
							else if(player.x < this.x)
								this.vx += (this.x - player.x) / player.width * this.maxspeed;
							this.vy *= -1;							
						}
					},
					multiplier: .2,
					maxspeed: 5
				},
				playerHeight : 80,
				playerWidth : 4,
				pause : false,
				sound: true
			};
			this.players = [];
			this.initPlayers([
				{
					name: 'Player 1',
					team: 'right',
					computer: false
				},
				{
					name: 'Player 2',
					team: 'left',
					computer: false
				}/*,
				{
					name: 'Player 3',
					team: 'top',
					computer: true
				},
				{
					name: 'Player 4',
					team: 'bottom',
					computer: true
				}*/
			]);

			this.game.ball.players = this.players;
			//this.game.player.sound = this.options.soundRight;
			//this.game.player2.sound = this.options.soundLeft;
			//this.game.computer.sound = this.options.soundLeft;
		 
			//document.onmousemove = this.moveMouse;
			
			this.options.gameTimeLast = new Date();
			//this.reposition();
			this.update();
			this.onInit(this);
			this.reposition();
		},
		initPlayers: function(p){
			//p: [{name, team, computer, }, ...]
			//newPlayer('Player 1', 'right'), (this.game.mode==1) ? this.game.computer: newPlayer('Player 2', 'left')
			this.players = [];
			for (var i = 0; i < p.length; i++){
				var v = p[i];
				this.players.push(this.newPlayer(v.name, v.team, v.computer));
			}
		},
		moveMouse: function(e) {
			var y;	
			if(!e) {
				e = window.event;
				y = e.event.offsetY;
			}
			else {
				y = e.pageY;
			}
			
			y -= game.options.canvas.offsetTop;
			if(y - game.game.playerHeight/2 >= 0 && y + game.game.playerHeight/2 <= game.options.canvas.height)
				game.game.player.y = y;
		},
		playSound: function(snd) {
			if(this.game.sound) {
				try {
					if (!snd.paused) {
						// Pause and reset it
						snd.pause();	
						snd.currentTime = 0;
					}
					snd.play();
				}
				catch(e) {}
			}
		},
		update: function() {
			dateTime = new Date();

			gameTime = (dateTime - game.options.gameTimeLast);
			if(gameTime < 0)
				gameTime = 0;

			if (!game.game.pause) {
				game.game.moveAmount = gameTime > 0 ? gameTime / 10 : 1;
				//if (game.game.mode > 1) game.game.computer.move();
				for (var i = 0; i < game.players.length; i++){
					var v = game.players[i];
					if (v.computer) v.move(game.game.ball);
				}
				game.game.ball.move();
			}

			game.draw();

			setTimeout(game.update,1000/30);

			game.options.gameTimeLast = dateTime;
		},

		/**
		 * Draw everything in the this.options.canvas
		 */
		reposition: function(){
			if (typeof this.players !== 'undefined'){
				for (var i = 0; i < this.players.length; i++){
					var v = this.players[i];
					var t = this.teams[v.team];
					var l = this.initLocation(v.team);
					v.x = l.x;
					v.y = l.y;
					//change player widths/heights
					v.width = this.options.canvas.width * v.ratio.width;
					v.height = this.options.canvas.height * v.ratio.height;
				}
				//reset ball
				if (typeof this.ball !== 'undefined') this.ball.reset();
			}
		},
		draw: function() {
			if (!this.game.pause) {
				this.options.ctx.clearRect(0, 0, this.options.canvas.width, this.options.canvas.height);
		/*
				var bgFade = this.options.ctx.createLinearGradient(0,0,0,this.options.canvas.height);
				bgFade.addColorStop(0, '#000');
				bgFade.addColorStop(1, '#211');
				this.options.ctx.fillStyle = bgFade;
				this.options.ctx.fillRect(0, 0, this.options.canvas.width, this.options.canvas.height);
		*/

				this.options.ctx.fillStyle = "rgb(64,64,64)";
				var size = 3;
				for(var y=0;y<this.options.canvas.height;y+=size*3) {
					this.options.ctx.fillRect(this.options.canvas.width / 2 - size/2, y, size, size);
				}

				//show players
				for (var i = 0; i < this.players.length; i++){
					var v = this.players[i];
					this.options.ctx.fillStyle = v.color;
					this.options.ctx.fillRect(v.x - v.width / 2, v.y - v.height / 2, v.width, v.height);
				}
				// left player
				// right player
				//this.options.ctx.fillRect(this.options.canvas.width - this.game.playerWidth, this.game.player.y
				//		- this.game.playerHeight / 2, this.game.playerWidth, this.game.playerHeight);

				this.options.ctx.fillStyle = this.game.ball.color;
				this.options.ctx.fillRect(this.game.ball.x - this.game.ball.radius, this.game.ball.y
						- this.game.ball.radius, this.game.ball.radius * 2, this.game.ball.radius * 2);
			}
		},
		initDOM: function() {
			var playButton = document.getElementById('playButton');
			playButton.onclick = function() {
				document.getElementById('titleScreen').style.display = "none";
				document.getElementById('playScreen').style.display = "block";
				game.init();
			};

			var pauseButton = document.getElementById('pauseButton');
			pauseButton.onclick = function() {
				if (!game.pause) {
					game.pause = true;
					this.innerHTML = "Continue";
					document.getElementById('pauseText').style.display = "block";
				}
				else {
					game.pause = false;
					this.innerHTML = "Pause";
					document.getElementById('pauseText').style.display = "none";
				}
			};

			var soundButton = document.getElementById('soundButton');
			soundButton.onclick = function() {
				if (!game.sound) {
					game.sound = true;
					this.innerHTML = "Turn off sound";
				}
				else {
					game.sound = false;
					this.innerHTML = "Turn on sound";
				}
			};
		}
	};
};