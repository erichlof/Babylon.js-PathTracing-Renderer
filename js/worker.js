importScripts("https://preview.babylonjs.com/babylon.js");
importScripts("https://preview.babylonjs.com/loaders/babylonjs.loaders.min.js");
importScripts("./Babylon_Path_Tracing.js");

var engine;

onmessage = function (evt) {

    if (evt.data.canvas) {
        canvas = evt.data.canvas;

        engine = new BABYLON.Engine(canvas, true);
        RealtimeRT.createScene(engine, canvas);

    } else {
        RealtimeRT.handleOnResize();
    }
}