let canvas, engine, pathTracingScene;
let isPaused = true;
let sceneIsDynamic = false;
let camera, oldCameraMatrix, newCameraMatrix;
let camFlightSpeed; // scene specific, depending on scene size dimensions
let cameraRecentlyMoving = false;
let windowIsBeingResized = false;
let timeInSeconds = 0.0;
let frameTime = 0.0;
let newWidth, newHeight;
let nm, om;
let increaseFOV = false;
let decreaseFOV = false;
let uApertureSize; // scene specific, depending on scene size dimensions
let increaseAperture = false;
let decreaseAperture = false;
let apertureChangeAmount; // scene specific, depending on scene size dimensions
let uFocusDistance; // scene specific, depending on scene size dimensions
let increaseFocusDist = false;
let decreaseFocusDist = false;
let focusDistChangeAmount; // scene specific, depending on scene size dimensions
let mouseControl = true;
let cameraDirectionVector = new BABYLON.Vector3(); //for moving where the camera is looking
let cameraRightVector = new BABYLON.Vector3(); //for strafing the camera right and left
let cameraUpVector = new BABYLON.Vector3(); //for moving camera up and down

// common required uniforms
let uTime = 0.0;
let uFrameCounter = 1.0; // 1 instead of 0 because it is used as a rng() seed in pathtracing shader
let uSampleCounter = 0.0; // will get increased by 1 in animation loop before rendering
let uOneOverSampleCounter = 0.0; // the sample accumulation buffer gets multiplied by this reciprocal of SampleCounter, for averaging final pixel color 
let uULen = 1.0; // rendering pixel horizontal scale, related to camera's FOV and aspect ratio
let uVLen = 1.0; // rendering pixel vertical scale, related to camera's FOV
let uCameraIsMoving = false;


const KEYCODE_NAMES = {
	65: 'a', 66: 'b', 67: 'c', 68: 'd', 69: 'e', 70: 'f', 71: 'g', 72: 'h', 73: 'i', 74: 'j', 75: 'k', 76: 'l', 77: 'm',
	78: 'n', 79: 'o', 80: 'p', 81: 'q', 82: 'r', 83: 's', 84: 't', 85: 'u', 86: 'v', 87: 'w', 88: 'x', 89: 'y', 90: 'z',
	37: 'left', 38: 'up', 39: 'right', 40: 'down', 32: 'space', 33: 'pageup', 34: 'pagedown', 9: 'tab',
	189: 'dash', 187: 'equals', 188: 'comma', 190: 'period', 27: 'escape', 13: 'enter'
}
let KeyboardState = {
	a: false, b: false, c: false, d: false, e: false, f: false, g: false, h: false, i: false, j: false, k: false, l: false, m: false,
	n: false, o: false, p: false, q: false, r: false, s: false, t: false, u: false, v: false, w: false, x: false, y: false, z: false,
	left: false, up: false, right: false, down: false, space: false, pageup: false, pagedown: false, tab: false,
	dash: false, equals: false, comma: false, period: false, escape: false, enter: false
}

function onKeyDown(event)
{
	event.preventDefault();

	KeyboardState[KEYCODE_NAMES[event.keyCode]] = true;
}

function onKeyUp(event)
{
	event.preventDefault();

	KeyboardState[KEYCODE_NAMES[event.keyCode]] = false;
}

function keyPressed(keyName)
{
	return KeyboardState[keyName];
}

function onMouseWheel(event)
{
	// if (isPaused)
	// 	return;

	// use the following instead, because event.preventDefault() gives errors in console
	event.stopPropagation();

	if (event.deltaY > 0)
	{
		increaseFOV = true;
	}
	else if (event.deltaY < 0)
	{
		decreaseFOV = true;
	}
}

if ('ontouchstart' in window)
{
	mouseControl = false;
	// TODO: instantiate my custom 'MobileJoystickControls' or similar Babylon solution?
}

if (mouseControl)
{
	window.addEventListener('wheel', onMouseWheel, false);
}

// SCENE/DEMO-SPECIFIC PARAMETERS
camFlightSpeed = 300; // scene specific, depending on scene size dimensions
uApertureSize = 0.0; // aperture size at beginning of app
uFocusDistance = 530.0; // initial focus distance from camera in scene - scene specific, depending on scene size dimensions
const uEPS_intersect = mouseControl ? 0.01 : 1.0; // less precision on mobile - also both values are scene-size dependent
apertureChangeAmount = 20; // scene specific, depending on scene size dimensions
focusDistChangeAmount = 5; // scene specific, depending on scene size dimensions


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
oldCameraMatrix = new BABYLON.Matrix;
newCameraMatrix = new BABYLON.Matrix;
camera.attachControl(canvas, true);

let width = engine.getRenderWidth(), height = engine.getRenderHeight();

const pathTracingRenderTarget = new BABYLON.RenderTargetTexture("pathTracingRenderTarget", { width, height }, pathTracingScene, false, false,
	BABYLON.Constants.TEXTURETYPE_FLOAT, false, BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, false, false, false,
	BABYLON.Constants.TEXTUREFORMAT_RGBA);

const screenCopyRenderTarget = new BABYLON.RenderTargetTexture("screenCopyRenderTarget", { width, height }, pathTracingScene, false, false,
	BABYLON.Constants.TEXTURETYPE_FLOAT, false, BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, false, false, false,
	BABYLON.Constants.TEXTUREFORMAT_RGBA);

const eRenderer = new BABYLON.EffectRenderer(engine);

// SCREEN COPY EFFECT
const screenCopy_eWrapper = new BABYLON.EffectWrapper({
	engine: engine,
	fragmentShader: BABYLON.Effect.ShadersStore["screenCopyFragmentShader"],
	uniformNames: [],
	samplerNames: ["pathTracedImageBuffer"],
	name: "screenCopyEffectWrapper"
});

screenCopy_eWrapper.onApplyObservable.add(() =>
{
	screenCopy_eWrapper.effect.setTexture("pathTracedImageBuffer", pathTracingRenderTarget);
});

// SCREEN OUTPUT EFFECT
const screenOutput_eWrapper = new BABYLON.EffectWrapper({
	engine: engine,
	fragmentShader: BABYLON.Effect.ShadersStore["screenOutputFragmentShader"],
	uniformNames: ["uOneOverSampleCounter"],
	samplerNames: ["accumulationBuffer"],
	name: "screenOutputEffectWrapper"
});

screenOutput_eWrapper.onApplyObservable.add(() =>
{
	screenOutput_eWrapper.effect.setTexture("accumulationBuffer", pathTracingRenderTarget);
	screenOutput_eWrapper.effect.setFloat("uOneOverSampleCounter", uOneOverSampleCounter);
});

// MAIN PATH TRACING EFFECT
const pathTracing_eWrapper = new BABYLON.EffectWrapper({
	engine: engine,
	fragmentShader: BABYLON.Effect.ShadersStore["pathTracingFragmentShader"],
	uniformNames: ["uResolution", "uULen", "uVLen", "uTime", "uFrameCounter", "uEPS_intersect", "uCameraMatrix", "uApertureSize", "uFocusDistance", "uCameraIsMoving"],
	samplerNames: ["previousBuffer"],
	name: "pathTracingEffectWrapper"
});

pathTracing_eWrapper.onApplyObservable.add(() =>
{
	uVLen = Math.tan(camera.fov * 0.5);
	uULen = uVLen * (width / height);

	pathTracing_eWrapper.effect.setTexture("previousBuffer", screenCopyRenderTarget);
	pathTracing_eWrapper.effect.setFloat2("uResolution", pathTracingRenderTarget.getSize().width, pathTracingRenderTarget.getSize().height);
	pathTracing_eWrapper.effect.setFloat("uULen", uULen);
	pathTracing_eWrapper.effect.setFloat("uVLen", uVLen);
	pathTracing_eWrapper.effect.setFloat("uTime", uTime);
	pathTracing_eWrapper.effect.setFloat("uFrameCounter", uFrameCounter);
	pathTracing_eWrapper.effect.setFloat("uSampleCounter", uSampleCounter);
	pathTracing_eWrapper.effect.setFloat("uEPS_intersect", uEPS_intersect);
	pathTracing_eWrapper.effect.setFloat("uApertureSize", uApertureSize);
	pathTracing_eWrapper.effect.setFloat("uFocusDistance", uFocusDistance);
	pathTracing_eWrapper.effect.setBool("uCameraIsMoving", uCameraIsMoving);
	pathTracing_eWrapper.effect.setMatrix("uCameraMatrix", camera.getWorldMatrix());
});


function getElapsedTimeInSeconds()
{
	timeInSeconds += (engine.getDeltaTime() * 0.001);
	return timeInSeconds;
}


// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function ()
{
	if (isPaused && engine.isPointerLock)
	{
		document.addEventListener('keydown', onKeyDown, false);
		document.addEventListener('keyup', onKeyUp, false);
		isPaused = false;
	}
	if (!isPaused && !engine.isPointerLock)
	{
		document.removeEventListener('keydown', onKeyDown, false);
		document.removeEventListener('keyup', onKeyUp, false);
		isPaused = true;
	}

	// reset cameraIsMoving flag
	uCameraIsMoving = false;

	if (windowIsBeingResized)
	{
		uCameraIsMoving = true;
		windowIsBeingResized = false;
	}

	uTime = getElapsedTimeInSeconds();

	frameTime = engine.getDeltaTime() * 0.001;

	// my own optimized way of telling if the camera has moved or not
	newCameraMatrix.copyFrom(camera.getWorldMatrix());
	nm = newCameraMatrix.m;
	om = oldCameraMatrix.m;
	if ( nm[0] != om[0] || nm[1] != om[1] || nm[2] != om[2] || nm[3] != om[3] ||
		nm[4] != om[4] || nm[5] != om[5] || nm[6] != om[6] || nm[7] != om[7] ||
		nm[8] != om[8] || nm[9] != om[9] || nm[10] != om[10] || nm[11] != om[11] ||
		nm[12] != om[12] || nm[13] != om[13] || nm[14] != om[14] || nm[15] != om[15] )
	{
		uCameraIsMoving = true;	
	}
	// save camera state for next frame's comparison
	oldCameraMatrix.copyFrom(newCameraMatrix);

	// get current camera orientation basis vectors
	cameraDirectionVector.set(-nm[8], -nm[9], -nm[10]);
	cameraDirectionVector.normalize();
	cameraUpVector.set(nm[4], nm[5], nm[6]);
	cameraUpVector.normalize();
	cameraRightVector.set(nm[0], nm[1], nm[2]);
	cameraRightVector.normalize();

	// check for user input
	if (keyPressed('w') && !keyPressed('s'))
	{
		camera.position.addInPlace(cameraDirectionVector.scaleToRef(camFlightSpeed * frameTime, cameraDirectionVector));
	}
	if (keyPressed('s') && !keyPressed('w'))
	{
		camera.position.subtractInPlace(cameraDirectionVector.scaleToRef(camFlightSpeed * frameTime, cameraDirectionVector));
	}
	if (keyPressed('a') && !keyPressed('d'))
	{
		camera.position.subtractInPlace(cameraRightVector.scaleToRef(camFlightSpeed * frameTime, cameraRightVector));
	}
	if (keyPressed('d') && !keyPressed('a'))
	{
		camera.position.addInPlace(cameraRightVector.scaleToRef(camFlightSpeed * frameTime, cameraRightVector));
	}
	if (keyPressed('e') && !keyPressed('q'))
	{
		camera.position.addInPlace(cameraUpVector.scaleToRef(camFlightSpeed * frameTime, cameraUpVector));
	}
	if (keyPressed('q') && !keyPressed('e'))
	{
		camera.position.subtractInPlace(cameraUpVector.scaleToRef(camFlightSpeed * frameTime, cameraUpVector));
	}

	if (keyPressed('equals') && !keyPressed('dash'))
	{
		increaseFocusDist = true;
	}
	if (keyPressed('dash') && !keyPressed('equals'))
	{
		decreaseFocusDist = true;
	}
	if (keyPressed('period') && !keyPressed('comma'))
	{
		increaseAperture = true;
	}
	if (keyPressed('comma') && !keyPressed('period'))
	{
		decreaseAperture = true;
	}

	// now update uniforms that are common to all scenes
	if (increaseFOV)
	{
		camera.fov += (Math.PI / 180);
		if (camera.fov > 150 * (Math.PI / 180))
			camera.fov = 150 * (Math.PI / 180);

		uVLen = Math.tan(camera.fov * 0.5);
		uULen = uVLen * (width / height);

		uCameraIsMoving = true;
		increaseFOV = false;
	}
	if (decreaseFOV)
	{
		camera.fov -= (Math.PI / 180);
		if (camera.fov < 1 * (Math.PI / 180))
			camera.fov = 1 * (Math.PI / 180);

		uVLen = Math.tan(camera.fov * 0.5);
		uULen = uVLen * (width / height);

		uCameraIsMoving = true;
		decreaseFOV = false;
	}

	if (increaseFocusDist)
	{
		uFocusDistance += focusDistChangeAmount;
		
		uCameraIsMoving = true;
		increaseFocusDist = false;
	}
	if (decreaseFocusDist)
	{
		uFocusDistance -= focusDistChangeAmount;
		if (uFocusDistance < 1)
			uFocusDistance = 1;
		
		uCameraIsMoving = true;
		decreaseFocusDist = false;
	}

	if (increaseAperture)
	{
		uApertureSize += apertureChangeAmount;
		if (uApertureSize > 100000.0)
			uApertureSize = 100000.0;
		
		uCameraIsMoving = true;
		increaseAperture = false;
	}
	if (decreaseAperture)
	{
		uApertureSize -= apertureChangeAmount;
		if (uApertureSize < 0.0)
			uApertureSize = 0.0;
		
		uCameraIsMoving = true;
		decreaseAperture = false;
	}

	if (!uCameraIsMoving)
	{
		if (sceneIsDynamic)
			uSampleCounter = 1.0; // reset for continuous updating of image
		else uSampleCounter += 1.0; // for progressive refinement of image

		uFrameCounter += 1.0;

		cameraRecentlyMoving = false;
	}

	if (uCameraIsMoving)
	{
		uSampleCounter = 1.0;
		uFrameCounter += 1.0;

		if (!cameraRecentlyMoving)
		{
			uFrameCounter = 1.0;
			cameraRecentlyMoving = true;
		}
	}

	uOneOverSampleCounter = 1.0 / uSampleCounter;

	// the following is necessary to update the user's world camera movement - should take no time at all
	pathTracingScene.render();
	// now for the heavy lifter, the bulk of the frame time
	eRenderer.render(pathTracing_eWrapper, pathTracingRenderTarget);
	// then simply copy(store) what the pathTracer just calculated - should take no time at all
	eRenderer.render(screenCopy_eWrapper, screenCopyRenderTarget);
	// finally take the accumulated pathTracingRenderTarget buffer and average by numberOfSamples taken, then apply Reinhard tonemapping (brings image into friendly 0.0-1.0 rgb color float range),
	// and lastly raise to the power of (0.4545), in order to make gamma correction (gives more brightness range where it counts).  This last step should also take minimal time
	eRenderer.render(screenOutput_eWrapper, null); // null, because we don't feed this non-linear image-processed output back into the pathTracing accumulation buffer as it would 'pollute' the pathtracing unbounded linear color space
});


// Watch for browser/canvas resize events
window.addEventListener("resize", function ()
{
	windowIsBeingResized = true;

	engine.resize();

	newWidth = engine.getRenderWidth(); 
	newHeight = engine.getRenderHeight();
	pathTracingRenderTarget.resize({ width: newWidth, height: newHeight });
	screenCopyRenderTarget.resize({ width: newWidth, height: newHeight });

	width = newWidth;
	height = newHeight;

	uVLen = Math.tan(camera.fov * 0.5);
	uULen = uVLen * (width / height);
});
