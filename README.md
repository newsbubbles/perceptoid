# Perceptoids

Where artificial meets real life

Computer vision and artificial life come together to perform real-time unbiased visual object movement tracking. Furthermore, this tracking data can all be accessed through a simple API and streamed to act as any sort of virtual controller. Currently perceptoids is written in Javascript using the latest HTML5 Navigator.getUserMedia() method for Firefox only.

A version of [tracking.js](https://github.com/eduardolundgren/tracking.js/) is used in this Javascript implemntation for it's FAST edge detection algorithm.

## Description

The Perceptoid technology uses the artificial life algorithm known as [Boids](https://en.wikipedia.org/wiki/Boids) to perform signal processing on a video stream or any stream of data. This represents a different approach to computer vision in general. 

The purpose to this new approach is to downsize the processing power and hardware needed to extract precise data about the world seen through a single camera. Perceptoids provide a way to do this with just one low resolution web camera and no help from lasers or other cameras. Obviously, multiple camera approaches can work with this technology, and already work very well for 3D extraction, but most classical approaches fail at really capturing movement and form tranformation in a simple way with as little memory usage, latency, and computing power as possible.

Normally the problem of computer vision is approached top-down, using artificial intelligence to classify and then proceed to track objects in an image or video.  In this classical approach, each frame of the video stream is processed as a whole and then objects are found and classified.  Needless to say, this approach takes millions of training examples to work with any sort of acceptable success rate. The training examples for ImageNet were amassed over a course of many years and performs great image recognition at the cost of massive human effort and hundreds of thousands of man hours.

The difference in the approach for Perceptoids is that instead of training a system to recognize specific objects within an image or video and then tracking those objects, the system places a perceptoid as a virtual object within the scene which tracks and is affected by objects it is close to.  It "flocks" to nearby objects or patterns and thereby naturally follows these objects in realtime.  Each perceptoid follows a set of simple rules which allow for quite precise control over the perceptoid's position and heading in 2D.

So a perceptoid is a virtual object that you can physically interact with using your head, hands, an object or even aspects of a scene.

### Applications

Here are a few possible applications of this technology at it's baseline.
* Visual data processing
* Signal processing
* Virtual Controllers
* Machine vision applications
* Live Interactive virtual environments
* Augmented reality

A more full description including theory, goals, and applications of this technology can be seen on [perceptoid.org](http://perceptoid.org).

**Note:** the perceptoid technology currently only works with Firefox.  Google Chrome, Internet Explorer and Safari are *not* supported.

## Project Contents

The original perceptoid algorithm along with some modified algorithms it requires and the "lightning.js" library

## Architecture

- *perceptoid.js* - The raw Perceptoid library.  This contains the Perceptoid function which initializes a perceptoid into the data space and handles the frame-step behaviour processing of the perceptoid.
- *lightning.js* - The data stream filter and FAST point processing system.  This includes the main tracking.js event code for partitioning the data using kdTree and sending the point tree to the currently loaded perceptoids for local neighborhood analysis.
- *Other used libraries* (found in /src/js)
⋅⋅- *delaunay.js* - Triangulation and complex 2d polygon genreation from local neighborhood points. 
⋅⋅- *[kdTree.js](https://github.com/ubilabs/kd-tree-javascript)* v 1.01 - Data point space partitioning 
⋅⋅- *LODTree.js* - Quick angular hash lookup system.  Divides Pi by any number of radial slices
⋅⋅- *linknodes.js* - A simple linked list object which allows some simple manipulation of a linked list including push/pop style methods.

## Usage

To use perceptoids in your project

Initialize a simple Perceptoid
```javascript
```

Initialize a *fixed position* Perceptoid (stay mode)
```javascript
```

Initialize a perceptoid which is color discriminate using RGB
```javascript
```
Initialize a perceptoid which is Hue discriminate using HSL.  This is great for making a perceptoid only follow points of a certain hue range but any saturation level or lightness.
```javascript
```
Initialize a perceptoid which 

## API

### Perceptoid Properties

### Perceptoid Methods

### Perceptoid Events

### Streams

## Recent Achievements
- *Color recognition* a perceptoid can now be given a color and hue attribute and some properties which allow control over which color range to track.