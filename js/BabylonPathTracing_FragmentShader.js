BABYLON.Effect.ShadersStore["pathTracingFragmentShader"] = `
#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

// Demo-specific Uniforms
uniform mat4 uLeftSphereInvMatrix;
uniform mat4 uRightSphereInvMatrix;
uniform float uQuadLightPlaneSelectionNumber;
uniform float uQuadLightRadius;
uniform int uRightSphereMatType;

// demo/scene-specific setup
#define N_QUADS 6
#define N_SPHERES 2

struct Ray { vec3 origin; vec3 direction; };
struct UnitSphere { vec3 color; int type; };
struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 color; int type; };
struct Intersection { float t; vec3 normal; vec3 color; int type; float objectID; };

Quad quads[N_QUADS];
UnitSphere spheres[N_SPHERES];

// all required includes go here:

#include<pathtracing_defines_and_uniforms> // required on all scenes

#include<pathtracing_random> // required on all scenes

#include<pathtracing_calc_fresnel> // required on all scenes

#include<pathtracing_solve_quadratic> // required on scenes with any math-geometry shapes like sphere, cylinder, cone, etc.

#include<pathtracing_unit_sphere_intersect> // required on scenes with unit spheres that will be translated, rotated, and scaled by their matrix transform

#include<pathtracing_quad_intersect> // required on scenes with quads (actually internally they are made up of 2 triangles)

#include<pathtracing_sample_axis_aligned_quad_light> // required on scenes with axis-aligned quad area lights (quad must reside in either XY, XZ, or YZ planes) 


//-----------------------------------------------------------
void SceneIntersect( Ray r, out Intersection intersection )
//-----------------------------------------------------------
{
	vec3 hit;
	float d;
	int objectCount = 0;
	// initialize intersection fields
	intersection.t = INFINITY;
	intersection.type = -100;
	intersection.objectID = -INFINITY;
	Ray rObj;

        // transform ray into Left Sphere's object space
	rObj.origin = vec3( uLeftSphereInvMatrix * vec4(r.origin, 1.0) );
	rObj.direction = vec3( uLeftSphereInvMatrix * vec4(r.direction, 0.0) );

	d = UnitSphereIntersect( rObj.origin, rObj.direction );

	if (d < intersection.t)
	{
		intersection.t = d;
		hit = rObj.origin + rObj.direction * intersection.t;
		intersection.normal = normalize(vec3(2.0 * hit.x, 2.0 * hit.y, 2.0 * hit.z));
		intersection.normal = normalize(transpose(mat3(uLeftSphereInvMatrix)) * intersection.normal);
		intersection.color = spheres[0].color;
		intersection.type = spheres[0].type;
		intersection.objectID = float(objectCount);
	}
	objectCount++;

	// transform ray into Right Sphere's object space
	rObj.origin = vec3( uRightSphereInvMatrix * vec4(r.origin, 1.0) );
	rObj.direction = vec3( uRightSphereInvMatrix * vec4(r.direction, 0.0) );

	d = UnitSphereIntersect( rObj.origin, rObj.direction );

	if (d < intersection.t)
	{
		intersection.t = d;
		hit = rObj.origin + rObj.direction * intersection.t;
		intersection.normal = normalize(vec3(2.0 * hit.x, 2.0 * hit.y, 2.0 * hit.z));
		intersection.normal = normalize(transpose(mat3(uRightSphereInvMatrix)) * intersection.normal);
		intersection.color = spheres[1].color;
		intersection.type = spheres[1].type;
		intersection.objectID = float(objectCount);
	}
	objectCount++;
        


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


		if (intersection.t == INFINITY)
			break;

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
			Re = calcFresnelReflectance(r.direction, nl, nc, nt, ratioIoR);
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

			// this check helps keep random noisy bright pixels from this clearCoat diffuse surface out of the possible previous refracted glass surface
			if (bounces < 3) 
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

	float wallRadius = 50.0;
	float lightRadius = uQuadLightRadius * 0.2;

	spheres[0] = UnitSphere( vec3(1.0, 1.0, 0.0), CLEARCOAT_DIFFUSE ); // clearCoat diffuse Sphere Left
	spheres[1] = UnitSphere( vec3(1.0, 1.0, 1.0), uRightSphereMatType ); // user-chosen material Sphere Right
 
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
