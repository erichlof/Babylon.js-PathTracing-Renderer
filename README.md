# Babylon.js-PathTracing-Renderer
Real-time PathTracing with global illumination and progressive rendering, all on top of the Babylon.js WebGL framework. Click here for Live Demo: https://erichlof.github.io/Babylon.js-PathTracing-Renderer/Babylon_Path_Tracing.html
<br>
<h3> Note: by request of Babylon.js users, this is a W.I.P. conversion from using three.js as the host engine to using Babylon.js as the host engine behind my custom path tracing shaders.</h3> 

<h4>Desktop Controls</h4>

* Click anywhere to capture mouse
* move Mouse to control camera rotation
* Mousewheel to zoom in and out (change FOV)
* WASD,QE controls camera flight forward and backward, strafe left and right, climb up and down
* < > (comma, period) keys decrease and increase camera's aperture size
* -- = (dash, equals) keys move camera's focus point forward and back out in the scene

The following controls are specific to this red and blue Cornell Box with yellow sphere and clear glass sphere test scene:
* 1-6 number keys select a different wall for the quad light to be attached to
* open and close bracket keys decrease and increase the quad light's size
<br><br>

<br>  

To see how this all this got started and to follow future progress, take a look at this [Forum Discussion](https://forum.babylonjs.com/t/path-tracing-in-babylonjs/11475/2)

<br>

<h2>Progress Updates</h2>

* May 12th, 2021: Added Blue Noise sampling for alternate random number generator and to smooth out noise.  Each pixel samples a 256x256 RGBA high quality blue noise texture at a randomly offset uv location and then stores and cycles through 1, 2, 3, or all 4 (user choice) of the R,G,B, and A channels that it sampled for that animation frame.  Since blue noise has higher frequency, evenly distributed noise (as compared to the usual more-chaotic white noise), the result is a much smoother appearance on diffuse and transparent surfaces that must take random samples to look physically correct.  Also convergence is sped up, which is always welcome!  IN addition to this blue noise update, I added some controls to the quad area light in the rad and blue Cornell Box scene.  Now you can select a different plane placement of the quad light by pressing any number keys, 1-6.  Also, you can decrease and increase the quad area light's size by holding down the left or right bracket keys. 

* May 9th, 2021: The path tracing camera now has some realistic physical features like FOV, aperture size, and focus distance.   The mouse wheel controls the FOV (zooming in and out), comma and period keys (< >) control the aperture size, and dash and equals keys (- +) move the focal point forward and back out in the scene.  THe traditional WASD,QE keys control camera flight forward and backward, strafe left and right, and climb up and down.  Have fun with the new camera controls!

* May 7th, 2021: Success!  With the awesome help and guidance from Evgeni_Popov on the Babylon.js forum, I now have the pixel history working correctly.  This means that when the camera is still, our Babylon.js Pathtracing Renderer continually samples the stationary scene over and over, all the while averaging the results.  After a couple of seconds, it converges on a noise-free result.  And since we are following the laws of physics and optics, this result will be photo-realistic!  Many thanks again to Evgeni_Popov on the awesome Babylon.js forums for providing helpful examples and pointing me in the right direction.  Now that this project is off the ground, we can fly! :-D

* May 5th, 2021: I usually like figuring stuff out, but at this point I need help!  The issue is that if you take a look at my 'Babylon_Path_Tracing.js' setup file in the 'js' folder, you can see that I have tried unsuccessfully to create a Babylon postProcess feedback loop, also known as a ping-pong buffer.  The general concept is that you render(ray trace) a full screen noisy image with my custom fragment pixel shader ('pathTracing.fragment.fx' in 'shaders' folder) using the usual Babylon PostProcess, then copy/save all those pixels (can either be done with Babylon's PassPostProcess or as I have tried here with my custom tiny shader called 'screenCopy.fragment.fx' in 'shaders' folder.  Then the trick is I need to be able to use the first pathTracing postProcess on the next animation frame and 'read' from the output of the screenCopy postProcess, essentially reading its own history (or giving it a short-term pixel 'memory' of what it calculated last frame).  When this is correctly implemented, I will be able to blend each current image with the previous history image, which will refine the image over time thorugh sampling and averaging, and therefore the images settles down from an initial noisy state to a smooth, converged state.  If you have an idea how to do this correctly with Babylon, please post on the Babylon Forum linked to above, or you can open an issue here on this repo.  Thank you!

* May 4th, 2021: The first commit, project repo created.
