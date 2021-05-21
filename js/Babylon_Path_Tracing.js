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
let uColorEdgeSharpeningRate  = 0.0; // 0.0-1.0 how fast should a color difference edge boundary (i.e. checkerboard) sharpen into focus
let uNormalEdgeSharpeningRate = 1.0; // 0.0-1.0 how fast should a surface normal difference edge boundary (i.e. corner of a room) sharpen into focus
let uObjectEdgeSharpeningRate = 0.05; // 0.0-1.0 how fast should an object difference edge boundary (i.e. 2 similar spheres: one closer that is partially blocking the other one behind it) sharpen into focus

// scene/demo-specific uniforms
let uQuadLightPlaneSelectionNumber;
let uQuadLightRadius;


BABYLON.Effect.ShadersStore["screenCopyFragmentShader"] = `
#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

uniform sampler2D pathTracedImageBuffer;

out vec4 glFragColor;

void main(void)
{
        glFragColor = texelFetch(pathTracedImageBuffer, ivec2(gl_FragCoord.xy), 0);
}
`;


BABYLON.Effect.ShadersStore["screenOutputFragmentShader"] = `
#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

uniform float uOneOverSampleCounter;

uniform sampler2D accumulationBuffer;

out vec4 glFragColor;

// source: https://www.cs.utah.edu/~reinhard/cdrom/
vec3 ReinhardToneMapping(vec3 color) 
{
	// TODO: make 'toneMappingExposure' a uniform
	float toneMappingExposure = 1.1; 
	color *= toneMappingExposure;
	return clamp(color / (vec3(1) + color), 0.0, 1.0);
}

void main(void)
{
	// 5x5 kernel
        vec4 m25[25];

        m25[ 0] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-2, 2)), 0);
        m25[ 1] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-1, 2)), 0);
        m25[ 2] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 0, 2)), 0);
        m25[ 3] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 1, 2)), 0);
        m25[ 4] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 2, 2)), 0);

        m25[ 5] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-2, 1)), 0);
        m25[ 6] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-1, 1)), 0);
        m25[ 7] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 0, 1)), 0);
        m25[ 8] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 1, 1)), 0);
        m25[ 9] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 2, 1)), 0);

        m25[10] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-2, 0)), 0);
        m25[11] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-1, 0)), 0);
        m25[12] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 0, 0)), 0);
        m25[13] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 1, 0)), 0);
        m25[14] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 2, 0)), 0);

        m25[15] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-2,-1)), 0);
        m25[16] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-1,-1)), 0);
        m25[17] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 0,-1)), 0);
        m25[18] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 1,-1)), 0);
        m25[19] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 2,-1)), 0);

        m25[20] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-2,-2)), 0);
        m25[21] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2(-1,-2)), 0);
        m25[22] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 0,-2)), 0);
        m25[23] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 1,-2)), 0);
        m25[24] = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy + vec2( 2,-2)), 0);
        
        vec4 centerPixel = m25[12];
        vec3 filteredPixelColor;
	float threshold = 1.0;
        int count = 1;

        // start with center pixel
        filteredPixelColor = m25[12].rgb;
        // search left
        if (m25[11].a < threshold)
        {
                filteredPixelColor += m25[11].rgb;
                count++; 
                if (m25[10].a < threshold)
                {
                        filteredPixelColor += m25[10].rgb;
                        count++; 
                }
                if (m25[5].a < threshold)
                {
                        filteredPixelColor += m25[5].rgb;
                        count++; 
                }
        }
        // search right
        if (m25[13].a < threshold)
        {
                filteredPixelColor += m25[13].rgb;
                count++; 
                if (m25[14].a < threshold)
                {
                        filteredPixelColor += m25[14].rgb;
                        count++; 
                }
                if (m25[19].a < threshold)
                {
                        filteredPixelColor += m25[19].rgb;
                        count++; 
                }
        }
        // search above
        if (m25[7].a < threshold)
        {
                filteredPixelColor += m25[7].rgb;
                count++; 
                if (m25[2].a < threshold)
                {
                        filteredPixelColor += m25[2].rgb;
                        count++; 
                }
                if (m25[3].a < threshold)
                {
                        filteredPixelColor += m25[3].rgb;
                        count++; 
                }
        }
        // search below
        if (m25[17].a < threshold)
        {
                filteredPixelColor += m25[17].rgb;
                count++; 
                if (m25[22].a < threshold)
                {
                        filteredPixelColor += m25[22].rgb;
                        count++; 
                }
                if (m25[21].a < threshold)
                {
                        filteredPixelColor += m25[21].rgb;
                        count++; 
                }
        }

        // search upper-left
        if (m25[6].a < threshold)
        {
                filteredPixelColor += m25[6].rgb;
                count++; 
                if (m25[0].a < threshold)
                {
                        filteredPixelColor += m25[0].rgb;
                        count++; 
                }
                if (m25[1].a < threshold)
                {
                        filteredPixelColor += m25[1].rgb;
                        count++; 
                }
        }
        // search upper-right
        if (m25[8].a < threshold)
        {
                filteredPixelColor += m25[8].rgb;
                count++; 
                if (m25[4].a < threshold)
                {
                        filteredPixelColor += m25[4].rgb;
                        count++; 
                }
                if (m25[9].a < threshold)
                {
                        filteredPixelColor += m25[9].rgb;
                        count++; 
                }
        }
        // search lower-left
        if (m25[16].a < threshold)
        {
                filteredPixelColor += m25[16].rgb;
                count++; 
                if (m25[15].a < threshold)
                {
                        filteredPixelColor += m25[15].rgb;
                        count++; 
                }
                if (m25[20].a < threshold)
                {
                        filteredPixelColor += m25[20].rgb;
                        count++; 
                }
        }
        // search lower-right
        if (m25[18].a < threshold)
        {
                filteredPixelColor += m25[18].rgb;
                count++; 
                if (m25[23].a < threshold)
                {
                        filteredPixelColor += m25[23].rgb;
                        count++; 
                }
                if (m25[24].a < threshold)
                {
                        filteredPixelColor += m25[24].rgb;
                        count++; 
                }
        }
        
        filteredPixelColor /= float(count);


        // 3x3 kernel
        vec4 m9[9];
        m9[0] = m25[6];
        m9[1] = m25[7];
        m9[2] = m25[8];

        m9[3] = m25[11];
        m9[4] = m25[12];
        m9[5] = m25[13];

        m9[6] = m25[16];
        m9[7] = m25[17];
        m9[8] = m25[18];

        if (centerPixel.a > 0.0 || centerPixel.a == -1.0)
        {
                // reset variables
                centerPixel = m9[4];
                count = 1;

                // start with center pixel
                filteredPixelColor = m9[4].rgb;

                // search left
                if (m9[3].a < threshold)
                {
                        filteredPixelColor += m9[3].rgb;
                        count++; 
                }
                // search right
                if (m9[5].a < threshold)
                {
                        filteredPixelColor += m9[5].rgb;
                        count++; 
                }
                // search above
                if (m9[1].a < threshold)
                {
                        filteredPixelColor += m9[1].rgb;
                        count++; 
                }
                // search below
                if (m9[7].a < threshold)
                {
                        filteredPixelColor += m9[7].rgb;
                        count++; 
                }

                // search upper-left
                if (m9[0].a < threshold)
                {
                        filteredPixelColor += m9[0].rgb;
                        count++; 
                }
                // search upper-right
                if (m9[2].a < threshold)
                {
                        filteredPixelColor += m9[2].rgb;
                        count++; 
                }
                // search lower-left
                if (m9[6].a < threshold)
                {
                        filteredPixelColor += m9[6].rgb;
                        count++; 
                }
                // search lower-right
                if (m9[8].a < threshold)
                {
                        filteredPixelColor += m9[8].rgb;
                        count++; 
                }

                filteredPixelColor /= float(count);

                filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, 0.5);
        } // end if (centerPixel.a > 0.0)


        if ((centerPixel.a == 1.01 && uOneOverSampleCounter < 0.005) || uOneOverSampleCounter < 0.0002)
        {
                filteredPixelColor = centerPixel.rgb;
        }


        // final filteredPixelColor processing ////////////////////////////////////

        // average accumulation buffer
        filteredPixelColor *= uOneOverSampleCounter;

        // apply tone mapping (brings pixel into 0.0-1.0 rgb color range)
        filteredPixelColor = ReinhardToneMapping(filteredPixelColor);
        
        // lastly, apply gamma correction (gives more intensity/brightness range where it's needed)
        glFragColor = clamp(vec4( pow(filteredPixelColor, vec3(0.4545)), 1.0 ), 0.0, 1.0);
}
`;


BABYLON.Effect.ShadersStore["pathTracingFragmentShader"] = `
#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

// Demo-specific Uniforms
uniform float uQuadLightPlaneSelectionNumber;
uniform float uQuadLightRadius;

// demo/scene-specific setup
#define N_QUADS 6
#define N_SPHERES 2

struct Ray { vec3 origin; vec3 direction; };
struct Sphere { float radius; vec3 position; vec3 color; int type; };
struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 color; int type; };
struct Intersection { float t; vec3 normal; vec3 color; int type; float objectID; };

Quad quads[N_QUADS];
Sphere spheres[N_SPHERES];

// all required includes go here:

#include<pathtracing_defines_and_uniforms> // required on all scenes

#include<pathtracing_random> // required on all scenes

#include<pathtracing_calc_fresnel> // required on all scenes

#include<pathtracing_solve_quadratic> // required on scenes with any math-geometry shapes like sphere, cylinder, cone, etc.

#include<pathtracing_sphere_intersect> // required on scenes with spheres

#include<pathtracing_quad_intersect> // required on scenes with quads (actually internally they are made up of 2 triangles)

#include<pathtracing_sample_axis_aligned_quad_light> // required on scenes with axis-aligned quad area lights (quad must reside in either XY, XZ, or YZ planes) 


//-----------------------------------------------------------
void SceneIntersect( Ray r, out Intersection intersection )
//-----------------------------------------------------------
{
	float d;
	int objectCount = 0;
	// initialize intersection fields
	intersection.t = INFINITY;
	intersection.type = -100;
	intersection.objectID = -INFINITY;

        for (int i = 0; i < N_SPHERES; i++)
        {
		d = SphereIntersect( spheres[i].radius, spheres[i].position, r );

		if (d < intersection.t)
		{
			intersection.t = d;
			intersection.normal = normalize((r.origin + r.direction * intersection.t) - spheres[i].position);
			intersection.color = spheres[i].color;
                        intersection.type = spheres[i].type;
			intersection.objectID = float(objectCount);
		}

		objectCount++;
        }


	for (int i = 0; i < N_QUADS; i++)
        {
		d = QuadIntersect( quads[i].v0, quads[i].v1, quads[i].v2, quads[i].v3, r, false );

		if (d < intersection.t)
		{
			intersection.t = d;
			intersection.normal = normalize(quads[i].normal);
			intersection.color = quads[i].color;
			intersection.type = quads[i].type;
			intersection.objectID = float(objectCount);
		}

		objectCount++;
        }

} // end void SceneIntersect( Ray r, out Intersection intersection )



//-----------------------------------------------------------------------------------------------------------------------------
vec3 CalculateRadiance( Ray r, out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
//-----------------------------------------------------------------------------------------------------------------------------
{
	Intersection intersection; // this struct will hold a record of ray-surface intersection data

	Quad light = quads[5];

	vec3 accumCol = vec3(0);
        vec3 mask = vec3(1);
	vec3 dirToLight;
	vec3 tdir;
	vec3 x, n, nl;
	vec3 absorptionCoefficient;

	float nc, nt, ratioIoR, Re, Tr;
	float P, RP, TP;
	float weight;
	float thickness = 0.05;
	float scatteringDistance;

	int diffuseCount = 0;
	int previousIntersecType = -100;
	intersection.type = -100;

	bool coatTypeIntersected = false;
	bool bounceIsSpecular = true;
	bool sampleLight = false;


	for (int bounces = 0; bounces < 6; bounces++)
	{
		previousIntersecType = intersection.type;

		SceneIntersect(r, intersection);


		// useful data
		n = normalize(intersection.normal);
                nl = dot(n, r.direction) < 0.0 ? normalize(n) : normalize(-n);
		x = r.origin + r.direction * intersection.t;

		if (bounces == 0)
		{
			objectNormal = nl;
			objectColor = intersection.color;
			objectID = intersection.objectID;
		}
		if (bounces == 1 && previousIntersecType == METAL)
		{
			objectNormal = nl;
			objectID = intersection.objectID;
		}


		// now we can break if nothing was intersected because we needed to get the intersection data first
		if (intersection.t == INFINITY)
			break;


		if (intersection.type == LIGHT)
		{
			if (diffuseCount == 0)
				pixelSharpness = 1.01;

			if (bounceIsSpecular || sampleLight)
				accumCol = mask * intersection.color;

			// reached a light, so we can exit
			break;

		} // end if (intersection.type == LIGHT)


		// if we get here and sampleLight is still true, shadow ray failed to find a light source
		if (sampleLight)
			break;



                if (intersection.type == DIFFUSE) // Ideal diffuse reflection
		{
			diffuseCount++;

			mask *= intersection.color;

			bounceIsSpecular = false;

			if (diffuseCount == 1 && blueNoise_rand() < 0.5)
			{
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			dirToLight = sampleAxisAlignedQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += nl * uEPS_intersect;

			sampleLight = true;
			continue;

		} // end if (intersection.type == DIFFUSE)


		if (intersection.type == METAL)  // Ideal metal specular reflection
		{
			mask *= intersection.color;

			r = Ray( x, reflect(r.direction, nl) );
			r.origin += nl * uEPS_intersect;

			continue;
		}


		if (intersection.type == TRANSPARENT)  // Ideal dielectric specular reflection/refraction
		{
			if (diffuseCount == 0 && !coatTypeIntersected && !uCameraIsMoving )
				pixelSharpness = 1.01;
			else if (diffuseCount > 0)
				pixelSharpness = 0.0;
			else
				pixelSharpness = -1.0;
			
			nc = 1.0; // IOR of Air
			nt = 1.5; // IOR of common Glass
			Re = calcFresnelReflectance(r.direction, n, nc, nt, ratioIoR);
			Tr = 1.0 - Re;
			P  = 0.25 + (0.5 * Re);
                	RP = Re / P;
                	TP = Tr / (1.0 - P);

			if (blueNoise_rand() < P)
			{
				mask *= RP;
				r = Ray( x, reflect(r.direction, nl) ); // reflect ray from surface
				r.origin += nl * uEPS_intersect;
				continue;
			}

			// transmit ray through surface

			// is ray leaving a solid object from the inside?
			// If so, attenuate ray color with object color by how far ray has travelled through the medium
			if (distance(n, nl) > 0.1)
			{
				thickness = 0.01;
				mask *= exp( log(clamp(intersection.color, 0.01, 0.99)) * thickness * intersection.t );
			}

			mask *= TP;

			tdir = refract(r.direction, nl, ratioIoR);
			r = Ray(x, tdir);
			r.origin -= nl * uEPS_intersect;

			if (diffuseCount == 1)
				bounceIsSpecular = true; // turn on refracting caustics

			continue;

		} // end if (intersection.type == TRANSPARENT)


		if (intersection.type == CLEARCOAT_DIFFUSE)  // Diffuse object underneath with ClearCoat on top
		{
			coatTypeIntersected = true;

			pixelSharpness = 0.0;

			nc = 1.0; // IOR of Air
			nt = 1.4; // IOR of Clear Coat
			Re = calcFresnelReflectance(r.direction, n, nc, nt, ratioIoR);
			Tr = 1.0 - Re;
			P  = 0.25 + (0.5 * Re);
                	RP = Re / P;
                	TP = Tr / (1.0 - P);

			if (blueNoise_rand() < P)
			{
				if (diffuseCount == 0)
					pixelSharpness = uFrameCounter > 500.0 ? 1.01 : -1.0;

				mask *= RP;
				r = Ray( x, reflect(r.direction, nl) ); // reflect ray from surface
				r.origin += nl * uEPS_intersect;
				continue;
			}

			diffuseCount++;
			mask *= TP;
			mask *= intersection.color;

			bounceIsSpecular = false;

			if (diffuseCount == 1 && blueNoise_rand() < 0.5)
			{
				// choose random Diffuse sample vector
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			dirToLight = sampleAxisAlignedQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += nl * uEPS_intersect;

			sampleLight = true;
			continue;

		} //end if (intersection.type == CLEARCOAT_DIFFUSE)

	} // end for (int bounces = 0; bounces < 6; bounces++)


	return max(vec3(0), accumCol);

} // end vec3 CalculateRadiance( Ray r, out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )


//-------------------
void SetupScene(void)
//-------------------
{
	vec3 light_emissionColor = vec3(1.0, 1.0, 1.0) * 10.0; // Bright white light

	float sphereRadius = 16.0;
	float wallRadius = 50.0;
	float lightRadius = uQuadLightRadius * 0.2;

	spheres[0] = Sphere( sphereRadius, vec3(-wallRadius*0.45, -wallRadius + sphereRadius + 0.1, -wallRadius*0.2), vec3(1.0, 1.0, 0.0), CLEARCOAT_DIFFUSE ); // clearCoat diffuse Sphere Left
	spheres[1] = Sphere( sphereRadius, vec3( wallRadius*0.45, -wallRadius + sphereRadius + 0.1, -wallRadius*0.2), vec3(1.0, 1.0, 1.0), METAL ); // glass Sphere Right
 
	
	quads[0] = Quad( vec3( 0, 0, 1), vec3(-wallRadius, wallRadius, wallRadius), vec3( wallRadius, wallRadius, wallRadius), vec3( wallRadius,-wallRadius, wallRadius), vec3(-wallRadius,-wallRadius, wallRadius), vec3( 1.0,  1.0,  1.0), DIFFUSE);// Back Wall
	quads[1] = Quad( vec3( 1, 0, 0), vec3(-wallRadius,-wallRadius, wallRadius), vec3(-wallRadius,-wallRadius,-wallRadius), vec3(-wallRadius, wallRadius,-wallRadius), vec3(-wallRadius, wallRadius, wallRadius), vec3( 0.7, 0.05, 0.05), DIFFUSE);// Left Wall Red
	quads[2] = Quad( vec3(-1, 0, 0), vec3( wallRadius,-wallRadius,-wallRadius), vec3( wallRadius,-wallRadius, wallRadius), vec3( wallRadius, wallRadius, wallRadius), vec3( wallRadius, wallRadius,-wallRadius), vec3(0.05, 0.05,  0.7), DIFFUSE);// Right Wall Blue
	quads[3] = Quad( vec3( 0,-1, 0), vec3(-wallRadius, wallRadius,-wallRadius), vec3( wallRadius, wallRadius,-wallRadius), vec3( wallRadius, wallRadius, wallRadius), vec3(-wallRadius, wallRadius, wallRadius), vec3( 1.0,  1.0,  1.0), DIFFUSE);// Ceiling
	quads[4] = Quad( vec3( 0, 1, 0), vec3(-wallRadius,-wallRadius, wallRadius), vec3( wallRadius,-wallRadius, wallRadius), vec3( wallRadius,-wallRadius,-wallRadius), vec3(-wallRadius,-wallRadius,-wallRadius), vec3( 1.0,  1.0,  1.0), DIFFUSE);// Floor

	if (uQuadLightPlaneSelectionNumber == 1.0)
		quads[5] = Quad( vec3(-1, 0, 0), vec3(wallRadius-1.0,-lightRadius, lightRadius), vec3(wallRadius-1.0, lightRadius, lightRadius), vec3(wallRadius-1.0, lightRadius,-lightRadius), vec3(wallRadius-1.0,-lightRadius,-lightRadius), light_emissionColor, LIGHT);// Quad Area Light on right wall
	else if (uQuadLightPlaneSelectionNumber == 2.0)
		quads[5] = Quad( vec3( 1, 0, 0), vec3(-wallRadius+1.0,-lightRadius,-lightRadius), vec3(-wallRadius+1.0, lightRadius,-lightRadius), vec3(-wallRadius+1.0, lightRadius, lightRadius), vec3(-wallRadius+1.0,-lightRadius, lightRadius), light_emissionColor, LIGHT);// Quad Area Light on left wall
	else if (uQuadLightPlaneSelectionNumber == 3.0)
		quads[5] = Quad( vec3( 0, 0, 1), vec3(-lightRadius,-lightRadius, -wallRadius+1.0), vec3(lightRadius,-lightRadius, -wallRadius+1.0), vec3(lightRadius, lightRadius, -wallRadius+1.0), vec3(-lightRadius, lightRadius, -wallRadius+1.0), light_emissionColor, LIGHT);// Quad Area Light on front 'wall'(opening of box)
	else if (uQuadLightPlaneSelectionNumber == 4.0)
		quads[5] = Quad( vec3( 0, 0,-1), vec3(-lightRadius,-lightRadius, wallRadius-1.0), vec3(-lightRadius, lightRadius, wallRadius-1.0), vec3(lightRadius, lightRadius, wallRadius-1.0), vec3(lightRadius,-lightRadius, wallRadius-1.0), light_emissionColor, LIGHT);// Quad Area Light on back wall
	else if (uQuadLightPlaneSelectionNumber == 5.0)
		quads[5] = Quad( vec3( 0, 1, 0), vec3(-lightRadius, -wallRadius+1.0,-lightRadius), vec3(-lightRadius, -wallRadius+1.0, lightRadius), vec3(lightRadius, -wallRadius+1.0, lightRadius), vec3(lightRadius, -wallRadius+1.0,-lightRadius), light_emissionColor, LIGHT);// Quad Area Light on floor	
	else if (uQuadLightPlaneSelectionNumber == 6.0)
		quads[5] = Quad( vec3( 0,-1, 0), vec3(-lightRadius, wallRadius-1.0,-lightRadius), vec3(lightRadius, wallRadius-1.0,-lightRadius), vec3(lightRadius, wallRadius-1.0, lightRadius), vec3(-lightRadius, wallRadius-1.0, lightRadius), light_emissionColor, LIGHT);// Quad Area Light on ceiling
	
} // end void SetupScene(void)


// if your scene is static and doesn't have any special requirements, you can use the default main()
#include<pathtracing_default_main>

`;



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

oldCameraMatrix = new BABYLON.Matrix;
newCameraMatrix = new BABYLON.Matrix;
camera.attachControl(canvas, true);

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
		"uColorEdgeSharpeningRate", "uNormalEdgeSharpeningRate", "uObjectEdgeSharpeningRate", "uCameraIsMoving", "uQuadLightPlaneSelectionNumber", "uQuadLightRadius"],
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
	pathTracing_eWrapper.effect.setFloat("uColorEdgeSharpeningRate", uColorEdgeSharpeningRate);
	pathTracing_eWrapper.effect.setFloat("uNormalEdgeSharpeningRate", uNormalEdgeSharpeningRate);
	pathTracing_eWrapper.effect.setFloat("uObjectEdgeSharpeningRate", uObjectEdgeSharpeningRate);
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
