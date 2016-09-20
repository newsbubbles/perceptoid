# perceptoid.js

Computer vision and artificial life come together to perform real-time unbiased visual object movement tracking. Furthermore, this tracking data can all be accessed through a simple API and streamed to act as any sort of virtual controller. HTML5 and Javascript for Firefox only.

## Description

The Perceptoid technology uses the artificial life algorithm known as [Boids](https://en.wikipedia.org/wiki/Boids) to perform signal processing on a video stream or any stream of data.  This represents a different approach to computer vision in general.  

Normally the problem of computer vision is approached top-down, using artificial intelligence to classify and then proceed to track objects in an image or video.  In this classical approach, each frame of the video stream is processed as a whole and then objects are found and classified.  Needless to say, this approach takes a lot of training examples to work properly. The training examples for ImageNet were amassed over a course of many years and performs great image recoghnition at the cost of massive human effort.

The difference in the approach for Perceptoids is that instead of training a system to recognize specific objects within an image, each 

### Applications

Here are a few possible applications of this technology at it's baseline.
* Visual data processing
* Signal processing

A more full description including theory, goals, and applications of this technology can be seen on [perceptoid.org](http://perceptoid.org).

**Note:** the perceptoid technology currently only works with Firefox.  Google Chrome, Internet Explorer and Safari are *not* supported.

## Project Contents

The original perceptoid algorithm along with some modified algorithms it requires and the "lightning.js" library

## Architecture

- *perceptoid.js* - the raw Perceptoid library.  Performs processing of data points in the 
lightning.js

## Usage

To use perceptoids in your project

Create a Perceptoid
```javascript
```