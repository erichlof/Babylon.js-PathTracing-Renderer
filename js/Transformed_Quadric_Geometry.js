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
let apertureChangeAmount; // scene specific, depending on scene size dimensions
let uFocusDistance; // scene specific, depending on scene size dimensions
let focusDistChangeAmount; // scene specific, depending on scene size dimensions
let mouseControl = true;
let cameraDirectionVector = new BABYLON.Vector3(); //for moving where the camera is looking
let cameraRightVector = new BABYLON.Vector3(); //for strafing the camera right and left
let cameraUpVector = new BABYLON.Vector3(); //for moving camera up and down
let blueNoiseTexture;

// common required uniforms
let uRandomVec2 = new BABYLON.Vector2(); // used to offset the texture UV when sampling the blueNoiseTexture for smooth randomness - this vec2 is updated/changed every animation frame
let uTime = 0.0; // elapsed time in seconds since the app started
let uFrameCounter = 1.0; // 1 instead of 0 because it is used as a rng() seed in pathtracing shader
let uSampleCounter = 0.0; // will get increased by 1 in animation loop before rendering
let uOneOverSampleCounter = 0.0; // the sample accumulation buffer gets multiplied by this reciprocal of SampleCounter, for averaging final pixel color 
let uULen = 1.0; // rendering pixel horizontal scale, related to camera's FOV and aspect ratio
let uVLen = 1.0; // rendering pixel vertical scale, related to camera's FOV
let uCameraIsMoving = false; // lets the path tracer know if the camera is being moved 

// scene/demo-specific variables;
let shapeRadius = 10;
let wallRadius = 50;
let sphereTransformNode, cylinderTransformNode, coneTransformNode, paraboloidTransformNode, hyperboloidTransformNode, capsuleTransformNode,
        boxTransformNode, pyramidFrustumTransformNode, diskTransformNode, rectangleTransformNode, torusTransformNode;
let transformOperation = 0; // 0 = rotation, 1 = translation, 2 = scale

// scene/demo-specific uniforms
let uQuadLightPlaneSelectionNumber;
let uQuadLightRadius;
let uAllShapesMatType;
let uShapeK = 1.0;
let uSphereInvMatrix = new BABYLON.Matrix();
let uCylinderInvMatrix = new BABYLON.Matrix();
let uConeInvMatrix = new BABYLON.Matrix();
let uParaboloidInvMatrix = new BABYLON.Matrix();
let uHyperboloidInvMatrix = new BABYLON.Matrix();
let uCapsuleInvMatrix = new BABYLON.Matrix();
let uBoxInvMatrix = new BABYLON.Matrix();
let uPyramidFrustumInvMatrix = new BABYLON.Matrix();
let uDiskInvMatrix = new BABYLON.Matrix();
let uRectangleInvMatrix = new BABYLON.Matrix();
let uTorusInvMatrix = new BABYLON.Matrix();


const KEYCODE_NAMES = {
        65: 'a', 66: 'b', 67: 'c', 68: 'd', 69: 'e', 70: 'f', 71: 'g', 72: 'h', 73: 'i', 74: 'j', 75: 'k', 76: 'l', 77: 'm',
        78: 'n', 79: 'o', 80: 'p', 81: 'q', 82: 'r', 83: 's', 84: 't', 85: 'u', 86: 'v', 87: 'w', 88: 'x', 89: 'y', 90: 'z',
        37: 'left', 38: 'up', 39: 'right', 40: 'down', 32: 'space', 33: 'pageup', 34: 'pagedown', 9: 'tab',
        189: 'dash', 187: 'equals', 219: 'leftbracket', 221: 'rightbracket', 188: 'comma', 190: 'period', 27: 'escape', 13: 'enter',
        48: 'zero', 49: 'one', 50: 'two', 51: 'three', 52: 'four', 53: 'five', 54: 'six', 55: 'seven', 56: 'eight', 57: 'nine'
}
let KeyboardState = {
        a: false, b: false, c: false, d: false, e: false, f: false, g: false, h: false, i: false, j: false, k: false, l: false, m: false,
        n: false, o: false, p: false, q: false, r: false, s: false, t: false, u: false, v: false, w: false, x: false, y: false, z: false,
        left: false, up: false, right: false, down: false, space: false, pageup: false, pagedown: false, tab: false,
        dash: false, equals: false, leftbracket: false, rightbracket: false, comma: false, period: false, escape: false, enter: false,
        zero: false, one: false, two: false, three: false, four: false, five: false, six: false, seven: false, eight: false, nine: false
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

if ('ontouchstart' in window)
{
        mouseControl = false;
        // TODO: instantiate my custom 'MobileJoystickControls' or similar Babylon solution?
}

if (mouseControl)
{
        window.addEventListener('wheel', onMouseWheel, false);
}

canvas = document.getElementById("renderCanvas");
engine = new BABYLON.Engine(canvas, true);
// scale image by 2, which is half the work for GPU to do (BABYLON later calculates: 1/scalingLevel = amount of GPU task)
// so 1/scalingLevel, or 1/(2) = 0.5 GPU task - this helps most GPUs to maintain 30-60 FPS
engine.setHardwareScalingLevel(2); // default scalingLevel is 1. You can try scalingLevel of 1 if you have a powerful GPU that can keep 60 FPS


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

// SCENE/DEMO-SPECIFIC PARAMETERS
camera.position.set(0, -20, -120);
camera.inertia = 0;
camera.angularSensibility = 500;
camFlightSpeed = 100; // scene specific, depending on scene size dimensions
uApertureSize = 0.0; // aperture size at beginning of app
uFocusDistance = 113.0; // initial focus distance from camera in scene - scene specific, depending on scene size dimensions
const uEPS_intersect = mouseControl ? 0.01 : 1.0; // less precision on mobile - also both values are scene-size dependent
apertureChangeAmount = 2; // scene specific, depending on scene size dimensions
focusDistChangeAmount = 1; // scene specific, depending on scene size dimensions
uQuadLightPlaneSelectionNumber = 6;
uQuadLightRadius = 50;
uAllShapesMatType = 4; // enum number code for ClearCoat Diffuse material - demo starts off with this material applied to all of the shapes

oldCameraMatrix = new BABYLON.Matrix();
newCameraMatrix = new BABYLON.Matrix();

// must be instantiated here after scene has been created
sphereTransformNode = new BABYLON.TransformNode();
sphereTransformNode.position.set(-wallRadius * 0.75, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.75);
sphereTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

cylinderTransformNode = new BABYLON.TransformNode();
cylinderTransformNode.position.set(wallRadius * 0.75, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.75);
cylinderTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

coneTransformNode = new BABYLON.TransformNode();
coneTransformNode.position.set(-wallRadius * 0.15, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.6);
coneTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

paraboloidTransformNode = new BABYLON.TransformNode();
paraboloidTransformNode.position.set(wallRadius * 0.25, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.2);
paraboloidTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

hyperboloidTransformNode = new BABYLON.TransformNode();
hyperboloidTransformNode.position.set(wallRadius * 0.7, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.25);
hyperboloidTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

capsuleTransformNode = new BABYLON.TransformNode();
capsuleTransformNode.position.set(-wallRadius * 0.25, -wallRadius + (2.25*shapeRadius) + 0.01, wallRadius * 0.45);
capsuleTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

boxTransformNode = new BABYLON.TransformNode();
boxTransformNode.position.set(wallRadius * 0.25, -wallRadius + shapeRadius + 0.01, wallRadius * 0.45);
boxTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

pyramidFrustumTransformNode = new BABYLON.TransformNode();
pyramidFrustumTransformNode.position.set(-wallRadius * 0.5, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.2);
pyramidFrustumTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

diskTransformNode = new BABYLON.TransformNode();
diskTransformNode.position.set(wallRadius * 0.75, -wallRadius + shapeRadius + 0.01, wallRadius * 0.45);
diskTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

rectangleTransformNode = new BABYLON.TransformNode();
rectangleTransformNode.position.set(-wallRadius * 0.75, -wallRadius + shapeRadius + 0.01, wallRadius * 0.45);
rectangleTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);

torusTransformNode = new BABYLON.TransformNode();
torusTransformNode.position.set(wallRadius * 0.25, -wallRadius + shapeRadius + 0.01, -wallRadius * 0.8);
torusTransformNode.scaling.set(shapeRadius, shapeRadius, shapeRadius);



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
        uniformNames: ["uResolution", "uRandomVec2", "uULen", "uVLen", "uTime", "uFrameCounter", "uSampleCounter", "uEPS_intersect", "uCameraMatrix", "uApertureSize", "uFocusDistance", 
                "uCameraIsMoving", "uShapeK", "uAllShapesMatType", "uTorusInvMatrix", "uSphereInvMatrix", "uCylinderInvMatrix", "uConeInvMatrix", "uParaboloidInvMatrix", "uHyperboloidInvMatrix", 
                "uCapsuleInvMatrix", "uBoxInvMatrix", "uPyramidFrustumInvMatrix", "uDiskInvMatrix", "uRectangleInvMatrix", "uQuadLightPlaneSelectionNumber", "uQuadLightRadius"],
        samplerNames: ["previousBuffer", "blueNoiseTexture"],
        name: "pathTracingEffectWrapper"
});

pathTracing_eWrapper.onApplyObservable.add(() =>
{
        uVLen = Math.tan(camera.fov * 0.5);
        uULen = uVLen * (width / height);

        pathTracing_eWrapper.effect.setTexture("previousBuffer", screenCopyRenderTarget);
        pathTracing_eWrapper.effect.setTexture("blueNoiseTexture", blueNoiseTexture);
        pathTracing_eWrapper.effect.setFloat2("uResolution", pathTracingRenderTarget.getSize().width, pathTracingRenderTarget.getSize().height);
        pathTracing_eWrapper.effect.setFloat2("uRandomVec2", uRandomVec2.x, uRandomVec2.y);
        pathTracing_eWrapper.effect.setFloat("uULen", uULen);
        pathTracing_eWrapper.effect.setFloat("uVLen", uVLen);
        pathTracing_eWrapper.effect.setFloat("uTime", uTime);
        pathTracing_eWrapper.effect.setFloat("uFrameCounter", uFrameCounter);
        pathTracing_eWrapper.effect.setFloat("uSampleCounter", uSampleCounter);
        pathTracing_eWrapper.effect.setFloat("uEPS_intersect", uEPS_intersect);
        pathTracing_eWrapper.effect.setFloat("uApertureSize", uApertureSize);
        pathTracing_eWrapper.effect.setFloat("uFocusDistance", uFocusDistance);
        pathTracing_eWrapper.effect.setFloat("uQuadLightPlaneSelectionNumber", uQuadLightPlaneSelectionNumber);
        pathTracing_eWrapper.effect.setFloat("uQuadLightRadius", uQuadLightRadius);
	pathTracing_eWrapper.effect.setFloat("uShapeK", uShapeK);
        pathTracing_eWrapper.effect.setInt("uAllShapesMatType", uAllShapesMatType);
        pathTracing_eWrapper.effect.setBool("uCameraIsMoving", uCameraIsMoving);
        pathTracing_eWrapper.effect.setMatrix("uCameraMatrix", camera.getWorldMatrix());
        pathTracing_eWrapper.effect.setMatrix("uSphereInvMatrix", uSphereInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uCylinderInvMatrix", uCylinderInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uConeInvMatrix", uConeInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uParaboloidInvMatrix", uParaboloidInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uHyperboloidInvMatrix", uHyperboloidInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uCapsuleInvMatrix", uCapsuleInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uBoxInvMatrix", uBoxInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uPyramidFrustumInvMatrix", uPyramidFrustumInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uDiskInvMatrix", uDiskInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uRectangleInvMatrix", uRectangleInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uTorusInvMatrix", uTorusInvMatrix);
});


function getElapsedTimeInSeconds()
{
        timeInSeconds += (engine.getDeltaTime() * 0.001);
        return timeInSeconds;
}


// Register a render loop to repeatedly render the scene
engine.runRenderLoop(function ()
{

        // first check for pointerLock state and add or remove keyboard listeners
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
                uFocusDistance += focusDistChangeAmount;
                uCameraIsMoving = true;
        }
        if (keyPressed('dash') && !keyPressed('equals'))
        {
                uFocusDistance -= focusDistChangeAmount;
                if (uFocusDistance < 1)
                        uFocusDistance = 1;
                uCameraIsMoving = true;
        }
        if (keyPressed('period') && !keyPressed('comma'))
        {
                uApertureSize += apertureChangeAmount;
                if (uApertureSize > 100000.0)
                        uApertureSize = 100000.0;
                uCameraIsMoving = true;
        }
        if (keyPressed('comma') && !keyPressed('period'))
        {
                uApertureSize -= apertureChangeAmount;
                if (uApertureSize < 0.0)
                        uApertureSize = 0.0;
                uCameraIsMoving = true;
        }
        if (keyPressed('leftbracket') && !keyPressed('rightbracket'))
        {
                uQuadLightRadius -= 20 * frameTime;
                if (uQuadLightRadius < 5)
                        uQuadLightRadius = 5;
                uCameraIsMoving = true;
        }
        if (keyPressed('rightbracket') && !keyPressed('leftbracket'))
        {
                uQuadLightRadius += 20 * frameTime;
                if (uQuadLightRadius > 150)
                        uQuadLightRadius = 150;
                uCameraIsMoving = true;
        }

        if (keyPressed('one'))
        {
                uQuadLightPlaneSelectionNumber = 1;
                uCameraIsMoving = true;
        }
        else if (keyPressed('two'))
        {
                uQuadLightPlaneSelectionNumber = 2;
                uCameraIsMoving = true;
        }
        else if (keyPressed('three'))
        {
                uQuadLightPlaneSelectionNumber = 3;
                uCameraIsMoving = true;
        }
        else if (keyPressed('four'))
        {
                uQuadLightPlaneSelectionNumber = 4;
                uCameraIsMoving = true;
        }
        else if (keyPressed('five'))
        {
                uQuadLightPlaneSelectionNumber = 5;
                uCameraIsMoving = true;
        }
        else if (keyPressed('six'))
        {
                uQuadLightPlaneSelectionNumber = 6;
                uCameraIsMoving = true;
        }
        else if (keyPressed('seven'))
        {
                uAllShapesMatType = 2;// enum number code for TRANSPARENT material
                uCameraIsMoving = true;
        }
        else if (keyPressed('eight'))
        {
                uAllShapesMatType = 1;// enum number code for DIFFUSE material
                uCameraIsMoving = true;
        }
        else if (keyPressed('nine'))
        {
                uAllShapesMatType = 4;// enum number code for CLEARCOAT_DIFFUSE material
                uCameraIsMoving = true;
        }
        else if (keyPressed('zero'))
        {
                uAllShapesMatType = 3;// enum number code for METAL material
                uCameraIsMoving = true;
        }

	if (keyPressed('z') && !keyPressed('x'))
	{
		uShapeK -= 1 * frameTime;
		if (uShapeK < 0.01) 
			uShapeK = 0.01;
		uCameraIsMoving = true;
	}
	if (keyPressed('x') && !keyPressed('z'))
	{
		uShapeK += 1 * frameTime;
		if (uShapeK > 1)
			uShapeK = 1;
		uCameraIsMoving = true;
	}

        if (keyPressed('r'))
        {
                transformOperation = 0; // rotation
        }
        else if (keyPressed('t'))
        {
                transformOperation = 1; // translation
        }
        else if (keyPressed('y'))
        {
                transformOperation = 2; // scale
        }

        if (transformOperation == 0) // rotation
        {
                if (keyPressed('f') && !keyPressed('g'))
                {
                        sphereTransformNode.rotation.x -= 1 * frameTime;
                        cylinderTransformNode.rotation.x -= 1 * frameTime;
                        coneTransformNode.rotation.x -= 1 * frameTime;
                        paraboloidTransformNode.rotation.x -= 1 * frameTime;
                        hyperboloidTransformNode.rotation.x -= 1 * frameTime;
                        capsuleTransformNode.rotation.x -= 1 * frameTime;
                        boxTransformNode.rotation.x -= 1 * frameTime;
                        pyramidFrustumTransformNode.rotation.x -= 1 * frameTime;
                        diskTransformNode.rotation.x -= 1 * frameTime;
                        rectangleTransformNode.rotation.x -= 1 * frameTime;
                        torusTransformNode.rotation.x -= 1 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('g') && !keyPressed('f'))
                {
                        sphereTransformNode.rotation.x += 1 * frameTime;
                        cylinderTransformNode.rotation.x += 1 * frameTime;
                        coneTransformNode.rotation.x += 1 * frameTime;
                        paraboloidTransformNode.rotation.x += 1 * frameTime;
                        hyperboloidTransformNode.rotation.x += 1 * frameTime;
                        capsuleTransformNode.rotation.x += 1 * frameTime;
                        boxTransformNode.rotation.x += 1 * frameTime;
                        pyramidFrustumTransformNode.rotation.x += 1 * frameTime;
                        diskTransformNode.rotation.x += 1 * frameTime;
                        rectangleTransformNode.rotation.x += 1 * frameTime;
                        torusTransformNode.rotation.x += 1 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('h') && !keyPressed('j'))
                {
                        sphereTransformNode.rotation.y -= 1 * frameTime;
                        cylinderTransformNode.rotation.y -= 1 * frameTime;
                        coneTransformNode.rotation.y -= 1 * frameTime;
                        paraboloidTransformNode.rotation.y -= 1 * frameTime;
                        hyperboloidTransformNode.rotation.y -= 1 * frameTime;
                        capsuleTransformNode.rotation.y -= 1 * frameTime;
                        boxTransformNode.rotation.y -= 1 * frameTime;
                        pyramidFrustumTransformNode.rotation.y -= 1 * frameTime;
                        diskTransformNode.rotation.y -= 1 * frameTime;
                        rectangleTransformNode.rotation.y -= 1 * frameTime;
                        torusTransformNode.rotation.y -= 1 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('j') && !keyPressed('h'))
                {
                        sphereTransformNode.rotation.y += 1 * frameTime;
                        cylinderTransformNode.rotation.y += 1 * frameTime;
                        coneTransformNode.rotation.y += 1 * frameTime;
                        paraboloidTransformNode.rotation.y += 1 * frameTime;
                        hyperboloidTransformNode.rotation.y += 1 * frameTime;
                        capsuleTransformNode.rotation.y += 1 * frameTime;
                        boxTransformNode.rotation.y += 1 * frameTime;
                        pyramidFrustumTransformNode.rotation.y += 1 * frameTime;
                        diskTransformNode.rotation.y += 1 * frameTime;
                        rectangleTransformNode.rotation.y += 1 * frameTime;
                        torusTransformNode.rotation.y += 1 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('k') && !keyPressed('l'))
                {
                        sphereTransformNode.rotation.z -= 1 * frameTime;
                        cylinderTransformNode.rotation.z -= 1 * frameTime;
                        coneTransformNode.rotation.z -= 1 * frameTime;
                        paraboloidTransformNode.rotation.z -= 1 * frameTime;
                        hyperboloidTransformNode.rotation.z -= 1 * frameTime;
                        capsuleTransformNode.rotation.z -= 1 * frameTime;
                        boxTransformNode.rotation.z -= 1 * frameTime;
                        pyramidFrustumTransformNode.rotation.z -= 1 * frameTime;
                        diskTransformNode.rotation.z -= 1 * frameTime;
                        rectangleTransformNode.rotation.z -= 1 * frameTime;
                        torusTransformNode.rotation.z -= 1 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('l') && !keyPressed('k'))
                {
                        sphereTransformNode.rotation.z += 1 * frameTime;
                        cylinderTransformNode.rotation.z += 1 * frameTime;
                        coneTransformNode.rotation.z += 1 * frameTime;
                        paraboloidTransformNode.rotation.z += 1 * frameTime;
                        hyperboloidTransformNode.rotation.z += 1 * frameTime;
                        capsuleTransformNode.rotation.z += 1 * frameTime;
                        boxTransformNode.rotation.z += 1 * frameTime;
                        pyramidFrustumTransformNode.rotation.z += 1 * frameTime;
                        diskTransformNode.rotation.z += 1 * frameTime;
                        rectangleTransformNode.rotation.z += 1 * frameTime;
                        torusTransformNode.rotation.z += 1 * frameTime;
                        uCameraIsMoving = true;
                }
        }
        else if (transformOperation == 1) // translation
        {
                if (keyPressed('f') && !keyPressed('g'))
                {
                        sphereTransformNode.position.x -= 20 * frameTime;
                        cylinderTransformNode.position.x -= 20 * frameTime;
                        coneTransformNode.position.x -= 20 * frameTime;
                        paraboloidTransformNode.position.x -= 20 * frameTime;
                        hyperboloidTransformNode.position.x -= 20 * frameTime;
                        capsuleTransformNode.position.x -= 20 * frameTime;
                        boxTransformNode.position.x -= 20 * frameTime;
                        pyramidFrustumTransformNode.position.x -= 20 * frameTime;
                        diskTransformNode.position.x -= 20 * frameTime;
                        rectangleTransformNode.position.x -= 20 * frameTime;
                        torusTransformNode.position.x -= 20 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('g') && !keyPressed('f'))
                {
                        sphereTransformNode.position.x += 20 * frameTime;
                        cylinderTransformNode.position.x += 20 * frameTime;
                        coneTransformNode.position.x += 20 * frameTime;
                        paraboloidTransformNode.position.x += 20 * frameTime;
                        hyperboloidTransformNode.position.x += 20 * frameTime;
                        capsuleTransformNode.position.x += 20 * frameTime;
                        boxTransformNode.position.x += 20 * frameTime;
                        pyramidFrustumTransformNode.position.x += 20 * frameTime;
                        diskTransformNode.position.x += 20 * frameTime;
                        rectangleTransformNode.position.x += 20 * frameTime;
                        torusTransformNode.position.x += 20 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('h') && !keyPressed('j'))
                {
                        sphereTransformNode.position.y -= 20 * frameTime;
                        cylinderTransformNode.position.y -= 20 * frameTime;
                        coneTransformNode.position.y -= 20 * frameTime;
                        paraboloidTransformNode.position.y -= 20 * frameTime;
                        hyperboloidTransformNode.position.y -= 20 * frameTime;
                        capsuleTransformNode.position.y -= 20 * frameTime;
                        boxTransformNode.position.y -= 20 * frameTime;
                        pyramidFrustumTransformNode.position.y -= 20 * frameTime;
                        diskTransformNode.position.y -= 20 * frameTime;
                        rectangleTransformNode.position.y -= 20 * frameTime;
                        torusTransformNode.position.y -= 20 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('j') && !keyPressed('h'))
                {
                        sphereTransformNode.position.y += 20 * frameTime;
                        cylinderTransformNode.position.y += 20 * frameTime;
                        coneTransformNode.position.y += 20 * frameTime;
                        paraboloidTransformNode.position.y += 20 * frameTime;
                        hyperboloidTransformNode.position.y += 20 * frameTime;
                        capsuleTransformNode.position.y += 20 * frameTime;
                        boxTransformNode.position.y += 20 * frameTime;
                        pyramidFrustumTransformNode.position.y += 20 * frameTime;
                        diskTransformNode.position.y += 20 * frameTime;
                        rectangleTransformNode.position.y += 20 * frameTime;
                        torusTransformNode.position.y += 20 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('k') && !keyPressed('l'))
                {
                        sphereTransformNode.position.z -= 20 * frameTime;
                        cylinderTransformNode.position.z -= 20 * frameTime;
                        coneTransformNode.position.z -= 20 * frameTime;
                        paraboloidTransformNode.position.z -= 20 * frameTime;
                        hyperboloidTransformNode.position.z -= 20 * frameTime;
                        capsuleTransformNode.position.z -= 20 * frameTime;
                        boxTransformNode.position.z -= 20 * frameTime;
                        pyramidFrustumTransformNode.position.z -= 20 * frameTime;
                        diskTransformNode.position.z -= 20 * frameTime;
                        rectangleTransformNode.position.z -= 20 * frameTime;
                        torusTransformNode.position.z -= 20 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('l') && !keyPressed('k'))
                {
                        sphereTransformNode.position.z += 20 * frameTime;
                        cylinderTransformNode.position.z += 20 * frameTime;
                        coneTransformNode.position.z += 20 * frameTime;
                        paraboloidTransformNode.position.z += 20 * frameTime;
                        hyperboloidTransformNode.position.z += 20 * frameTime;
                        capsuleTransformNode.position.z += 20 * frameTime;
                        boxTransformNode.position.z += 20 * frameTime;
                        pyramidFrustumTransformNode.position.z += 20 * frameTime;
                        diskTransformNode.position.z += 20 * frameTime;
                        rectangleTransformNode.position.z += 20 * frameTime;
                        torusTransformNode.position.z += 20 * frameTime;
                        uCameraIsMoving = true;
                }
        }
        else if (transformOperation == 2) // scale
        {
                if (keyPressed('f') && !keyPressed('g'))
                {
                        sphereTransformNode.scaling.x -= 10 * frameTime;
                        cylinderTransformNode.scaling.x -= 10 * frameTime;
                        coneTransformNode.scaling.x -= 10 * frameTime;
                        paraboloidTransformNode.scaling.x -= 10 * frameTime;
                        hyperboloidTransformNode.scaling.x -= 10 * frameTime;
                        capsuleTransformNode.scaling.x -= 10 * frameTime;
                        boxTransformNode.scaling.x -= 10 * frameTime;
                        pyramidFrustumTransformNode.scaling.x -= 10 * frameTime;
                        diskTransformNode.scaling.x -= 10 * frameTime;
                        rectangleTransformNode.scaling.x -= 10 * frameTime;
                        torusTransformNode.scaling.x -= 10 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('g') && !keyPressed('f'))
                {
                        sphereTransformNode.scaling.x += 10 * frameTime;
                        cylinderTransformNode.scaling.x += 10 * frameTime;
                        coneTransformNode.scaling.x += 10 * frameTime;
                        paraboloidTransformNode.scaling.x += 10 * frameTime;
                        hyperboloidTransformNode.scaling.x += 10 * frameTime;
                        capsuleTransformNode.scaling.x += 10 * frameTime;
                        boxTransformNode.scaling.x += 10 * frameTime;
                        pyramidFrustumTransformNode.scaling.x += 10 * frameTime;
                        diskTransformNode.scaling.x += 10 * frameTime;
                        rectangleTransformNode.scaling.x += 10 * frameTime;
                        torusTransformNode.scaling.x += 10 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('h') && !keyPressed('j'))
                {
                        sphereTransformNode.scaling.y -= 10 * frameTime;
                        cylinderTransformNode.scaling.y -= 10 * frameTime;
                        coneTransformNode.scaling.y -= 10 * frameTime;
                        paraboloidTransformNode.scaling.y -= 10 * frameTime;
                        hyperboloidTransformNode.scaling.y -= 10 * frameTime;
                        capsuleTransformNode.scaling.y -= 10 * frameTime;
                        boxTransformNode.scaling.y -= 10 * frameTime;
                        pyramidFrustumTransformNode.scaling.y -= 10 * frameTime;
                        diskTransformNode.scaling.y -= 10 * frameTime;
                        rectangleTransformNode.scaling.y -= 10 * frameTime;
                        torusTransformNode.scaling.y -= 10 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('j') && !keyPressed('h'))
                {
                        sphereTransformNode.scaling.y += 10 * frameTime;
                        cylinderTransformNode.scaling.y += 10 * frameTime;
                        coneTransformNode.scaling.y += 10 * frameTime;
                        paraboloidTransformNode.scaling.y += 10 * frameTime;
                        hyperboloidTransformNode.scaling.y += 10 * frameTime;
                        capsuleTransformNode.scaling.y += 10 * frameTime;
                        boxTransformNode.scaling.y += 10 * frameTime;
                        pyramidFrustumTransformNode.scaling.y += 10 * frameTime;
                        diskTransformNode.scaling.y += 10 * frameTime;
                        rectangleTransformNode.scaling.y += 10 * frameTime;
                        torusTransformNode.scaling.y += 10 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('k') && !keyPressed('l'))
                {
                        sphereTransformNode.scaling.z -= 10 * frameTime;
                        cylinderTransformNode.scaling.z -= 10 * frameTime;
                        coneTransformNode.scaling.z -= 10 * frameTime;
                        paraboloidTransformNode.scaling.z -= 10 * frameTime;
                        hyperboloidTransformNode.scaling.z -= 10 * frameTime;
                        capsuleTransformNode.scaling.z -= 10 * frameTime;
                        boxTransformNode.scaling.z -= 10 * frameTime;
                        pyramidFrustumTransformNode.scaling.z -= 10 * frameTime;
                        diskTransformNode.scaling.z -= 10 * frameTime;
                        rectangleTransformNode.scaling.z -= 10 * frameTime;
                        torusTransformNode.scaling.z -= 10 * frameTime;
                        uCameraIsMoving = true;
                }
                if (keyPressed('l') && !keyPressed('k'))
                {
                        sphereTransformNode.scaling.z += 10 * frameTime;
                        cylinderTransformNode.scaling.z += 10 * frameTime;
                        coneTransformNode.scaling.z += 10 * frameTime;
                        paraboloidTransformNode.scaling.z += 10 * frameTime;
                        hyperboloidTransformNode.scaling.z += 10 * frameTime;
                        capsuleTransformNode.scaling.z += 10 * frameTime;
                        boxTransformNode.scaling.z += 10 * frameTime;
                        pyramidFrustumTransformNode.scaling.z += 10 * frameTime;
                        diskTransformNode.scaling.z += 10 * frameTime;
                        rectangleTransformNode.scaling.z += 10 * frameTime;
                        torusTransformNode.scaling.z += 10 * frameTime;
                        uCameraIsMoving = true;
                }
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

        // update various quadric shapes' inverse matrices
        uSphereInvMatrix.copyFrom(sphereTransformNode.getWorldMatrix());
        uSphereInvMatrix.invert();
        uCylinderInvMatrix.copyFrom(cylinderTransformNode.getWorldMatrix());
        uCylinderInvMatrix.invert();
        uConeInvMatrix.copyFrom(coneTransformNode.getWorldMatrix());
        uConeInvMatrix.invert();
        uParaboloidInvMatrix.copyFrom(paraboloidTransformNode.getWorldMatrix());
        uParaboloidInvMatrix.invert();
        uHyperboloidInvMatrix.copyFrom(hyperboloidTransformNode.getWorldMatrix());
        uHyperboloidInvMatrix.invert();
        uCapsuleInvMatrix.copyFrom(capsuleTransformNode.getWorldMatrix());
        uCapsuleInvMatrix.invert();
        uBoxInvMatrix.copyFrom(boxTransformNode.getWorldMatrix());
        uBoxInvMatrix.invert();
        uPyramidFrustumInvMatrix.copyFrom(pyramidFrustumTransformNode.getWorldMatrix());
        uPyramidFrustumInvMatrix.invert();
        uDiskInvMatrix.copyFrom(diskTransformNode.getWorldMatrix());
        uDiskInvMatrix.invert();
        uRectangleInvMatrix.copyFrom(rectangleTransformNode.getWorldMatrix());
        uRectangleInvMatrix.invert();
        uTorusInvMatrix.copyFrom(torusTransformNode.getWorldMatrix());
        uTorusInvMatrix.invert();

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
