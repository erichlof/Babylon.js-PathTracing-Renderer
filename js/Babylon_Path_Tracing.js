let canvas, engine, pathTracingScene;
let camera, light1, light2;
let pathTracingPostProcess, screenCopyPostProcess, screenOutputPostProcess;
let timeInSeconds = 0.0;


canvas = document.getElementById("renderCanvas");
engine = new BABYLON.Engine(canvas, true);
// scale image by 2, which is half the work for GPU to do (BABYLON later calculates: 1/scalingLevel = amount of GPU task)
// so 1/scalingLevel, or 1/(2) = 0.5 GPU task - this helps most GPUs to maintain 30-60 FPS
engine.setHardwareScalingLevel(2); // default scalingLevel is 1. You can try scalingLevel of 1 if you have a powerful GPU that can keep 60 FPS


// Create the scene space
pathTracingScene = new BABYLON.Scene(engine);
// coming from THREE.js, I'm more comfortable with a Right-handed coordinate system, so...
//  +X:(1,0,0) pointing to the right, +Y:(0,1,0) pointing up, and +Z:(0,0,1) pointing out of the screen towards you
pathTracingScene.useRightHandedSystem = true;

// enable browser's mouse pointer lock feature, for free-look camera controlled by mouse movement
pathTracingScene.onPointerDown = evt =>
{
	engine.enterPointerlock();
}

// Add a camera to the scene and attach it to the canvas
camera = new BABYLON.UniversalCamera("Camera", new BABYLON.Vector3(278, 170, 350), pathTracingScene);
// I'm not sure why, but this next line is necessary because the camera was facing away from my path traced scene.  Maybe because of the handedness change above?
camera.rotation.y += Math.PI;
camera.attachControl(canvas, true);
// '.aspect' is my own property addition to the camera object 
camera.aspect = canvas.width / canvas.height;



// create the main path tracing PostProcess and all its required uniforms
pathTracingPostProcess = new BABYLON.PostProcess("pathTracing", "./shaders/pathTracing",
	["uResolution", "uULen", "uVLen", "uTime", "uFrameCounter", "uEPS_intersect", "uCameraMatrix"], null, 1, camera);
pathTracingPostProcess.uTime = 0.0;
pathTracingPostProcess.uFrameCounter = 1.0;
pathTracingPostProcess.uULen = 1.0;
pathTracingPostProcess.uVLen = 1.0;
pathTracingPostProcess.uEPS_intersect = 0.01;
pathTracingPostProcess.uResolution = new BABYLON.Vector2();
pathTracingPostProcess.uCameraMatrix = new BABYLON.Matrix();

pathTracingPostProcess.autoClear = false;
//pathTracingPostProcess.alphaMode = BABYLON.Engine.ALPHA_COMBINE;

pathTracingPostProcess.onApply = function (effect)
{
	pathTracingPostProcess.uResolution.x = pathTracingPostProcess.width;
	pathTracingPostProcess.uResolution.y = pathTracingPostProcess.height;

	camera.aspect = pathTracingPostProcess.width / pathTracingPostProcess.height;
	pathTracingPostProcess.uVLen = Math.tan(camera.fov * 0.5);
	pathTracingPostProcess.uULen = pathTracingPostProcess.uVLen * camera.aspect;

	effect.setTextureFromPostProcess("sceneSampler", screenCopyPostProcess);
	effect.setFloat2("uResolution", pathTracingPostProcess.uResolution.x, pathTracingPostProcess.uResolution.y); // how many pixels horizontally and vertically
	effect.setFloat("uULen", pathTracingPostProcess.uULen); // horizontal pixel scale in shader, higher numbers = wider, slightly warped fanning out of ray directions to follow wider FOV
	effect.setFloat("uVLen", pathTracingPostProcess.uVLen); // vertical pixel scale in shader - also is affected by camera's FOV
	effect.setFloat("uTime", pathTracingPostProcess.uTime); // elapsed time, useful for simple animations inside path traced scene
	effect.setFloat("uFrameCounter", pathTracingPostProcess.uFrameCounter); // simply increases by 1 each animation frame - useful in rng() seeding for high quality random sampling
	effect.setFloat("uEPS_intersect", pathTracingPostProcess.uEPS_intersect); // at each intersection, the ray gets nudged out by this tiny eps distance, to avoid getting stuck inside objects due to float precision
	effect.setMatrix("uCameraMatrix", pathTracingPostProcess.uCameraMatrix); // each animation frame the camera's matrix is fed to the shader, so that the viewing rays can be correctly generated

	engine.resize();
};

// create the screen copy PostProcess, which simply copies the output of the pathTracingPostProcess above
screenCopyPostProcess = new BABYLON.PostProcess("screenCopy", "./shaders/screenCopy", [], null, 1, camera);
screenCopyPostProcess.onApply = function (effect)
{
	effect.setTextureFromPostProcess("sceneSampler", pathTracingPostProcess);
};

screenCopyPostProcess.autoClear = false;

//screenCopyPostProcess.shareOutputWith(pathTracingPostProcess); // gives 'feedback loop' error
//pathTracingPostProcess.shareOutputWith(screenCopyPostProcess); // gives '_MSAAFramebuffer' error



function getElapsedTimeInSeconds()
{
	timeInSeconds += (engine.getDeltaTime() * 0.001);
	return timeInSeconds;
}


// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function ()
{
	// refresh shader uniforms
	pathTracingPostProcess.uTime = getElapsedTimeInSeconds();
	pathTracingPostProcess.uFrameCounter += 1.0;
	pathTracingPostProcess.uCameraMatrix = camera.getWorldMatrix();

	pathTracingScene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function ()
{
	pathTracingPostProcess.uResolution.x = pathTracingPostProcess.width;
	pathTracingPostProcess.uResolution.y = pathTracingPostProcess.height;
	// must recalculate aspect ratio and the shader's pixel vertical scale (uVLen) and horizontal scale (uULen) based on camera's FOV
	camera.aspect = pathTracingPostProcess.width / pathTracingPostProcess.height;
	pathTracingPostProcess.uVLen = Math.tan(camera.fov * 0.5);
	pathTracingPostProcess.uULen = pathTracingPostProcess.uVLen * camera.aspect;

	engine.resize();
});
