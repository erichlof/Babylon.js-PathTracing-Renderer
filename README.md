# Babylon.js-PathTracing-Renderer
Real-time PathTracing with global illumination and progressive rendering, all on top of the Babylon.js WebGL framework. Click here for Live Demo: https://erichlof.github.io/Babylon.js-PathTracing-Renderer/Babylon_Path_Tracing.html
<br>
<h3> Note: by request of Babylon.js users, this is a W.I.P. conversion from using three.js as the host engine to using Babylon.js as the host engine behind my custom path tracing shaders.</h3> 

<br>  

To see how this all this got started and to follow future progress, take a look at this [Forum Discussion](https://forum.babylonjs.com/t/path-tracing-in-babylonjs/11475/2)

<br>

As it is May the 4th today (Star Wars day), this 'base is not yet fully operational', but will be soon! ;-D </h3>

<br>

<h2>Progress Updates</h2>

* May 5th, 2021: I usually like figuring stuff out, but at this point I need help!  The issue is that if you take a look at my 'Babylon_Path_Tracing.js' setup file in the 'js' folder, you can see that I have tried unsuccessfully to create a Babylon postProcess feedback loop, also known as a ping-pong buffer.  The general concept is that you render(ray trace) a full screen noisy image with my custom fragment pixel shader ('pathTracing.fragment.fx' in 'shaders' folder) using the usual Babylon PostProcess, then copy/save all those pixels (can either be done with Babylon's PassPostProcess or as I have tried here with my custom tiny shader called 'screenCopy.fragment.fx' in 'shaders' folder.  Then the trick is I need to be able to use the first pathTracing postProcess on the next animation frame and 'read' from the output of the screenCopy postProcess, essentially reading its own history (or giving it a short-term pixel 'memory' of what it calculated last frame).  When this is correctly implemented, I will be able to blend each current image with the previous history image, which will refine the image over time thorugh sampling and averaging, and therefore the images settles down from an initial noisy state to a smooth, converged state.  If you have an idea how to do this correctly with Babylon, please post on the Babylon Forum linked to above, or you can open an issue here on this repo.  Thank you!

* May 4th, 2021: The first commit, project repo created.
