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
in vec2 vUV;

// Samplers
uniform sampler2D textureSampler;

// common Uniforms, will eventually be placed in BABYLON.Effect.ShadersStore[]
uniform mat4 uCameraMatrix;
uniform vec2 uResolution;
uniform float uULen;
uniform float uVLen;
uniform float uTime;
uniform float uFrameCounter;
uniform float uEPS_intersect;

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

	// temp, TODO hook up with uniforms
	float uApertureSize = 0.0;
	float uFocusDistance = 100.0;

	// depth of field
	vec3 focalPoint = uFocusDistance * rayDir;
	float randomAngle = rng() * TWO_PI; // pick random point on aperture
	float randomRadius = rng() * uApertureSize;
	vec3  randomAperturePos = ( cos(randomAngle) * camRight + sin(randomAngle) * camUp ) * sqrt(randomRadius);
	// point on aperture to focal point
	vec3 finalRayDir = normalize(focalPoint - randomAperturePos);
	
	Ray ray = Ray( cameraPosition + randomAperturePos , finalRayDir );

	SetupScene();
	
	// Edge Detection - don't want to blur edges where either surface normals change abruptly (i.e. room wall corners), objects overlap each other (i.e. edge of a foreground sphere in front of another sphere right behind it),
	// or an abrupt color variation on the same smooth surface, even if it has similar surface normals (i.e. checkerboard pattern). Want to keep all of these cases as sharp as possible - no blur filter will be applied.
	vec3 objectNormal, objectColor;
	float objectID = -INFINITY;
	float pixelSharpness = 0.0;
	
	// perform path tracing and get resulting pixel color
	vec4 currentPixel = vec4( vec3(CalculateRadiance(ray, objectNormal, objectColor, objectID, pixelSharpness)), 0.0 );

        glFragColor = vec4(currentPixel.rgb, 1.0);
}