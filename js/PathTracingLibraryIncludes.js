BABYLON.Effect.IncludesShadersStore['pathtracing_defines_and_uniforms'] = `

// common Defines for all scenes
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
#define DIFFUSE 1
#define TRANSPARENT 2
#define METAL 3
#define CLEARCOAT_DIFFUSE 4
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

// Samplers
uniform sampler2D previousBuffer;
uniform sampler2D blueNoiseTexture;

// common Uniforms for all scenes
uniform mat4 uCameraMatrix;
uniform vec2 uResolution;
uniform vec2 uRandomVec2;
uniform float uULen;
uniform float uVLen;
uniform float uTime;
uniform float uFrameCounter;
uniform float uSampleCounter;
uniform float uEPS_intersect;
uniform float uApertureSize;
uniform float uFocusDistance;
uniform float uColorEdgeSharpeningRate;
uniform float uNormalEdgeSharpeningRate;
uniform float uObjectEdgeSharpeningRate;
uniform bool uCameraIsMoving;

`;



BABYLON.Effect.IncludesShadersStore['pathtracing_random'] = `
// the following random/filter functions are required for all scenes

// globals used in blueNoise_rand() function
vec4 randVec4; // samples and holds the RGBA blueNoise texture value for this pixel
float randNumber; // the final randomly generated number (range: 0.0 to 1.0)
float counter; // will get incremented by 1 on each call to blueNoise_rand()
int channel; // the final selected color channel to use for blueNoise_rand() calc (range: 0 to 3, corresponds to R,G,B, or A)
float blueNoise_rand()
{
	counter++; // increment counter by 1 on every call to blueNoise_rand()
	// cycles through channels, if modulus is 1.0, channel will always be 0 (only samples the R color channel of the blueNoiseTexture)
	channel = int(mod(counter, 2.0)); // if modulus is 2.0, channel will cycle through 0,1,0,1,etc (only samples the R and G color channels of the blueNoiseTexture)
	// if modulus was 4.0, channel will cycle through all available channels: 0,1,2,3,0,1,2,3,etc (samples all R,G,B,and A color chanels of the blueNoiseTexture)
	
	randNumber = randVec4[channel]; // get value stored in previously selected channel 0:R, 1:G, 2:B, or 3:A
	return fract(randNumber); // we're only interested in randNumber's fractional value between 0.0 (inclusive) and 1.0 (non-inclusive)
}

uvec2 seed; // global seed used in rng() function
// rng() from iq https://www.shadertoy.com/view/4tXyWN
float rng()
{
	seed += uvec2(1);
    	uvec2 q = 1103515245U * ( (seed >> 1U) ^ (seed.yx) );
    	uint  n = 1103515245U * ( (q.x) ^ (q.y >> 3U) );
	return float(n) * (1.0 / float(0xffffffffU));
}

vec3 randomSphereDirection() // useful for subsurface ray scattering
{
    	float up = rng() * 2.0 - 1.0; // range: -1 to +1
	float over = sqrt( max(0.0, 1.0 - up * up) );
	float around = rng() * TWO_PI;
	return normalize(vec3(cos(around) * over, up, sin(around) * over));	
}

vec3 randomCosWeightedDirectionInHemisphere(vec3 nl) // required for all diffuse/coat surfaces
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

vec3 randomDirectionInSpecularLobe(vec3 reflectionDir, float roughness) // for metal/dielectric specular surfaces with roughness
{
	roughness = clamp(roughness, 0.0, 1.0);
	float exponent = mix(7.0, 0.0, sqrt(roughness));
	float cosTheta = pow(rng(), 1.0 / (exp(exponent) + 1.0));
	float sinTheta = sqrt(max(0.0, 1.0 - cosTheta * cosTheta));
	float phi = rng() * TWO_PI;
	
	vec3 U = normalize( cross(vec3(0.7071067811865475, 0.7071067811865475, 0), reflectionDir ) );
	vec3 V = cross(reflectionDir, U);
	return normalize(mix(reflectionDir, (U * cos(phi) * sinTheta + V * sin(phi) * sinTheta + reflectionDir * cosTheta), roughness));
}

// tentFilter from Peter Shirley's 'Realistic Ray Tracing (2nd Edition)' book, pg. 60
float tentFilter(float x) // graph looks like a tent, or roof shape ( ^ ), with more samples taken as we approach the center
{
	return (x < 0.5) ? sqrt(2.0 * x) - 1.0 : 1.0 - sqrt(2.0 - (2.0 * x));
}

`;


BABYLON.Effect.IncludesShadersStore['pathtracing_calc_fresnel'] = `
// required for all transparent(glass, water, etc.) and clearCoat diffuse(pool balls, Lego bricks, etc.) surfaces
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

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_sample_axis_aligned_quad_light' ] = `

vec3 sampleAxisAlignedQuadLight(vec3 x, vec3 nl, Quad light, out float weight) // required for scenes with axis-aligned quad area lights (in the XY, XZ, or YZ planes)
{
	vec3 randPointOnLight;
	randPointOnLight.x = mix(light.v0.x, light.v2.x, clamp(rng(), 0.1, 0.9));
	randPointOnLight.y = mix(light.v0.y, light.v2.y, clamp(rng(), 0.1, 0.9));
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

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_sample_sphere_light' ] = `

vec3 sampleSphereLight(vec3 x, vec3 nl, Sphere light, out float weight) // required for scenes with spherical (or 'close-enough' approximated sphere shape) area lights
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

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_solve_quadratic' ] = `

// optimized algorithm for solving quadratic equations developed by Dr. Po-Shen Loh -> https://youtu.be/XKBX0r3J-9Y
// Adapted to root finding (ray t0/t1) for all quadric shapes (sphere, ellipsoid, cylinder, cone, etc.) by Erich Loftis
void solveQuadratic(float A, float B, float C, out float t0, out float t1) // required for scenes with quadric shapes (spheres, cylinders, etc.)
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

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_sphere_intersect' ] = `

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

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_quad_intersect' ] = `

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

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_default_main' ] = `

// Final Pixel Color, required out vec4 by WebGL 2.0
out vec4 glFragColor;

void main(void) // if the scene is static and doesn't have any special requirements, this main() can be used
{

        vec3 camRight       = vec3( uCameraMatrix[0][0],  uCameraMatrix[0][1],  uCameraMatrix[0][2]);
	vec3 camUp          = vec3( uCameraMatrix[1][0],  uCameraMatrix[1][1],  uCameraMatrix[1][2]);
	vec3 camForward     = vec3( uCameraMatrix[2][0],  uCameraMatrix[2][1],  uCameraMatrix[2][2]);
	vec3 cameraPosition = vec3( uCameraMatrix[3][0],  uCameraMatrix[3][1],  uCameraMatrix[3][2]);

	// calculate unique seed for rng() function (a high-quality pseudo-random number generator for the GPU by 'iq' on ShaderToy)
	seed = uvec2(uFrameCounter, uFrameCounter + 1.0) * uvec2(gl_FragCoord);

	// initialize variables for my custom blueNoise_rand() function (alternative to the rng() function mentioned above), which instead samples from the provided RGBA blueNoiseTexture to generate pseudo-random numbers.
	// note: its main use is for diffuse/dielectric surface convergence speed and shadow noise reduction, but it is inferior to iq's rng() function for generating pure non-repeating random numbers between 0.0-1.0 : use at your discretion
	counter = -1.0; // will get incremented by 1 on each call to blueNoise_rand()
	channel = 0; // the final selected color channel to use for blueNoise_rand() calc (range: 0 to 3, corresponds to R,G,B, or A)
	randNumber = 0.0; // the final randomly-generated number (range: 0.0 to 1.0)
	randVec4 = vec4(0); // on each animation frame, it samples and holds the RGBA blueNoise texture value for this pixel 
	randVec4 = texelFetch(blueNoiseTexture, ivec2(mod(gl_FragCoord.xy + floor(uRandomVec2 * 256.0), 256.0)), 0);

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

	// Edge Detection variables - don't want to blur edges where either surface normals change abruptly (i.e. room wall corners), objects overlap each other (i.e. edge of a foreground sphere in front of another sphere right behind it),
	// or an abrupt color variation on the same smooth surface, even if it has similar surface normals (i.e. checkerboard pattern). Want to keep all of these cases as sharp as possible - no blur filter will be applied.
	vec3 objectNormal = vec3(0);
	vec3 objectColor = vec3(0);
	float objectID = -INFINITY;
	float pixelSharpness = 0.0;

	// perform path tracing and get resulting pixel color
	vec4 currentPixel = vec4( vec3(CalculateRadiance(ray, objectNormal, objectColor, objectID, pixelSharpness)), 0.0 );
	// if difference between normals of neighboring pixels is less than the first edge0 threshold, the white edge line effect is considered off (0.0)
	float edge0 = 0.2; // edge0 is the minimum difference required between normals of neighboring pixels to start becoming a white edge line
	// any difference between normals of neighboring pixels that is between edge0 and edge1 smoothly ramps up the white edge line brightness (smoothstep 0.0-1.0)
	float edge1 = 0.6; // once the difference between normals of neighboring pixels is >= this edge1 threshold, the white edge line is considered fully bright (1.0)
	float difference_Nx = fwidth(objectNormal.x);
	float difference_Ny = fwidth(objectNormal.y);
	float difference_Nz = fwidth(objectNormal.z);
	float normalDifference = smoothstep(edge0, edge1, difference_Nx) + smoothstep(edge0, edge1, difference_Ny) + smoothstep(edge0, edge1, difference_Nz);
	edge0 = 0.0;
	edge1 = 0.5;
	float difference_obj = abs(dFdx(objectID)) > 0.0 ? 1.0 : 0.0;
	difference_obj += abs(dFdy(objectID)) > 0.0 ? 1.0 : 0.0;
	float objectDifference = smoothstep(edge0, edge1, difference_obj);
	float difference_col = length(dFdx(objectColor)) > 0.0 ? 1.0 : 0.0;
	difference_col += length(dFdy(objectColor)) > 0.0 ? 1.0 : 0.0;
	float colorDifference = smoothstep(edge0, edge1, difference_col);
	// edge detector (normal and object differences) white-line debug visualization
	//currentPixel.rgb += 1.0 * vec3(max(normalDifference, objectDifference));
	// edge detector (color difference) white-line debug visualization
	//currentPixel.rgb += 1.0 * vec3(colorDifference);
	
	vec4 previousPixel = texelFetch(previousBuffer, ivec2(gl_FragCoord.xy), 0);
	if (uFrameCounter == 1.0) // camera just moved after being still
	{
		previousPixel = vec4(0); // clear rendering accumulation buffer
	}
	else if (uCameraIsMoving) // camera is currently moving
	{
		previousPixel.rgb *= 0.5; // motion-blur trail amount (old image)
		currentPixel.rgb *= 0.5; // brightness of new image (noisy)
		previousPixel.a = 0.0;
	}
	currentPixel.a = pixelSharpness;
	currentPixel.a = colorDifference  >= 1.0 ? min(uSampleCounter * uColorEdgeSharpeningRate , 1.01) : currentPixel.a;
	currentPixel.a = normalDifference >= 1.0 ? min(uSampleCounter * uNormalEdgeSharpeningRate, 1.01) : currentPixel.a;
	currentPixel.a = objectDifference >= 1.0 ? min(uSampleCounter * uObjectEdgeSharpeningRate, 1.01) : currentPixel.a;
	
	// Eventually, all edge-containing pixels' .a (alpha channel) values will converge to 1.01, which keeps them from getting blurred by the box-blur filter, thus retaining sharpness.
	if (pixelSharpness == 1.0 || previousPixel.a == 1.01)
		currentPixel.a = 1.01;
	
	glFragColor = vec4(previousPixel.rgb + currentPixel.rgb, currentPixel.a);
}

`;
