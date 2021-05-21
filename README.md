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

The following controls are specific to this red and blue Cornell Box with 2 spheres test scene:
* 1-6 number keys select a different wall for the quad light to be attached to
* open and close bracket keys decrease and increase the quad light's size
* 7,8,9,0 number keys quickly switch the Right sphere's material
<br><br>

<br>  

To see how this all this got started and to follow future progress, take a look at this [Forum Discussion](https://forum.babylonjs.com/t/path-tracing-in-babylonjs/11475/2)

<br>

<h2>Progress Updates</h2>

* May 21st, 2021: Updated and improved the de-noiser for Diffuse and clearCoat Diffuse surfaces.  Now scenes containing these surfaces (which is nearly all scenes) converges almost instantly!  I figured out how to cast the denoiser's neighbor pixel net a little wider.  The diffuse blur kernel was 3x3, or 9 taps in the screenOutput shader.  I kept that one for specular surfaces like transparent glass and the coating on top of clearCoat diffuse surfaces when the camera is active.  For the diffuse portions of the scene, (Diffuse, and Diffuse part of clearCoat Diffuse) I increased the sample radius of the blur kernel to 5x5, or 25 taps in the screenOutput shader.  Although this is quite a lot of taps, the GPU doesn't appear to mind too much because all pixels are doing this same task for their neighbors, so there should be no GPU diversion.  This new wider radius really makes a big difference and is definitely worth the extra texture taps!  If I really want to go nuts, I could increase the radius to 7x7, which would mean 49 taps per pixel, ha!  But I think the current radius is big enough for now and gives really smooth results.  What's neat also is that edges such as normal edges, object silhouette edges, and color boundary edges have remained razor sharp through this whole denoising process.  So we can have the best of both worlds: diffuse smoothness and detail sharpness where it counts!

* May 13th, 2021: Implemented edge detection and my 1st attempt at a real-time de-noiser (it's actually more of a 'noise-smoother', but still it makes a big difference!).  Path tracing is an inherently noisy affair because we only have a budget for 1 random ray path to follow as it bounces around in the scene on each animation frame for each pixel.  A certain pixel's ray might wind up taking a completely different path than its immediate neighbor pixels and returning a very different intersection color/intensity, hence the visual noise - especially on diffuse surfaces.  Inspired by recent NVIDIA efforts like Path Traced Quake, Quake II RTX, and Minecraft RTX, all of which feature real time edge detection and their proprietary A.I. deep learning denoising technology, I set out to create my own simple edge detector and denoiser that could be run real time in the browser, even on smart phones!  If you try the updated demo now, I hope you'll agree that with my 1st attempt, although nowhere near the level of sophistication of NVIDIA's (nor will it ever be, ha), the initial results are promising!  As you drag the camera around, the scene smoothly goes along with you, almost noise-free, and when you do let the camera be still, it instantly converges on a photo-realistic result! 

* May 12th, 2021: Added Blue Noise sampling for alternate random number generator and to smooth out noise.  Each pixel samples a 256x256 RGBA high quality blue noise texture at a randomly offset uv location and then stores and cycles through 1, 2, 3, or all 4 (user choice) of the R,G,B, and A channels that it sampled for that animation frame.  Since blue noise has higher frequency, evenly distributed noise (as compared to the usual more-chaotic white noise), the result is a much smoother appearance on diffuse and transparent surfaces that must take random samples to look physically correct.  Also convergence is sped up, which is always welcome!  IN addition to this blue noise update, I added some controls to the quad area light in the rad and blue Cornell Box scene.  Now you can select a different plane placement of the quad light by pressing any number keys, 1-6.  Also, you can decrease and increase the quad area light's size by holding down the left or right bracket keys. 

* May 9th, 2021: The path tracing camera now has some realistic physical features like FOV, aperture size, and focus distance.   The mouse wheel controls the FOV (zooming in and out), comma and period keys (< >) control the aperture size, and dash and equals keys (- +) move the focal point forward and back out in the scene.  THe traditional WASD,QE keys control camera flight forward and backward, strafe left and right, and climb up and down.  Have fun with the new camera controls!

* May 7th, 2021: Success!  With the awesome help and guidance from Evgeni_Popov on the Babylon.js forum, I now have the pixel history working correctly.  This means that when the camera is still, our Babylon.js Pathtracing Renderer continually samples the stationary scene over and over, all the while averaging the results.  After a couple of seconds, it converges on a noise-free result.  And since we are following the laws of physics and optics, this result will be photo-realistic!  Many thanks again to Evgeni_Popov on the awesome Babylon.js forums for providing helpful examples and pointing me in the right direction.  Now that this project is off the ground, we can fly! :-D

* May 5th, 2021: I usually like figuring stuff out, but at this point I need help!  The issue is that if you take a look at my 'Babylon_Path_Tracing.js' setup file in the 'js' folder, you can see that I have tried unsuccessfully to create a Babylon postProcess feedback loop, also known as a ping-pong buffer.  The general concept is that you render(ray trace) a full screen noisy image with my custom fragment pixel shader ('pathTracing.fragment.fx' in 'shaders' folder) using the usual Babylon PostProcess, then copy/save all those pixels (can either be done with Babylon's PassPostProcess or as I have tried here with my custom tiny shader called 'screenCopy.fragment.fx' in 'shaders' folder.  Then the trick is I need to be able to use the first pathTracing postProcess on the next animation frame and 'read' from the output of the screenCopy postProcess, essentially reading its own history (or giving it a short-term pixel 'memory' of what it calculated last frame).  When this is correctly implemented, I will be able to blend each current image with the previous history image, which will refine the image over time thorugh sampling and averaging, and therefore the images settles down from an initial noisy state to a smooth, converged state.  If you have an idea how to do this correctly with Babylon, please post on the Babylon Forum linked to above, or you can open an issue here on this repo.  Thank you!

* May 4th, 2021: The first commit, project repo created.
