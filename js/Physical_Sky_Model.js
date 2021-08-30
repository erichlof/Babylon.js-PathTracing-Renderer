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
let infoElement = document.getElementById('info');
infoElement.style.cursor = "default";
infoElement.style.userSelect = "none";
infoElement.style.MozUserSelect = "none";

let cameraInfoElement = document.getElementById('cameraInfo');
cameraInfoElement.style.cursor = "default";
cameraInfoElement.style.userSelect = "none";
cameraInfoElement.style.MozUserSelect = "none";

// common required uniforms
let uRandomVec2 = new BABYLON.Vector2(); // used to offset the texture UV when sampling the blueNoiseTexture for smooth randomness - this vec2 is updated/changed every animation frame
let uTime = 0.0; // elapsed time in seconds since the app started
let uFrameCounter = 1.0; // 1 instead of 0 because it is used as a rng() seed in pathtracing shader
let uSampleCounter = 0.0; // will get increased by 1 in animation loop before rendering
let uOneOverSampleCounter = 0.0; // the sample accumulation buffer gets multiplied by this reciprocal of SampleCounter, for averaging final pixel color 
let uULen = 1.0; // rendering pixel horizontal scale, related to camera's FOV and aspect ratio
let uVLen = 1.0; // rendering pixel vertical scale, related to camera's FOV
let uCameraIsMoving = false; // lets the path tracer know if the camera is being moved 
let uToneMappingExposure = 1.0; // exposure amount when applying Reinhard tonemapping in final stages of pixel colors' output

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

canvas = document.getElementById("renderCanvas");

engine = new BABYLON.Engine(canvas, true);


// Create the scene space
pathTracingScene = new BABYLON.Scene(engine);

// enable browser's mouse pointer lock feature, for free-look camera controlled by mouse movement
pathTracingScene.onPointerDown = evt =>
{
        engine.enterPointerlock();
}

// setup the frame rate display (FPS) in the top-left corner 
container = document.getElementById('container');

stats = new Stats();
stats.domElement.style.position = 'absolute';
stats.domElement.style.top = '0px';
stats.domElement.style.cursor = "default";
stats.domElement.style.webkitUserSelect = "none";
stats.domElement.style.MozUserSelect = "none";
container.appendChild(stats.domElement);


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
                pixel_Resolution: 1.0
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

        pixel_ResolutionController = gui.add(pixel_ResolutionObject, 'pixel_Resolution', 0.3, 1.0, 0.01).onChange(handlePixelResolutionChange);
        sunDirTransform_RotateXController = gui.add(sunDirTransform_RotateXObject, 'sunDir_RotateX', 160, 370, 1).onChange(handleSunDirRotationChange);
        sunDirTransform_RotateYController = gui.add(sunDirTransform_RotateYObject, 'sunDir_RotateY', 0, 359, 1).onChange(handleSunDirRotationChange);

        rightSphere_MaterialController = gui.add(rightSphere_MaterialObject, 'RSphere_MaterialPreset', ['Transparent',
                'Diffuse', 'ClearCoat_Diffuse', 'Metal']).onChange(handleRightSphereMaterialChange);

        // jumpstart setting of initial sun direction when the demo begins
        handleSunDirRotationChange();
}

init_GUI();



// Add a camera to the scene and attach it to the canvas
camera = new BABYLON.UniversalCamera("Camera", new BABYLON.Vector3(), pathTracingScene);
camera.attachControl(canvas, true);

// SCENE/DEMO-SPECIFIC PARAMETERS
camera.position.set(0, -10, -200);
camera.inertia = 0;
camera.angularSensibility = 500;
camFlightSpeed = 100; // scene specific, depending on scene size dimensions
uApertureSize = 0.0; // aperture size at beginning of app
uFocusDistance = 113.0; // initial focus distance from camera in scene - scene specific, depending on scene size dimensions
const uEPS_intersect = mouseControl ? 0.01 : 1.0; // less precision on mobile - also both values are scene-size dependent
apertureChangeAmount = 1; // scene specific, depending on scene size dimensions
focusDistChangeAmount = 1; // scene specific, depending on scene size dimensions
uRightSphereMatType = 3; // enum number code for METAL material - demo starts off with this setting for right sphere
uSunAngularDiameterCos = mouseControl ? 0.9998 : 0.9995; // makes Sun a little bigger on mobile

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
        uniformNames: ["uOneOverSampleCounter", "uToneMappingExposure"],
        samplerNames: ["accumulationBuffer"],
        name: "screenOutputEffectWrapper"
});

screenOutput_eWrapper.onApplyObservable.add(() =>
{
        screenOutput_eWrapper.effect.setTexture("accumulationBuffer", pathTracingRenderTarget);
        screenOutput_eWrapper.effect.setFloat("uOneOverSampleCounter", uOneOverSampleCounter);
        screenOutput_eWrapper.effect.setFloat("uToneMappingExposure", uToneMappingExposure);
});

// MAIN PATH TRACING EFFECT
const pathTracing_eWrapper = new BABYLON.EffectWrapper({
        engine: engine,
        fragmentShader: BABYLON.Effect.ShadersStore["pathTracingFragmentShader"],
        uniformNames: ["uResolution", "uRandomVec2", "uULen", "uVLen", "uTime", "uFrameCounter", "uSampleCounter", "uEPS_intersect", "uCameraMatrix", "uApertureSize", 
                "uFocusDistance", "uCameraIsMoving", "uSunAngularDiameterCos", "uSunDirection", "uLeftSphereInvMatrix", "uRightSphereInvMatrix", "uRightSphereMatType"],
        samplerNames: ["previousBuffer", "blueNoiseTexture"],
        name: "pathTracingEffectWrapper"
});

pathTracing_eWrapper.onApplyObservable.add(() =>
{
        uVLen = Math.tan(camera.fov * 0.5);
        uULen = uVLen * (width / height);

        pathTracing_eWrapper.effect.setTexture("previousBuffer", screenCopyRenderTarget);
        pathTracing_eWrapper.effect.setTexture("blueNoiseTexture", blueNoiseTexture);
        pathTracing_eWrapper.effect.setVector3("uSunDirection", uSunDirection);
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
        pathTracing_eWrapper.effect.setFloat("uSunAngularDiameterCos", uSunAngularDiameterCos);
        pathTracing_eWrapper.effect.setInt("uRightSphereMatType", uRightSphereMatType);
        pathTracing_eWrapper.effect.setBool("uCameraIsMoving", uCameraIsMoving);
        pathTracing_eWrapper.effect.setMatrix("uCameraMatrix", camera.getWorldMatrix());
        pathTracing_eWrapper.effect.setMatrix("uLeftSphereInvMatrix", uLeftSphereInvMatrix);
        pathTracing_eWrapper.effect.setMatrix("uRightSphereInvMatrix", uRightSphereInvMatrix);
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

        // if GUI has been used, update

        if (needChangePixelResolution)
        {
                engine.setHardwareScalingLevel(Math.round(1 / pixel_ResolutionController.getValue()));

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
        if (keyPressed('rightbracket') && !keyPressed('leftbracket'))
        {
                uApertureSize += apertureChangeAmount;
                if (uApertureSize > 100000.0)
                        uApertureSize = 100000.0;
                uCameraIsMoving = true;
        }
        if (keyPressed('leftbracket') && !keyPressed('rightbracket'))
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

        // update Sun direction uniform
        //sunTransformNode.rotation.x += -0.01;
        uSunDirection.copyFrom(sunTransformNode.forward);


        uOneOverSampleCounter = 1.0 / uSampleCounter;

        // CAMERA INFO
        cameraInfoElement.innerHTML = "FOV( mousewheel ): " + (camera.fov * 180 / Math.PI).toFixed(0) + "<br>" + "Aperture( [ and ] ): " + uApertureSize.toFixed(1) +
                "<br>" + "FocusDistance( - and + ): " + uFocusDistance.toFixed(0) + "<br>" + "Samples: " + uSampleCounter;

        // the following is necessary to update the user's world camera movement - should take no time at all
        pathTracingScene.render();
        // now for the heavy lifter, the bulk of the frame time
        eRenderer.render(pathTracing_eWrapper, pathTracingRenderTarget);
        // then simply copy(store) what the pathTracer just calculated - should take no time at all
        eRenderer.render(screenCopy_eWrapper, screenCopyRenderTarget);
        // finally take the accumulated pathTracingRenderTarget buffer and average by numberOfSamples taken, then apply Reinhard tonemapping (brings image into friendly 0.0-1.0 rgb color float range),
        // and lastly raise to the power of (0.4545), in order to make gamma correction (gives more brightness range where it counts).  This last step should also take minimal time
        eRenderer.render(screenOutput_eWrapper, null); // null, because we don't feed this non-linear image-processed output back into the pathTracing accumulation buffer as it would 'pollute' the pathtracing unbounded linear color space

        stats.update();
}); // end engine.runRenderLoop(function ()
