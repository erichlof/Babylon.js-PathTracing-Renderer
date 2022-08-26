let canvas, engine, pathTracingScene;
let container, stats;
let gui;
let pixel_ResolutionController, pixel_ResolutionObject;
let needChangePixelResolution = false;
let sunDirTransform_RotateXController, sunDirTransform_RotateXObject;
let sunDirTransform_RotateYController, sunDirTransform_RotateYObject;
let needChangeSunDirRotation = false;
let rightSphere_MaterialController, rightSphere_MaterialObject;
let needChangeRightSphereMaterial = false;
let isPaused = true;
let camera, oldCameraMatrix, newCameraMatrix;
let camFlightSpeed; // scene specific, depending on scene size dimensions
let cameraRecentlyMoving = false;
let windowIsBeingResized = false;
let beginningFlag = true;
let timeInSeconds = 0.0;
let frameTime = 0.0;
let newWidth, newHeight;
let nm, om;
let increaseFOV = false;
let decreaseFOV = false;
let uApertureSize; // scene specific, depending on scene size dimensions
let apertureChangeAmount; // scene specific, depending on scene size dimensions
let uFocusDistance; // scene specific, depending on scene size dimensions
let focusDistChangeAmount; // scene specific, depending on scene size dimensions
let mouseControl = true;
let cameraDirectionVector = new BABYLON.Vector3(); //for moving where the camera is looking
let cameraRightVector = new BABYLON.Vector3(); //for strafing the camera right and left
let cameraUpVector = new BABYLON.Vector3(); //for moving camera up and down
let blueNoiseTexture;
let infoElement = document.getElementById('info');
infoElement.style.cursor = "default";
infoElement.style.userSelect = "none";
infoElement.style.MozUserSelect = "none";

let cameraInfoElement = document.getElementById('cameraInfo');
cameraInfoElement.style.cursor = "default";
cameraInfoElement.style.userSelect = "none";
cameraInfoElement.style.MozUserSelect = "none";

// common required uniforms
let uSceneIsDynamic = false; // will any geometry, lights, or models be moving in the scene?
let uRandomVec2 = new BABYLON.Vector2(); // used to offset the texture UV when sampling the blueNoiseTexture for smooth randomness - this vec2 is updated/changed every animation frame
let uTime = 0.0; // elapsed time in seconds since the app started
let uFrameCounter = 1.0; // 1 instead of 0 because it is used as a rng() seed in pathtracing shader
let uSampleCounter = 0.0; // will get increased by 1 in animation loop before rendering
let uOneOverSampleCounter = 0.0; // the sample accumulation buffer gets multiplied by this reciprocal of SampleCounter, for averaging final pixel color 
let uULen = 1.0; // rendering pixel horizontal scale, related to camera's FOV and aspect ratio
let uVLen = 1.0; // rendering pixel vertical scale, related to camera's FOV
let uCameraIsMoving = false; // lets the path tracer know if the camera is being moved 
let uToneMappingExposure = 1.0; // exposure amount when applying Reinhard tonemapping in final stages of pixel colors' output
let uPixelEdgeSharpness = 1.0; // for dynamic scenes only - if pixel is found to be lying on a border/boundary edge, how sharp should it be? (range: 0.0-1.0)
let uEdgeSharpenSpeed = 0.05; // applies to edges only - how fast is the blur filter removed from edges?
let uFilterDecaySpeed = 0.0002; // applies to entire image(edges and non-edges alike) - how fast should the blur filter go away for the entire image?

// scene/demo-specific variables;
let sphereRadius = 16;
let wallRadius = 50;
let leftSphereTransformNode;
let rightSphereTransformNode;
let sunTransformNode;
let sunDirRotationX, sunDirRotationY;
// scene/demo-specific uniforms
let uSunDirection = new BABYLON.Vector3();
let uRightSphereMatType;
let uLeftSphereInvMatrix = new BABYLON.Matrix();
let uRightSphereInvMatrix = new BABYLON.Matrix();


// The following list of keys is not exhaustive, but it should be more than enough to build interactive demos and games
let KeyboardState = {
	KeyA: false, KeyB: false, KeyC: false, KeyD: false, KeyE: false, KeyF: false, KeyG: false, KeyH: false, KeyI: false, KeyJ: false, KeyK: false, KeyL: false, KeyM: false,
	KeyN: false, KeyO: false, KeyP: false, KeyQ: false, KeyR: false, KeyS: false, KeyT: false, KeyU: false, KeyV: false, KeyW: false, KeyX: false, KeyY: false, KeyZ: false,
	ArrowLeft: false, ArrowUp: false, ArrowRight: false, ArrowDown: false, Space: false, Enter: false, PageUp: false, PageDown: false, Tab: false,
	Minus: false, Equal: false, BracketLeft: false, BracketRight: false, Semicolon: false, Quote: false, Backquote: false,
	Comma: false, Period: false, ShiftLeft: false, ShiftRight: false, Slash: false, Backslash: false, Backspace: false,
	Digit1: false, Digit2: false, Digit3: false, Digit4: false, Digit5: false, Digit6: false, Digit7: false, Digit8: false, Digit9: false, Digit0: false
}

function onKeyDown(event)
{
	event.preventDefault();

	KeyboardState[event.code] = true;
}

function onKeyUp(event)
{
	event.preventDefault();

	KeyboardState[event.code] = false;
}

function keyPressed(keyName)
{
	return KeyboardState[keyName];
}

function onMouseWheel(event)
{
	if (isPaused)
		return;

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

// Watch for browser/canvas resize events
window.addEventListener("resize", function ()
{
	handleWindowResize();
});

if ('ontouchstart' in window)
{
	mouseControl = false;
	// TODO: instantiate my custom 'MobileJoystickControls' or similar Babylon solution?
}

if (mouseControl)
{
	window.addEventListener('wheel', onMouseWheel, false);
}

function handleWindowResize()
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
}


// setup GUI
function init_GUI()
{
	pixel_ResolutionObject = {
		pixel_Resolution: 0.75
	}

	sunDirTransform_RotateXObject = {
		sunDir_RotateX: 298
	}
	sunDirTransform_RotateYObject = {
		sunDir_RotateY: 318
	}

	rightSphere_MaterialObject = {
		RSphere_MaterialPreset: 'Metal'
	}

	function handlePixelResolutionChange()
	{
		needChangePixelResolution = true;
	}

	function handleSunDirRotationChange()
	{
		needChangeSunDirRotation = true;
	}

	function handleRightSphereMaterialChange()
	{
		needChangeRightSphereMaterial = true;
	}

	gui = new dat.GUI();

	pixel_ResolutionController = gui.add(pixel_ResolutionObject, 'pixel_Resolution', 0.5, 1.0, 0.05).onChange(handlePixelResolutionChange);
	
	sunDirTransform_RotateXController = gui.add(sunDirTransform_RotateXObject, 'sunDir_RotateX', 160, 370, 1).onChange(handleSunDirRotationChange);
	sunDirTransform_RotateYController = gui.add(sunDirTransform_RotateYObject, 'sunDir_RotateY', 0, 359, 1).onChange(handleSunDirRotationChange);

	rightSphere_MaterialController = gui.add(rightSphere_MaterialObject, 'RSphere_MaterialPreset', ['Transparent',
		'Diffuse', 'ClearCoat_Diffuse', 'Metal']).onChange(handleRightSphereMaterialChange);

	// jumpstart setting of initial sun direction when the demo begins
	handleSunDirRotationChange();
}

init_GUI();


// setup the frame rate display (FPS) in the top-left corner 
container = document.getElementById('container');

stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
stats.domElement.style.cursor = "default";
stats.domElement.style.webkitUserSelect = "none";
stats.domElement.style.MozUserSelect = "none";
container.appendChild(stats.domElement);


canvas = document.getElementById("renderCanvas");

engine = new BABYLON.Engine(canvas, true);


// Create the scene space
pathTracingScene = new BABYLON.Scene(engine);

// enable browser's mouse pointer lock feature, for free-look camera controlled by mouse movement
pathTracingScene.onPointerDown = evt =>
{
	engine.enterPointerlock();
}

// Add a camera to the scene and attach it to the canvas
camera = new BABYLON.UniversalCamera("Camera", new BABYLON.Vector3(), pathTracingScene);
camera.attachControl(canvas, true);

uVLen = Math.tan(camera.fov * 0.5);
uULen = uVLen * (engine.getRenderWidth() / engine.getRenderHeight());



// SCENE/DEMO-SPECIFIC PARAMETERS
camera.position.set(0, -10, -200);
camera.inertia = 0;
camera.angularSensibility = 500;
camFlightSpeed = 100; // scene specific, depending on scene size dimensions
uApertureSize = 0.0; // aperture size at beginning of app
uFocusDistance = 113.0; // initial focus distance from camera in scene - scene specific, depending on scene size dimensions
const uEPS_intersect = 0.01; // value is scene-size dependent
apertureChangeAmount = 1; // scene specific, depending on scene size dimensions
focusDistChangeAmount = 1; // scene specific, depending on scene size dimensions
uRightSphereMatType = 3; // enum number code for METAL material - demo starts off with this setting for right sphere

oldCameraMatrix = new BABYLON.Matrix();
newCameraMatrix = new BABYLON.Matrix();

// must be instantiated here after scene has been created
leftSphereTransformNode = new BABYLON.TransformNode();
rightSphereTransformNode = new BABYLON.TransformNode();
sunTransformNode = new BABYLON.TransformNode();

leftSphereTransformNode.position.set(-wallRadius * 0.45, -wallRadius + sphereRadius + 0.1, -wallRadius * 0.2);
leftSphereTransformNode.scaling.set(sphereRadius, sphereRadius, sphereRadius);
//leftSphereTransformNode.scaling.set(sphereRadius * 0.3, sphereRadius, sphereRadius);
//leftSphereTransformNode.rotation.set(0, 0, Math.PI * 0.2);
uLeftSphereInvMatrix.copyFrom(leftSphereTransformNode.getWorldMatrix());
uLeftSphereInvMatrix.invert();

rightSphereTransformNode.position.set(wallRadius * 0.45, -wallRadius + sphereRadius + 0.1, -wallRadius * 0.2);
rightSphereTransformNode.scaling.set(sphereRadius, sphereRadius, sphereRadius);
uRightSphereInvMatrix.copyFrom(rightSphereTransformNode.getWorldMatrix());
uRightSphereInvMatrix.invert();

let width = engine.getRenderWidth(), height = engine.getRenderHeight();

blueNoiseTexture = new BABYLON.Texture("./textures/BlueNoise_RGBA256.png",
	pathTracingScene,
	true,
	false,
	BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE,
	null,
	null,
	null,
	false,
	BABYLON.Constants.TEXTUREFORMAT_RGBA);



const pathTracingRenderTarget = new BABYLON.RenderTargetTexture("pathTracingRenderTarget", { width, height }, pathTracingScene, false, false,
	BABYLON.Constants.TEXTURETYPE_FLOAT, false, BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, false, false, false,
	BABYLON.Constants.TEXTUREFORMAT_RGBA);

const screenCopyRenderTarget = new BABYLON.RenderTargetTexture("screenCopyRenderTarget", { width, height }, pathTracingScene, false, false,
	BABYLON.Constants.TEXTURETYPE_FLOAT, false, BABYLON.Constants.TEXTURE_NEAREST_SAMPLINGMODE, false, false, false,
	BABYLON.Constants.TEXTUREFORMAT_RGBA);

const eRenderer = new BABYLON.EffectRenderer(engine);

// SCREEN COPY EFFECT
const screenCopyEffect = new BABYLON.EffectWrapper({
	engine: engine,
	fragmentShader: BABYLON.Effect.ShadersStore["screenCopyFragmentShader"],
	uniformNames: [],
	samplerNames: ["pathTracedImageBuffer"],
	name: "screenCopyEffectWrapper"
});

screenCopyEffect.onApplyObservable.add(() =>
{
	screenCopyEffect.effect.setTexture("pathTracedImageBuffer", pathTracingRenderTarget);
});

// SCREEN OUTPUT EFFECT
const screenOutputEffect = new BABYLON.EffectWrapper({
	engine: engine,
	fragmentShader: BABYLON.Effect.ShadersStore["screenOutputFragmentShader"],
	uniformNames: ["uSampleCounter", "uOneOverSampleCounter", "uPixelEdgeSharpness", "uEdgeSharpenSpeed", "uFilterDecaySpeed",
			"uToneMappingExposure", "uSceneIsDynamic"],
	samplerNames: ["accumulationBuffer"],
	name: "screenOutputEffectWrapper"
});

screenOutputEffect.onApplyObservable.add(() =>
{
	screenOutputEffect.effect.setTexture("accumulationBuffer", pathTracingRenderTarget);
	screenOutputEffect.effect.setFloat("uSampleCounter", uSampleCounter);
	screenOutputEffect.effect.setFloat("uOneOverSampleCounter", uOneOverSampleCounter);
	screenOutputEffect.effect.setFloat("uPixelEdgeSharpness", uPixelEdgeSharpness);
	screenOutputEffect.effect.setFloat("uEdgeSharpenSpeed", uEdgeSharpenSpeed);
	screenOutputEffect.effect.setFloat("uFilterDecaySpeed", uFilterDecaySpeed);
	screenOutputEffect.effect.setFloat("uToneMappingExposure", uToneMappingExposure);
	screenOutputEffect.effect.setBool("uSceneIsDynamic", uSceneIsDynamic);
});

// MAIN PATH TRACING EFFECT
const pathTracingEffect = new BABYLON.EffectWrapper({
	engine: engine,
	fragmentShader: BABYLON.Effect.ShadersStore["pathTracingFragmentShader"],
	uniformNames: ["uResolution", "uRandomVec2", "uULen", "uVLen", "uTime", "uFrameCounter", "uSampleCounter", "uPreviousSampleCount", "uEPS_intersect", "uCameraMatrix", "uApertureSize", 
			"uFocusDistance", "uCameraIsMoving", "uSunDirection", "uLeftSphereInvMatrix", "uRightSphereInvMatrix", "uRightSphereMatType"],
	samplerNames: ["previousBuffer", "blueNoiseTexture"],
	name: "pathTracingEffectWrapper"
});

pathTracingEffect.onApplyObservable.add(() =>
{
	pathTracingEffect.effect.setTexture("previousBuffer", screenCopyRenderTarget);
	pathTracingEffect.effect.setTexture("blueNoiseTexture", blueNoiseTexture);
	pathTracingEffect.effect.setVector3("uSunDirection", uSunDirection);
	pathTracingEffect.effect.setFloat2("uResolution", pathTracingRenderTarget.getSize().width, pathTracingRenderTarget.getSize().height);
	pathTracingEffect.effect.setFloat2("uRandomVec2", uRandomVec2.x, uRandomVec2.y);
	pathTracingEffect.effect.setFloat("uULen", uULen);
	pathTracingEffect.effect.setFloat("uVLen", uVLen);
	pathTracingEffect.effect.setFloat("uTime", uTime);
	pathTracingEffect.effect.setFloat("uFrameCounter", uFrameCounter);
	pathTracingEffect.effect.setFloat("uSampleCounter", uSampleCounter);
	pathTracingEffect.effect.setFloat("uPreviousSampleCount", uPreviousSampleCount);
	pathTracingEffect.effect.setFloat("uEPS_intersect", uEPS_intersect);
	pathTracingEffect.effect.setFloat("uApertureSize", uApertureSize);
	pathTracingEffect.effect.setFloat("uFocusDistance", uFocusDistance);
	pathTracingEffect.effect.setInt("uRightSphereMatType", uRightSphereMatType);
	pathTracingEffect.effect.setBool("uCameraIsMoving", uCameraIsMoving);
	pathTracingEffect.effect.setMatrix("uCameraMatrix", camera.getWorldMatrix());
	pathTracingEffect.effect.setMatrix("uLeftSphereInvMatrix", uLeftSphereInvMatrix);
	pathTracingEffect.effect.setMatrix("uRightSphereInvMatrix", uRightSphereInvMatrix);
});


function getElapsedTimeInSeconds()
{
	timeInSeconds += (engine.getDeltaTime() * 0.001);
	return timeInSeconds;
}


// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function ()
{

	// first, reset cameraIsMoving flag
	uCameraIsMoving = false;

	if (beginningFlag && uSampleCounter == 1)
	{
		pixel_ResolutionController.setValue(0.75);
		beginningFlag = false;
	}

	// if GUI has been used, update

	if (needChangePixelResolution)
	{
		engine.setHardwareScalingLevel(1.0 / pixel_ResolutionController.getValue());

		handleWindowResize();

		needChangePixelResolution = false;
	}
	
	if (needChangeSunDirRotation)
	{
		sunDirRotationX = sunDirTransform_RotateXController.getValue();
		sunDirRotationY = sunDirTransform_RotateYController.getValue();
		
		sunDirRotationX *= (Math.PI / 180);
		sunDirRotationY *= (Math.PI / 180);
		
		sunTransformNode.rotation.set(sunDirRotationX, sunDirRotationY, 0);

		uCameraIsMoving = true;
		needChangeSunDirRotation = false;
	}

	if (needChangeRightSphereMaterial)
	{
		if (rightSphere_MaterialController.getValue() == 'Transparent')
		{
			uRightSphereMatType = 2;// enum number code for TRANSPARENT material
		}
		else if (rightSphere_MaterialController.getValue() == 'Diffuse')
		{
			uRightSphereMatType = 1;// enum number code for DIFFUSE material
		}
		else if (rightSphere_MaterialController.getValue() == 'ClearCoat_Diffuse')
		{
			uRightSphereMatType = 4;// enum number code for CLEARCOAT_DIFFUSE material
		}
		else if (rightSphere_MaterialController.getValue() == 'Metal')
		{
			uRightSphereMatType = 3;// enum number code for METAL material
		}

		uCameraIsMoving = true;
		needChangeRightSphereMaterial = false;
	}


	// check for pointerLock state and add or remove keyboard listeners
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


	if (windowIsBeingResized)
	{
		uCameraIsMoving = true;
		windowIsBeingResized = false;
	}

	uTime = getElapsedTimeInSeconds();

	frameTime = engine.getDeltaTime() * 0.001;

	uRandomVec2.set(Math.random(), Math.random());

	// my own optimized way of telling if the camera has moved or not
	newCameraMatrix.copyFrom(camera.getWorldMatrix());
	nm = newCameraMatrix.m;
	om = oldCameraMatrix.m;
	if (nm[0] != om[0] || nm[1] != om[1] || nm[2] != om[2] || nm[3] != om[3] ||
		nm[4] != om[4] || nm[5] != om[5] || nm[6] != om[6] || nm[7] != om[7] ||
		nm[8] != om[8] || nm[9] != om[9] || nm[10] != om[10] || nm[11] != om[11] ||
		nm[12] != om[12] || nm[13] != om[13] || nm[14] != om[14] || nm[15] != om[15])
	{
		uCameraIsMoving = true;
	}
	// save camera state for next frame's comparison
	oldCameraMatrix.copyFrom(newCameraMatrix);

	// get current camera orientation basis vectors
	cameraDirectionVector.set(nm[8], nm[9], nm[10]);
	cameraDirectionVector.normalize();
	cameraUpVector.set(nm[4], nm[5], nm[6]);
	cameraUpVector.normalize();
	cameraRightVector.set(nm[0], nm[1], nm[2]);
	cameraRightVector.normalize();

	// check for user input
	if (keyPressed('KeyW') && !keyPressed('KeyS'))
	{
		camera.position.addInPlace(cameraDirectionVector.scaleToRef(camFlightSpeed * frameTime, cameraDirectionVector));
	}
	if (keyPressed('KeyS') && !keyPressed('KeyW'))
	{
		camera.position.subtractInPlace(cameraDirectionVector.scaleToRef(camFlightSpeed * frameTime, cameraDirectionVector));
	}
	if (keyPressed('KeyA') && !keyPressed('KeyD'))
	{
		camera.position.subtractInPlace(cameraRightVector.scaleToRef(camFlightSpeed * frameTime, cameraRightVector));
	}
	if (keyPressed('KeyD') && !keyPressed('KeyA'))
	{
		camera.position.addInPlace(cameraRightVector.scaleToRef(camFlightSpeed * frameTime, cameraRightVector));
	}
	if (keyPressed('KeyE') && !keyPressed('KeyQ'))
	{
		camera.position.addInPlace(cameraUpVector.scaleToRef(camFlightSpeed * frameTime, cameraUpVector));
	}
	if (keyPressed('KeyQ') && !keyPressed('KeyE'))
	{
		camera.position.subtractInPlace(cameraUpVector.scaleToRef(camFlightSpeed * frameTime, cameraUpVector));
	}

	if (keyPressed('Equal') && !keyPressed('Minus'))
	{
		uFocusDistance += focusDistChangeAmount;
		uCameraIsMoving = true;
	}
	if (keyPressed('Minus') && !keyPressed('Equal'))
	{
		uFocusDistance -= focusDistChangeAmount;
		if (uFocusDistance < 1)
			uFocusDistance = 1;
		uCameraIsMoving = true;
	}
	if (keyPressed('BracketRight') && !keyPressed('BracketLeft'))
	{
		uApertureSize += apertureChangeAmount;
		if (uApertureSize > 100000.0)
			uApertureSize = 100000.0;
		uCameraIsMoving = true;
	}
	if (keyPressed('BracketLeft') && !keyPressed('BracketRight'))
	{
		uApertureSize -= apertureChangeAmount;
		if (uApertureSize < 0.0)
			uApertureSize = 0.0;
		uCameraIsMoving = true;
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

	if (!uCameraIsMoving)
	{
		if (uSceneIsDynamic)
			uSampleCounter = 1.0; // reset for continuous updating of image
		else uSampleCounter += 1.0; // for progressive refinement of image

		uFrameCounter += 1.0;

		cameraRecentlyMoving = false;
	}

	if (uCameraIsMoving)
	{
		uFrameCounter += 1.0;

		if (!cameraRecentlyMoving)
		{
			// record current uSampleCounter value before it gets set to 1.0 below
			uPreviousSampleCount = uSampleCounter;
			uFrameCounter = 1.0;
			cameraRecentlyMoving = true;
		}

		uSampleCounter = 1.0;
	}

	uOneOverSampleCounter = 1.0 / uSampleCounter;

	// update Sun direction uniform
	//sunTransformNode.rotation.x += -0.01;
	uSunDirection.copyFrom(sunTransformNode.forward);


	// CAMERA INFO
	cameraInfoElement.innerHTML = "FOV( mousewheel ): " + (camera.fov * 180 / Math.PI).toFixed(0) + "<br>" + "Aperture( [ and ] ): " + uApertureSize.toFixed(1) +
		"<br>" + "FocusDistance( - and + ): " + uFocusDistance.toFixed(0) + "<br>" + "Samples: " + uSampleCounter;

	// the following is necessary to update the user's world camera movement - should take no time at all
	pathTracingScene.render();
	// now for the heavy lifter, the bulk of the frame time
	eRenderer.render(pathTracingEffect, pathTracingRenderTarget);
	// then simply copy(store) what the pathTracer just calculated - should take no time at all
	eRenderer.render(screenCopyEffect, screenCopyRenderTarget);
	// finally take the accumulated pathTracingRenderTarget buffer and average by numberOfSamples taken, then apply Reinhard tonemapping (brings image into friendly 0.0-1.0 rgb color float range),
	// and lastly raise to the power of (0.4545), in order to make gamma correction (gives more brightness range where it counts).  This last step should also take minimal time
	eRenderer.render(screenOutputEffect, null); // null, because we don't feed this non-linear image-processed output back into the pathTracing accumulation buffer as it would 'pollute' the pathtracing unbounded linear color space

	stats.update();
}); // end engine.runRenderLoop(function ()
