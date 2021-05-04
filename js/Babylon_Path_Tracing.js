let canvas, engine, pathTracingScene;
let camera, light1, light2;
let postProcess;
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
camera.rotation.y += Math.PI;

camera.attachControl(canvas, true);
camera.aspect = canvas.width / canvas.height;

postProcess = new BABYLON.PostProcess("pathTracingFragment", "./shaders/pathTracing",
	["uResolution", "uULen", "uVLen", "uTime", "uFrameCounter", "uEPS_intersect", "uCameraMatrix"], null, 1, camera);
postProcess.uTime = 0.0;
postProcess.uFrameCounter = 1.0;
postProcess.uULen = 1.0;
postProcess.uVLen = 1.0;
postProcess.uEPS_intersect = 0.01;
postProcess.uResolution = new BABYLON.Vector2();
postProcess.uCameraMatrix = new BABYLON.Matrix();
postProcess.onApply = function (effect)
{
	postProcess.uResolution.x = postProcess.width;
	postProcess.uResolution.y = postProcess.height;
	camera.aspect = postProcess.width / postProcess.height;
	postProcess.uVLen = Math.tan(camera.fov * 0.5);
	postProcess.uULen = postProcess.uVLen * camera.aspect;

	effect.setFloat2("uResolution", postProcess.uResolution.x, postProcess.uResolution.y);
	effect.setFloat("uULen", postProcess.uULen);
	effect.setFloat("uVLen", postProcess.uVLen);
	effect.setFloat("uTime", postProcess.uTime);
	effect.setFloat("uFrameCounter", postProcess.uFrameCounter);
	effect.setFloat("uEPS_intersect", postProcess.uEPS_intersect);
	effect.setMatrix("uCameraMatrix", postProcess.uCameraMatrix);

	engine.resize();
};

function getElapsedTimeInSeconds()
{
	timeInSeconds += (engine.getDeltaTime() * 0.001);
	return timeInSeconds;
}


// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function ()
{
	postProcess.uTime = getElapsedTimeInSeconds();
	postProcess.uFrameCounter += 1.0;
	postProcess.uCameraMatrix = camera.getWorldMatrix();
	pathTracingScene.render();
});

// Watch for browser/canvas resize events
window.addEventListener("resize", function ()
{
	postProcess.uResolution.x = postProcess.width;
	postProcess.uResolution.y = postProcess.height;

	camera.aspect = postProcess.width / postProcess.height;
	postProcess.uVLen = Math.tan(camera.fov * 0.5);
	postProcess.uULen = postProcess.uVLen * camera.aspect;

	engine.resize();
});