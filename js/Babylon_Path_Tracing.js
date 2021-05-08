"use strict"

this.RealtimeRT = {};
let pathTracingScene;
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
	vec3 pixelColor = texelFetch(accumulationBuffer, ivec2(gl_FragCoord.xy), 0).rgb * uOneOverSampleCounter;
        pixelColor = ReinhardToneMapping(pixelColor);

	glFragColor = clamp(vec4( pow(pixelColor, vec3(0.4545)), 1.0 ), 0.0, 1.0);
}
`;

BABYLON.Effect.ShadersStore["pathTracingFragmentShader"] = `
#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

// common defines, will eventually be placed in BABYLON.Effect.ShadersStore[]
#define PI               3.14159265358979323
#define TWO_PI           6.28318530717958648
#define FOUR_PI          12.5663706143591729
#define ONE_OVER_PI      0.31830988618379067
#define ONE_OVER_TWO_PI  0.15915494309
#define ONE_OVER_FOUR_PI 0.07957747154594767
#define PI_OVER_TWO      1.57079632679489662
#define ONE_OVER_THREE   0.33333333333333333
#define E                2.71828182845904524
#define INFINITY         1000000.0
#define SPOT_LIGHT -2
#define POINT_LIGHT -1
#define LIGHT 0
#define DIFF 1
#define REFR 2
#define SPEC 3
#define COAT 4
#define CARCOAT 5
#define TRANSLUCENT 6
#define SPECSUB 7
#define CHECK 8
#define WATER 9
#define PBR_MATERIAL 10
#define WOOD 11
#define SEAFLOOR 12
#define TERRAIN 13
#define CLOTH 14
#define LIGHTWOOD 15
#define DARKWOOD 16
#define PAINTING 17
#define METALCOAT 18

// built-in Varyings
//in vec2 vUV;

// Samplers
uniform sampler2D previousBuffer;

// common Uniforms, will eventually be placed in BABYLON.Effect.ShadersStore[]
uniform mat4 uCameraMatrix;
uniform vec2 uResolution;
uniform float uULen;
uniform float uVLen;
uniform float uTime;
uniform float uFrameCounter;
uniform float uSampleCounter;
uniform float uEPS_intersect;
uniform float uApertureSize;
uniform float uFocusDistance;
uniform bool uCameraIsMoving;

// Demo-specific Uniforms


// PathTracing Library utilities
// all of the following will eventually be placed in BABYLON.Effect.ShadersStore[]
uvec2 seed;
float rng()
{
	seed += uvec2(1);
    	uvec2 q = 1103515245U * ( (seed >> 1U) ^ (seed.yx) );
    	uint  n = 1103515245U * ( (q.x) ^ (q.y >> 3U) );
	return float(n) * (1.0 / float(0xffffffffU));
}

vec3 randomSphereDirection()
{
    	float up = rng() * 2.0 - 1.0; // range: -1 to +1
	float over = sqrt( max(0.0, 1.0 - up * up) );
	float around = rng() * TWO_PI;
	return normalize(vec3(cos(around) * over, up, sin(around) * over));
}

vec3 randomCosWeightedDirectionInHemisphere(vec3 nl)
{
	float r = sqrt(rng()); // cos-weighted distribution in hemisphere
	float phi = rng() * TWO_PI;
	float x = r * cos(phi);
	float y = r * sin(phi);
	float z = sqrt(1.0 - x*x - y*y);

	vec3 U = normalize( cross(vec3(0.7071067811865475, 0.7071067811865475, 0), nl ) );
	vec3 V = cross(nl, U);
	return normalize(x * U + y * V + z * nl);
}

float calcFresnelReflectance(vec3 rayDirection, vec3 n, float etai, float etat, out float ratioIoR)
{
	float temp = etai;
	float cosi = clamp(dot(rayDirection, n), -1.0, 1.0);
	if (cosi > 0.0)
	{
		etai = etat;
		etat = temp;
	}

	ratioIoR = etai / etat;
	float sint = ratioIoR * sqrt(1.0 - (cosi * cosi));
	if (sint >= 1.0)
		return 1.0; // total internal reflection
	float cost = sqrt(1.0 - (sint * sint));
	cosi = abs(cosi);
	float Rs = ((etat * cosi) - (etai * cost)) / ((etat * cosi) + (etai * cost));
	float Rp = ((etai * cosi) - (etat * cost)) / ((etai * cosi) + (etat * cost));
	return clamp( ((Rs * Rs) + (Rp * Rp)) * 0.5, 0.0, 1.0 );
}

float tentFilter(float x)
{
	return (x < 0.5) ? sqrt(2.0 * x) - 1.0 : 1.0 - sqrt(2.0 - (2.0 * x));
}

// demo/scene-specific setup
#define N_QUADS 6
#define N_SPHERES 2

struct Ray { vec3 origin; vec3 direction; };
struct Sphere { float radius; vec3 position; vec3 emission; vec3 color; int type; };
struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 emission; vec3 color; int type; };
struct Intersection { vec3 normal; vec3 emission; vec3 color; int type; };

Quad quads[N_QUADS];
Sphere spheres[N_SPHERES];

void solveQuadratic(float A, float B, float C, out float t0, out float t1)
{
	float invA = 1.0 / A;
	B *= invA;
	C *= invA;
	float neg_halfB = -B * 0.5;
	float u2 = neg_halfB * neg_halfB - C;
	float u = u2 < 0.0 ? neg_halfB = 0.0 : sqrt(u2);
	t0 = neg_halfB - u;
	t1 = neg_halfB + u;
}

float SphereIntersect( float rad, vec3 pos, Ray ray )
{
	float t0, t1;
	vec3 L = ray.origin - pos;
	float a = dot( ray.direction, ray.direction );
	float b = 2.0 * dot( ray.direction, L );
	float c = dot( L, L ) - (rad * rad);
	solveQuadratic(a, b, c, t0, t1);
	return t0 > 0.0 ? t0 : t1 > 0.0 ? t1 : INFINITY;
}

float TriangleIntersect( vec3 v0, vec3 v1, vec3 v2, Ray r, bool isDoubleSided )
{
	vec3 edge1 = v1 - v0;
	vec3 edge2 = v2 - v0;
	vec3 pvec = cross(r.direction, edge2);
	float det = 1.0 / dot(edge1, pvec);
	if ( !isDoubleSided && det < 0.0 )
		return INFINITY;
	vec3 tvec = r.origin - v0;
	float u = dot(tvec, pvec) * det;
	vec3 qvec = cross(tvec, edge1);
	float v = dot(r.direction, qvec) * det;
	float t = dot(edge2, qvec) * det;
	return (u < 0.0 || u > 1.0 || v < 0.0 || u + v > 1.0 || t <= 0.0) ? INFINITY : t;
}

float QuadIntersect( vec3 v0, vec3 v1, vec3 v2, vec3 v3, Ray r, bool isDoubleSided )
{
	return min(TriangleIntersect(v0, v1, v2, r, isDoubleSided), TriangleIntersect(v0, v2, v3, r, isDoubleSided));
}

vec3 sampleSphereLight(vec3 x, vec3 nl, Sphere light, out float weight)
{
	vec3 dirToLight = (light.position - x); // no normalize (for distance calc below)
	float cos_alpha_max = sqrt(1.0 - clamp((light.radius * light.radius) / dot(dirToLight, dirToLight), 0.0, 1.0));

	float cos_alpha = mix( cos_alpha_max, 1.0, rng() ); // 1.0 + (rng() * (cos_alpha_max - 1.0));
	// * 0.75 below ensures shadow rays don't miss the light, due to shader float precision
	float sin_alpha = sqrt(max(0.0, 1.0 - cos_alpha * cos_alpha)) * 0.75;
	float phi = rng() * TWO_PI;
	dirToLight = normalize(dirToLight);

	vec3 U = normalize( cross(vec3(0.7071067811865475, 0.7071067811865475, 0), dirToLight ) );
	vec3 V = cross(dirToLight, U);

	vec3 sampleDir = normalize(U * cos(phi) * sin_alpha + V * sin(phi) * sin_alpha + dirToLight * cos_alpha);
	weight = clamp(2.0 * (1.0 - cos_alpha_max) * max(0.0, dot(nl, sampleDir)), 0.0, 1.0);

	return sampleDir;
}

vec3 sampleQuadLight(vec3 x, vec3 nl, Quad light, out float weight)
{
	vec3 randPointOnLight;
	randPointOnLight.x = mix(light.v0.x, light.v2.x, clamp(rng(), 0.1, 0.9));
	randPointOnLight.y = light.v0.y;
	randPointOnLight.z = mix(light.v0.z, light.v2.z, clamp(rng(), 0.1, 0.9));
	vec3 dirToLight = randPointOnLight - x;
	float r2 = distance(light.v0, light.v1) * distance(light.v0, light.v3);
	float d2 = dot(dirToLight, dirToLight);
	float cos_a_max = sqrt(1.0 - clamp( r2 / d2, 0.0, 1.0));
	dirToLight = normalize(dirToLight);
	float dotNlRayDir = max(0.0, dot(nl, dirToLight));
	weight =  2.0 * (1.0 - cos_a_max) * max(0.0, -dot(dirToLight, light.normal)) * dotNlRayDir;
	weight = clamp(weight, 0.0, 1.0);
	return dirToLight;
}


//---------------------------------------------------------------------------------------
float SceneIntersect( Ray r, inout Intersection intersec, out float intersectedObjectID )
//---------------------------------------------------------------------------------------
{
	float d;
	float t = INFINITY;

        for (int i = 0; i < N_SPHERES; i++)
        {
		d = SphereIntersect( spheres[i].radius, spheres[i].position, r );
		if (d < t)
		{
			t = d;
			intersec.normal = normalize((r.origin + r.direction * t) - spheres[i].position);
			intersec.emission = spheres[i].emission;
			intersec.color = spheres[i].color;
                        intersec.type = spheres[i].type;
			intersectedObjectID = 0.0;
		}
        }

	for (int i = 0; i < N_QUADS; i++)
        {
		d = QuadIntersect( quads[i].v0, quads[i].v1, quads[i].v2, quads[i].v3, r, false );
		if (d < t)
		{
			t = d;
			intersec.normal = normalize(quads[i].normal);
			intersec.emission = quads[i].emission;
			intersec.color = quads[i].color;
			intersec.type = quads[i].type;
			intersectedObjectID = 1.0;
		}
        }

	return t;
}


//-----------------------------------------------------------------------------------------------------------------------------
vec3 CalculateRadiance( Ray r, out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
//-----------------------------------------------------------------------------------------------------------------------------
{
	Intersection intersec;
	Quad light = quads[5];

	vec3 accumCol = vec3(0);
        vec3 mask = vec3(1);
	vec3 dirToLight;
	vec3 tdir;
	vec3 x, n, nl;
	vec3 absorptionCoefficient;

	float t;
	float nc, nt, ratioIoR, Re, Tr;
	float P, RP, TP;
	float weight;
	float thickness = 0.05;
	float scatteringDistance;
	float intersectedObjectID;

	int diffuseCount = 0;
	int previousIntersecType = -100;

	bool bounceIsSpecular = true;
	bool sampleLight = false;


	for (int bounces = 0; bounces < 6; bounces++)
	{

		t = SceneIntersect(r, intersec, intersectedObjectID);


		if (t == INFINITY)
			break;

		// useful data
		n = normalize(intersec.normal);
                nl = dot(n, r.direction) < 0.0 ? normalize(n) : normalize(-n);
		x = r.origin + r.direction * t;

		if (bounces == 0)
		{
			objectNormal = nl;
			objectColor = intersec.color;
			objectID = intersectedObjectID;
		}
		if (bounces == 1 && previousIntersecType == SPEC)
		{
			objectColor = intersec.color;
		}



		if (intersec.type == LIGHT)
		{
			if (diffuseCount == 0)
			{
				objectNormal = nl;
				pixelSharpness = 1.0;
			}

			if (bounceIsSpecular || sampleLight)
				accumCol = mask * intersec.emission;
			// reached a light, so we can exit
			break;

		} // end if (intersec.type == LIGHT)


		// if we get here and sampleLight is still true, shadow ray failed to find a light source
		if (sampleLight)
			break;



                if (intersec.type == DIFF) // Ideal DIFFUSE reflection
		{
			previousIntersecType = DIFF;

			diffuseCount++;

			mask *= intersec.color;

			bounceIsSpecular = false;

			if (diffuseCount == 1 && rng() < 0.5)
			{
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			dirToLight = sampleQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += nl * uEPS_intersect;

			sampleLight = true;
			continue;

		} // end if (intersec.type == DIFF)

		if (intersec.type == SPEC)  // Ideal SPECULAR reflection
		{
			previousIntersecType = SPEC;

			mask *= intersec.color;

			r = Ray( x, reflect(r.direction, nl) );
			r.origin += nl * uEPS_intersect;

			continue;
		}

		if (intersec.type == REFR)  // Ideal dielectric REFRACTION
		{
			previousIntersecType = REFR;

			nc = 1.0; // IOR of Air
			nt = 1.5; // IOR of common Glass
			Re = calcFresnelReflectance(r.direction, n, nc, nt, ratioIoR);
			Tr = 1.0 - Re;
			P  = 0.25 + (0.5 * Re);
                	RP = Re / P;
                	TP = Tr / (1.0 - P);

			if (rng() < P)
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
				mask *= exp( log(clamp(intersec.color, 0.01, 0.99)) * thickness * t );
			}

			mask *= TP;

			tdir = refract(r.direction, nl, ratioIoR);
			r = Ray(x, tdir);
			r.origin -= nl * uEPS_intersect;

			if (diffuseCount == 1)
				bounceIsSpecular = true; // turn on refracting caustics

			continue;

		} // end if (intersec.type == REFR)

		if (intersec.type == COAT)  // Diffuse object underneath with ClearCoat on top
		{
			previousIntersecType = COAT;

			nc = 1.0; // IOR of Air
			nt = 1.4; // IOR of Clear Coat
			Re = calcFresnelReflectance(r.direction, n, nc, nt, ratioIoR);
			Tr = 1.0 - Re;
			P  = 0.25 + (0.5 * Re);
                	RP = Re / P;
                	TP = Tr / (1.0 - P);

			if (rng() < P)
			{
				mask *= RP;
				r = Ray( x, reflect(r.direction, nl) ); // reflect ray from surface
				r.origin += nl * uEPS_intersect;
				continue;
			}

			diffuseCount++;
			mask *= TP;
			mask *= intersec.color;

			bounceIsSpecular = false;

			if (diffuseCount == 1 && rng() < 0.5)
			{
				// choose random Diffuse sample vector
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			dirToLight = sampleQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += nl * uEPS_intersect;

			sampleLight = true;
			continue;

		} //end if (intersec.type == COAT)

		if (intersec.type == CARCOAT)  // Colored Metal or Fiberglass object underneath with ClearCoat on top
		{
			previousIntersecType = COAT;

			nc = 1.0; // IOR of Air
			nt = 1.4; // IOR of Clear Coat
			Re = calcFresnelReflectance(r.direction, n, nc, nt, ratioIoR);
			Tr = 1.0 - Re;
			P  = 0.25 + (0.5 * Re);
                	RP = Re / P;
                	TP = Tr / (1.0 - P);

			// choose either specular reflection, metallic, or diffuse
			if (rng() < P)
			{
				mask *= RP;
				r = Ray( x, reflect(r.direction, nl) ); // reflect ray from surface
				r.origin += nl * uEPS_intersect;
				continue;
			}

			mask *= TP;

			// metallic component
			mask *= intersec.color;

			if (rng() > 0.8)
			{
				r = Ray( x, reflect(r.direction, nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			diffuseCount++;

			bounceIsSpecular = false;

			if (diffuseCount == 1 && rng() < 0.5)
                        {
                                // choose random Diffuse sample vector
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
                        }

			dirToLight = sampleQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += nl * uEPS_intersect;

			sampleLight = true;
			continue;

                } //end if (intersec.type == CARCOAT)


		if (intersec.type == TRANSLUCENT)  // Translucent Sub-Surface Scattering material
		{
			previousIntersecType = DIFF;

			thickness = 0.25;
			scatteringDistance = -log(rng()) / thickness;
			absorptionCoefficient = clamp(vec3(1) - intersec.color, 0.0, 1.0);

			// transmission?
			if (t < scatteringDistance)
			{
				mask *= exp(-absorptionCoefficient * t);

				r = Ray(x, normalize(r.direction));
				r.origin += r.direction * scatteringDistance;

				continue;
			}

			// else scattering
			mask *= exp(-absorptionCoefficient * scatteringDistance);

			diffuseCount++;

			bounceIsSpecular = false;

			if (diffuseCount == 1 && rng() < 0.5)
                        {
                                // choose random Diffuse sample vector
				//r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r = Ray( x, randomSphereDirection() );
				r.origin += r.direction * scatteringDistance;
				continue;
                        }

			dirToLight = sampleQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += r.direction * scatteringDistance;

			sampleLight = true;
			continue;

		} // end if (intersec.type == TRANSLUCENT)


                if (intersec.type == SPECSUB)  // Shiny(specular) coating over Sub-Surface Scattering material
		{
			previousIntersecType = COAT;

			nc = 1.0; // IOR of Air
			nt = 1.3; // IOR of clear coating (for polished jade)
			Re = calcFresnelReflectance(r.direction, n, nc, nt, ratioIoR);
			Tr = 1.0 - Re;
			P  = 0.25 + (0.5 * Re);
                	RP = Re / P;
                	TP = Tr / (1.0 - P);


			if (rng() < P)
			{
				mask *= RP;
				r = Ray( x, reflect(r.direction, nl) ); // reflect ray from surface
				r.origin += nl * uEPS_intersect;
				continue;
			}

			mask *= TP;

			thickness = 0.1;
			scatteringDistance = -log(rng()) / thickness;
			absorptionCoefficient = clamp(vec3(1) - intersec.color, 0.0, 1.0);

			// transmission?
			if (t < scatteringDistance)
			{
				mask *= exp(-absorptionCoefficient * t);

				r = Ray(x, normalize(r.direction));
				r.origin += r.direction * scatteringDistance;

				continue;
			}

			diffuseCount++;

			bounceIsSpecular = false;

			// else scattering
			mask *= exp(-absorptionCoefficient * scatteringDistance);

			if (rng() < 0.5)
			{
                                // choose random scattering direction vector
				r = Ray( x, randomSphereDirection() );
				r.origin += r.direction * scatteringDistance;
				continue;
                        }

			dirToLight = sampleQuadLight(x, nl, quads[5], weight);
			mask *= weight;

			r = Ray( x, dirToLight );
			r.origin += r.direction * scatteringDistance;

			sampleLight = true;
			continue;

		} // end if (intersec.type == SPECSUB)

	} // end for (int bounces = 0; bounces < 6; bounces++)


	return max(vec3(0), accumCol);

} // end vec3 CalculateRadiance(Ray r)


//-----------------------------------------------------------------------
void SetupScene(void)
//-----------------------------------------------------------------------
{
	vec3 z  = vec3(0);// No color value, Black
	vec3 L1 = vec3(1.0, 1.0, 1.0) * 10.0;// Bright light

	spheres[0] = Sphere( 90.0, vec3(150.0,  91.0, -200.0),  z, vec3(1), COAT ); // Sphere Left
	spheres[1] = Sphere( 90.0, vec3(400.0,  91.0, -200.0),  z, vec3(1), REFR ); // Sphere Right

	quads[0] = Quad( vec3( 0.0, 0.0, 1.0), vec3(  0.0,   0.0,-559.2), vec3(549.6,   0.0,-559.2), vec3(549.6, 548.8,-559.2), vec3(  0.0, 548.8,-559.2), z, vec3( 1.0,  1.0,  1.0), DIFF);// Back Wall
	quads[1] = Quad( vec3( 1.0, 0.0, 0.0), vec3(  0.0,   0.0,   0.0), vec3(  0.0,   0.0,-559.2), vec3(  0.0, 548.8,-559.2), vec3(  0.0, 548.8,   0.0), z, vec3( 0.7, 0.05, 0.05), DIFF);// Left Wall Red
	quads[2] = Quad( vec3(-1.0, 0.0, 0.0), vec3(549.6,   0.0,-559.2), vec3(549.6,   0.0,   0.0), vec3(549.6, 548.8,   0.0), vec3(549.6, 548.8,-559.2), z, vec3(0.05, 0.05, 0.7 ), DIFF);// Right Wall Blue
	quads[3] = Quad( vec3( 0.0,-1.0, 0.0), vec3(  0.0, 548.8,-559.2), vec3(549.6, 548.8,-559.2), vec3(549.6, 548.8,   0.0), vec3(  0.0, 548.8,   0.0), z, vec3( 1.0,  1.0,  1.0), DIFF);// Ceiling
	quads[4] = Quad( vec3( 0.0, 1.0, 0.0), vec3(  0.0,   0.0,   0.0), vec3(549.6,   0.0,   0.0), vec3(549.6,   0.0,-559.2), vec3(  0.0,   0.0,-559.2), z, vec3( 1.0,  1.0,  1.0), DIFF);// Floor

	quads[5] = Quad( vec3( 0.0,-1.0, 0.0), vec3(213.0, 548.0,-332.0), vec3(343.0, 548.0,-332.0), vec3(343.0, 548.0,-227.0), vec3(213.0, 548.0,-227.0), L1, z, LIGHT);// Area Light Rectangle in ceiling
}



// Final Pixel Color
out vec4 glFragColor;


void main(void)
{
        // vec2 texelSize = vec2(1.0 / uResolution.x, 1.0 / uResolution.y);
        vec3 camRight       = vec3( uCameraMatrix[0][0],  uCameraMatrix[0][1],  uCameraMatrix[0][2]);
	vec3 camUp          = vec3( uCameraMatrix[1][0],  uCameraMatrix[1][1],  uCameraMatrix[1][2]);
	vec3 camForward     = vec3(-uCameraMatrix[2][0], -uCameraMatrix[2][1], -uCameraMatrix[2][2]);
	vec3 cameraPosition = vec3( uCameraMatrix[3][0],  uCameraMatrix[3][1],  uCameraMatrix[3][2]);

	// calculate unique seed for rng() function
	seed = uvec2(uFrameCounter, uFrameCounter + 1.0) * uvec2(gl_FragCoord);

	//vec2 pixelOffset = vec2(0);
	vec2 pixelOffset = vec2( tentFilter(rng()), tentFilter(rng()) );

	// we must map pixelPos into the range -1.0 to +1.0
	vec2 pixelPos = ((gl_FragCoord.xy + pixelOffset) / uResolution) * 2.0 - 1.0;

	vec3 rayDir = normalize( pixelPos.x * camRight * uULen + pixelPos.y * camUp * uVLen + camForward );

	// depth of field
	vec3 focalPoint = uFocusDistance * rayDir;
	float randomAngle = rng() * TWO_PI; // pick random point on aperture
	float randomRadius = rng() * uApertureSize;
	vec3  randomAperturePos = ( cos(randomAngle) * camRight + sin(randomAngle) * camUp ) * sqrt(randomRadius);
	// point on aperture to focal point
	vec3 finalRayDir = normalize(focalPoint - randomAperturePos);

	Ray ray = Ray( cameraPosition + randomAperturePos , finalRayDir );

	SetupScene();

	// Note: Edge Detection is not functional yet - TODO: add it back in now that everything is setup and working properly inside Babylon.js
	// Edge Detection - don't want to blur edges where either surface normals change abruptly (i.e. room wall corners), objects overlap each other (i.e. edge of a foreground sphere in front of another sphere right behind it),
	// or an abrupt color variation on the same smooth surface, even if it has similar surface normals (i.e. checkerboard pattern). Want to keep all of these cases as sharp as possible - no blur filter will be applied.
	vec3 objectNormal, objectColor;
	float objectID = -INFINITY;
	float pixelSharpness = 0.0;

	// perform path tracing and get resulting pixel color
	vec4 currentPixel = vec4( vec3(CalculateRadiance(ray, objectNormal, objectColor, objectID, pixelSharpness)), 0.0 );

	vec4 previousPixel = texelFetch(previousBuffer, ivec2(gl_FragCoord.xy), 0);

	if (uFrameCounter == 1.0) // camera just moved after being still
	{
		previousPixel = vec4(0); // clear rendering accumulation buffer
	}
	else if (uCameraIsMoving)
	{
		previousPixel.rgb *= 0.5;
		currentPixel.rgb *= 0.5;
	}
	
	glFragColor = vec4(previousPixel.rgb + currentPixel.rgb, 1.0);
}
`;

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

RealtimeRT.createScene = function (engine, canvas) {

	let width = engine.getRenderWidth(), height = engine.getRenderHeight();

	function onKeyDown(event) {
		event.preventDefault();

		KeyboardState[KEYCODE_NAMES[event.keyCode]] = true;
	}

	function onKeyUp(event) {
		event.preventDefault();

		KeyboardState[KEYCODE_NAMES[event.keyCode]] = false;
	}

	function keyPressed(keyName) {
		return KeyboardState[keyName];
	}

	function onMouseWheel(event) {
		// if (isPaused)
		// 	return;

		// use the following instead, because event.preventDefault() gives errors in console
		event.stopPropagation();

		if (event.deltaY > 0) {
			increaseFOV = true;
		}
		else if (event.deltaY < 0) {
			decreaseFOV = true;
		}
	}

	function getElapsedTimeInSeconds() {
		timeInSeconds += (engine.getDeltaTime() * 0.001);
		return timeInSeconds;
	}


	// if ('ontouchstart' in window) {
	// 	mouseControl = false;
	// 	// TODO: instantiate my custom 'MobileJoystickControls' or similar Babylon solution?
	// }

	// if (mouseControl) {
	// 	window.addEventListener('wheel', onMouseWheel, false);
	// }

	// SCENE/DEMO-SPECIFIC PARAMETERS
	camFlightSpeed = 300; // scene specific, depending on scene size dimensions
	uApertureSize = 0.0; // aperture size at beginning of app
	uFocusDistance = 530.0; // initial focus distance from camera in scene - scene specific, depending on scene size dimensions
	const uEPS_intersect = mouseControl ? 0.01 : 1.0; // less precision on mobile - also both values are scene-size dependent
	apertureChangeAmount = 20; // scene specific, depending on scene size dimensions
	focusDistChangeAmount = 5; // scene specific, depending on scene size dimensions


	// scale image by 2, which is half the work for GPU to do (BABYLON later calculates: 1/scalingLevel = amount of GPU task)
	// so 1/scalingLevel, or 1/(2) = 0.5 GPU task - this helps most GPUs to maintain 30-60 FPS
	engine.setHardwareScalingLevel(2); // default scalingLevel is 1. You can try scalingLevel of 1 if you have a powerful GPU that can keep 60 FPS


	// Create the scene space
	pathTracingScene = new BABYLON.Scene(engine);
	// coming from THREE.js, I'm more comfortable with a Right-handed coordinate system, so...
	//  +X:(1,0,0) pointing to the right, +Y:(0,1,0) pointing up, and +Z:(0,0,1) pointing out of the screen towards you
	pathTracingScene.useRightHandedSystem = true;

	// enable browser's mouse pointer lock feature, for free-look camera controlled by mouse movement
	pathTracingScene.onPointerDown = evt => {
		engine.enterPointerlock();
	}

	// Add a camera to the scene and attach it to the canvas
	camera = new BABYLON.UniversalCamera("Camera", new BABYLON.Vector3(278, 170, 350), pathTracingScene);
	// I'm not sure why, but this next line is necessary because the camera was facing away from my path traced scene.  Maybe because of the handedness change above?
	camera.rotation.y += Math.PI;
	oldCameraMatrix = new BABYLON.Matrix;
	newCameraMatrix = new BABYLON.Matrix;
	camera.attachControl(canvas, true);


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

	screenCopy_eWrapper.onApplyObservable.add(() => {
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

	screenOutput_eWrapper.onApplyObservable.add(() => {
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

	pathTracing_eWrapper.onApplyObservable.add(() => {
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

	// Register a render loop to repeatedly render the scene
	engine.runRenderLoop(function () {
		if (isPaused && engine.isPointerLock) {
			document.addEventListener('keydown', onKeyDown, false);
			document.addEventListener('keyup', onKeyUp, false);
			isPaused = false;
		}
		if (!isPaused && !engine.isPointerLock) {
			document.removeEventListener('keydown', onKeyDown, false);
			document.removeEventListener('keyup', onKeyUp, false);
			isPaused = true;
		}

		// reset cameraIsMoving flag
		uCameraIsMoving = false;

		if (windowIsBeingResized) {
			uCameraIsMoving = true;
			windowIsBeingResized = false;
		}

		uTime = getElapsedTimeInSeconds();

		frameTime = engine.getDeltaTime() * 0.001;

		// my own optimized way of telling if the camera has moved or not
		newCameraMatrix.copyFrom(camera.getWorldMatrix());
		nm = newCameraMatrix.m;
		om = oldCameraMatrix.m;
		if (nm[0] != om[0] || nm[1] != om[1] || nm[2] != om[2] || nm[3] != om[3] ||
			nm[4] != om[4] || nm[5] != om[5] || nm[6] != om[6] || nm[7] != om[7] ||
			nm[8] != om[8] || nm[9] != om[9] || nm[10] != om[10] || nm[11] != om[11] ||
			nm[12] != om[12] || nm[13] != om[13] || nm[14] != om[14] || nm[15] != om[15]) {
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
		if (keyPressed('w') && !keyPressed('s')) {
			camera.position.addInPlace(cameraDirectionVector.scaleToRef(camFlightSpeed * frameTime, cameraDirectionVector));
		}
		if (keyPressed('s') && !keyPressed('w')) {
			camera.position.subtractInPlace(cameraDirectionVector.scaleToRef(camFlightSpeed * frameTime, cameraDirectionVector));
		}
		if (keyPressed('a') && !keyPressed('d')) {
			camera.position.subtractInPlace(cameraRightVector.scaleToRef(camFlightSpeed * frameTime, cameraRightVector));
		}
		if (keyPressed('d') && !keyPressed('a')) {
			camera.position.addInPlace(cameraRightVector.scaleToRef(camFlightSpeed * frameTime, cameraRightVector));
		}
		if (keyPressed('e') && !keyPressed('q')) {
			camera.position.addInPlace(cameraUpVector.scaleToRef(camFlightSpeed * frameTime, cameraUpVector));
		}
		if (keyPressed('q') && !keyPressed('e')) {
			camera.position.subtractInPlace(cameraUpVector.scaleToRef(camFlightSpeed * frameTime, cameraUpVector));
		}

		if (keyPressed('equals') && !keyPressed('dash')) {
			increaseFocusDist = true;
		}
		if (keyPressed('dash') && !keyPressed('equals')) {
			decreaseFocusDist = true;
		}
		if (keyPressed('period') && !keyPressed('comma')) {
			increaseAperture = true;
		}
		if (keyPressed('comma') && !keyPressed('period')) {
			decreaseAperture = true;
		}

		// now update uniforms that are common to all scenes
		if (increaseFOV) {
			camera.fov += (Math.PI / 180);
			if (camera.fov > 150 * (Math.PI / 180))
				camera.fov = 150 * (Math.PI / 180);

			uVLen = Math.tan(camera.fov * 0.5);
			uULen = uVLen * (width / height);

			uCameraIsMoving = true;
			increaseFOV = false;
		}
		if (decreaseFOV) {
			camera.fov -= (Math.PI / 180);
			if (camera.fov < 1 * (Math.PI / 180))
				camera.fov = 1 * (Math.PI / 180);

			uVLen = Math.tan(camera.fov * 0.5);
			uULen = uVLen * (width / height);

			uCameraIsMoving = true;
			decreaseFOV = false;
		}

		if (increaseFocusDist) {
			uFocusDistance += focusDistChangeAmount;

			uCameraIsMoving = true;
			increaseFocusDist = false;
		}
		if (decreaseFocusDist) {
			uFocusDistance -= focusDistChangeAmount;
			if (uFocusDistance < 1)
				uFocusDistance = 1;

			uCameraIsMoving = true;
			decreaseFocusDist = false;
		}

		if (increaseAperture) {
			uApertureSize += apertureChangeAmount;
			if (uApertureSize > 100000.0)
				uApertureSize = 100000.0;

			uCameraIsMoving = true;
			increaseAperture = false;
		}
		if (decreaseAperture) {
			uApertureSize -= apertureChangeAmount;
			if (uApertureSize < 0.0)
				uApertureSize = 0.0;

			uCameraIsMoving = true;
			decreaseAperture = false;
		}

		if (!uCameraIsMoving) {
			if (sceneIsDynamic)
				uSampleCounter = 1.0; // reset for continuous updating of image
			else uSampleCounter += 1.0; // for progressive refinement of image

			uFrameCounter += 1.0;

			cameraRecentlyMoving = false;
		}

		if (uCameraIsMoving) {
			uSampleCounter = 1.0;
			uFrameCounter += 1.0;

			if (!cameraRecentlyMoving) {
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
	const fnRsize = function () {
		console.log("handling resize event");
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

	this.pathTracingScene = pathTracingScene;
	this.handleOnResize = fnRsize;
};

