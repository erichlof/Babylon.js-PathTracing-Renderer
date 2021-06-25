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


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_sphere_intersect' ] = `

float UnitSphereIntersect( vec3 ro, vec3 rd, out vec3 n )
{
        vec3 hit;
	float t0, t1;
	float a = dot(rd, rd);
	float b = 2.0 * dot(rd, ro);
	float c = dot(ro, ro) - 1.0; // - (rad * rad) = - (1.0 * 1.0) = - 1.0 
	solveQuadratic(a, b, c, t0, t1);
	if (t0 > 0.0)
        {
                hit = ro + rd * t0;
                n = vec3(2.0 * hit.x, 2.0 * hit.y, 2.0 * hit.z);
                return t0;
        }
        if (t1 > 0.0)
        {
                hit = ro + rd * t1;
                n = vec3(2.0 * hit.x, 2.0 * hit.y, 2.0 * hit.z);
                return t1;
        }
        return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_cylinder_intersect' ] = `

float UnitCylinderIntersect( vec3 ro, vec3 rd, out vec3 n )
{
        vec3 hit;
	float t0, t1;
	float a = (rd.x * rd.x + rd.z * rd.z);
    	float b = 2.0 * (rd.x * ro.x + rd.z * ro.z);
    	float c = (ro.x * ro.x + ro.z * ro.z) - 1.0; 
	solveQuadratic(a, b, c, t0, t1);

        hit = ro + rd * t0;
        if (t0 > 0.0 && abs(hit.y) <= 1.0)
        {
                n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
                return t0;
        }
        hit = ro + rd * t1;
        if (t1 > 0.0 && abs(hit.y) <= 1.0)
        {
                n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
                return t1;
        }
        return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_cone_intersect' ] = `

float UnitConeIntersect( vec3 ro, vec3 rd, float k, out vec3 n )
{
        vec3 hit;
	float t0, t1;
	// valid range for k: 0.01 to 1.0 (1.0 being the default for cone with a sharp, pointed apex)
	k = clamp(k, 0.01, 1.0);
	
	float j = 1.0 / k;
	float h = j * 2.0 - 1.0;		   // (k * 0.25) makes the normal cone's bottom circular base have a unit radius of 1.0
	float a = j * rd.x * rd.x + j * rd.z * rd.z - (k * 0.25) * rd.y * rd.y;
    	float b = 2.0 * (j * rd.x * ro.x + j * rd.z * ro.z - (k * 0.25) * rd.y * (ro.y - h));
    	float c = j * ro.x * ro.x + j * ro.z * ro.z - (k * 0.25) * (ro.y - h) * (ro.y - h);
	solveQuadratic(a, b, c, t0, t1);

        hit = ro + rd * t0;
        if (t0 > 0.0 && abs(hit.y) <= 1.0)
        {
                n = vec3(2.0 * hit.x * j, 2.0 * (h - hit.y) * (k * 0.25), 2.0 * hit.z * j);
                return t0;
        }
        hit = ro + rd * t1;
        if (t1 > 0.0 && abs(hit.y) <= 1.0)
        {
                n = vec3(2.0 * hit.x * j, 2.0 * (h - hit.y) * (k * 0.25), 2.0 * hit.z * j);
                return t1;
        }
        return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_paraboloid_intersect' ] = `

float UnitParaboloidIntersect( vec3 ro, vec3 rd, out vec3 n )
{
        vec3 hit;
	float t0, t1;
	float k = 0.5;
	float a = rd.x * rd.x + rd.z * rd.z;
    	float b = 2.0 * (rd.x * ro.x + rd.z * ro.z) + k * rd.y;
    	float c = ro.x * ro.x + ro.z * ro.z + k * (ro.y - 1.0); 
	solveQuadratic(a, b, c, t0, t1);

        hit = ro + rd * t0;
        if (t0 > 0.0 && abs(hit.y) <= 1.0)
        { 
                n = vec3(2.0 * hit.x, 0.5, 2.0 * hit.z);
                return t0;
        }
        hit = ro + rd * t1;
        if (t1 > 0.0 && abs(hit.y) <= 1.0)
        { 
                n = vec3(2.0 * hit.x, 0.5, 2.0 * hit.z);
                return t1;
        }
        return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_hyperboloid_intersect' ] = `

float UnitHyperboloidIntersect( vec3 ro, vec3 rd, float k, out vec3 n )
{
        vec3 hit;
	float t0, t1;
        // k initially comes in as a value between 0.01 and 1.0
        k = k * k * k * k + 0.0012;
        k *= 1000.0; // conservative range of k for the hyperboloid: 0.001 to 1000
	float j = k - 1.0;
	float a = k * rd.x * rd.x + k * rd.z * rd.z - j * rd.y * rd.y;
	float b = 2.0 * (k * rd.x * ro.x + k * rd.z * ro.z - j * rd.y * ro.y);
	float c = (k * ro.x * ro.x + k * ro.z * ro.z - j * ro.y * ro.y) - 1.0;
	solveQuadratic(a, b, c, t0, t1);

        hit = ro + rd * t0;
        if (t0 > 0.0 && abs(hit.y) <= 1.0)
        {
                n = vec3(2.0 * hit.x * k, 2.0 * -hit.y * j, 2.0 * hit.z * k);
                return t0;
        }
        hit = ro + rd * t1;
        if (t1 > 0.0 && abs(hit.y) <= 1.0)
        {
                n = vec3(2.0 * hit.x * k, 2.0 * -hit.y * j, 2.0 * hit.z * k);
                return t1;
        }
	return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_capsule_intersect' ] = `

float UnitCapsuleIntersect( vec3 ro, vec3 rd, float k, out vec3 n )
{
        k += 0.25;

        vec3 hit;
	float t, t0, t1;
        float s0t0, s0t1, s1t0, s1t1;
        // first test if any of the first intersections (t0's) of both sphere caps and cylinder are valid - if so, return that t0
        
        // intersect unit-radius sphere cap located at top opening of cylinder
	vec3 s0pos = vec3(0, k, 0);
	vec3 L = ro - s0pos;
	float a = dot(rd, rd);
	float b = 2.0 * dot(rd, L);
	float c = dot(L, L) - 1.0;
	solveQuadratic(a, b, c, s0t0, s0t1);
	hit = ro + rd * s0t0;
        if (s0t0 > 0.0 && hit.y >= k)
        {
                n = vec3(2.0 * hit.x, 2.0 * (hit.y - k), 2.0 * hit.z);
                return s0t0;
        }
        
	// intersect unit-radius sphere cap located at bottom opening of cylinder
	vec3 s1pos = vec3(0, -k, 0);
	L = ro - s1pos;
	a = dot(rd, rd);
	b = 2.0 * dot(rd, L);
	c = dot(L, L) - 1.0;
	solveQuadratic(a, b, c, s1t0, s1t1);
	hit = ro + rd * s1t0;
        if (s1t0 > 0.0 && hit.y <= -k)
        {
                n = vec3(2.0 * hit.x, 2.0 * (hit.y + k), 2.0 * hit.z);
                return s1t0;
        }
        
        // intersect unit cylinder
        a = (rd.x * rd.x + rd.z * rd.z);
    	b = 2.0 * (rd.x * ro.x + rd.z * ro.z);
    	c = (ro.x * ro.x + ro.z * ro.z) - 1.0;
	solveQuadratic(a, b, c, t0, t1);
	hit = ro + rd * t0;
        if (t0 > 0.0 && abs(hit.y) <= k)
        {
                n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
                return t0;
        }

        // lastly, test if any of the 2nd intersections (t1's) of both sphere caps and cylinder are valid - if so, return that t1 
        hit = ro + rd * s0t1;
        if (s0t1 > 0.0 && hit.y >= k)
        {
                n = vec3(2.0 * hit.x, 2.0 * (hit.y - k), 2.0 * hit.z);
                return s0t1;
        }

        hit = ro + rd * s1t1;
        if (s1t1 > 0.0 && hit.y <= -k)
        {
                n = vec3(2.0 * hit.x, 2.0 * (hit.y + k), 2.0 * hit.z);
                return s1t1;
        }

        hit = ro + rd * t1;
        if (t1 > 0.0 && abs(hit.y) <= k)
        {
                n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
                return t1;
        }
        
        return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_box_intersect' ] = `

float UnitBoxIntersect( vec3 ro, vec3 rd, out vec3 n )
{
	vec3 invDir = 1.0 / rd;
	vec3 near = (vec3(-1) - ro) * invDir; // unit radius box: vec3(-1,-1,-1) min corner
	vec3 far  = (vec3( 1) - ro) * invDir; // unit radius box: vec3(+1,+1,+1) max corner
	vec3 tmin = min(near, far);
	vec3 tmax = max(near, far);
	float t0 = max( max(tmin.x, tmin.y), tmin.z);
	float t1 = min( min(tmax.x, tmax.y), tmax.z);

        if (t0 < t1)
        {
                if (t0 > 0.0)
                {
                        n = -sign(rd) * step(tmin.yzx, tmin) * step(tmin.zxy, tmin);
                        return t0;
                }
                if (t1 > 0.0)
                {
                        n = -sign(rd) * step(tmax, tmax.yzx) * step(tmax, tmax.zxy);
                        return t1;
                }
        }

        return INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_pyramid_frustum_intersect' ] = `

float PyramidFrustumIntersect( vec3 ro, vec3 rd, float k, out vec3 n )
{
        float xt0, xt1, zt0, zt1;
        float xt = INFINITY;
        float zt = INFINITY;
        vec3 hit0, hit1, xn, zn;
	// valid range for k: 0.01 to 1.0 (1.0 being the default for cone with a sharp, pointed apex)
	k = clamp(k, 0.01, 1.0);
	
        // first, intersect left and right sides of pyramid/frustum
	float j = 1.0 / k;
	float h = j * 2.0 - 1.0; // (k * 0.25) makes the normal cone's bottom circular base have a unit radius of 1.0
	float a = j * rd.x * rd.x - (k * 0.25) * rd.y * rd.y;
    	float b = 2.0 * (j * rd.x * ro.x - (k * 0.25) * rd.y * (ro.y - h));
    	float c = j * ro.x * ro.x - (k * 0.25) * (ro.y - h) * (ro.y - h);
	solveQuadratic(a, b, c, xt0, xt1);
	hit0 = ro + rd * xt0;
        hit1 = ro + rd * xt1;
        if (xt0 > 0.0 && abs(hit0.x) <= 1.0 && abs(hit0.z) <= 1.0 && hit0.y <= 1.0 && (j * hit0.z * hit0.z - k * 0.25 * (hit0.y - h) * (hit0.y - h)) <= 0.0)
	{
                xt = xt0;
                xn = vec3(2.0 * hit0.x * j, 2.0 * (hit0.y - h) * -(k * 0.25), 0.0);
        }
        else if (xt1 > 0.0 && abs(hit1.x) <= 1.0 && abs(hit1.z) <= 1.0 && hit1.y <= 1.0 && (j * hit1.z * hit1.z - k * 0.25 * (hit1.y - h) * (hit1.y - h)) <= 0.0)
        {
                xt = xt1;
                xn = vec3(2.0 * hit1.x * j, 2.0 * (hit1.y - h) * -(k * 0.25), 0.0);
        }
	
	// now intersect front and back sides of pyramid/frustum
	a = j * rd.z * rd.z - (k * 0.25) * rd.y * rd.y;
    	b = 2.0 * (j * rd.z * ro.z - (k * 0.25) * rd.y * (ro.y - h));
    	c = j * ro.z * ro.z - (k * 0.25) * (ro.y - h) * (ro.y - h);
	solveQuadratic(a, b, c, zt0, zt1);
	hit0 = ro + rd * zt0;
        hit1 = ro + rd * zt1;
        if (zt0 > 0.0 && abs(hit0.x) <= 1.0 && abs(hit0.z) <= 1.0 && hit0.y <= 1.0 && (j * hit0.x * hit0.x - k * 0.25 * (hit0.y - h) * (hit0.y - h)) <= 0.0)
        {
                zt = zt0;
                zn = vec3(0.0, 2.0 * (hit0.y - h) * -(k * 0.25), 2.0 * hit0.z * j);
        }
	else if (zt1 > 0.0 && abs(hit1.x) <= 1.0 && abs(hit1.z) <= 1.0 && hit1.y <= 1.0 && (j * hit1.x * hit1.x - k * 0.25 * (hit1.y - h) * (hit1.y - h)) <= 0.0)
        {
                zt = zt1;
                zn = vec3(0.0, 2.0 * (hit1.y - h) * -(k * 0.25), 2.0 * hit1.z * j);
        }
	
        if (xt <= zt)
        {
                n = xn;
                return xt;
        }
        else
        {
                n = zn;
                return zt;
        }
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_disk_intersect' ] = `

float UnitDiskIntersect( vec3 ro, vec3 rd )
{
        float t0 = (ro.y + 0.0) / -rd.y;
	vec3 hit = ro + rd * t0;
	return (t0 > 0.0 && hit.x * hit.x + hit.z * hit.z <= 1.0) ? t0 : INFINITY; // disk with unit radius
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_rectangle_intersect' ] = `

float UnitRectangleIntersect( vec3 ro, vec3 rd )
{
        float t0 = (ro.y + 0.0) / -rd.y;
	vec3 hit = ro + rd * t0;
	return (t0 > 0.0 && abs(hit.x) <= 1.0 && abs(hit.z) <= 1.0) ? t0 : INFINITY; // rectangle with unit radius
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_torus_intersect' ] = `

// Thanks to koiava for the ray marching strategy! https://www.shadertoy.com/user/koiava

float map_Torus( in vec3 pos, float k )
{
	return length( vec2(length(pos.xz) - (1.0-k), pos.y) ) - k;
}

float UnitTorusIntersect( vec3 ro, vec3 rd, float k, out vec3 n )
{	
        // unit torus - outer radius is always 1.0 (in torus object space)
        // k represents the inner radius, conservative range: 
        //    0.01 (thickest torus, inner radius is almost at center (0.01) while outer radius is way out at 1.0)...
        // to 0.99 (very thin torus, inner radius (0.99) is right next to outer radius which is at 1.0)
        k = 1.0 - clamp(k, 0.01, 0.99);

        float d = INFINITY;
	vec3 hit;

        float tc, t0, t1;
	float a = (rd.x * rd.x + rd.z * rd.z);
    	float b = 2.0 * (rd.x * ro.x + rd.z * ro.z);
    	float c = (ro.x * ro.x + ro.z * ro.z) - 1.0; 
	solveQuadratic(a, b, c, t0, t1);
        vec3 hit0 = ro + rd * t0;
        vec3 hit1 = ro + rd * t1;
	tc = (t0 > 0.0 && abs(hit0.y) <= k) ? t0 : (t1 > 0.0 && abs(hit1.y) <= k) ? t1 : INFINITY;

        float d0 = (ro.y + k) / -rd.y;
	hit = ro + rd * d0;
	d0 = (d0 > 0.0 && hit.x * hit.x + hit.z * hit.z <= 1.0) ? d0 : INFINITY; // disk with unit radius
	float d1 = (ro.y - k) / -rd.y;
	hit = ro + rd * d1;
	d1 = (d1 > 0.0 && hit.x * hit.x + hit.z * hit.z <= 1.0) ? d1 : INFINITY; // disk with unit radius
	
        if (tc == INFINITY && d0 == INFINITY && d1 == INFINITY)
                return INFINITY;

	vec3 pos;
	float t = min(min(d0, d1), tc);
        
	for (int i = 0; i < 500; i++)
	{
                pos = ro + rd * t;
		d = map_Torus(pos, k);
		if (abs(d) < 0.01) break;
		t += d;
	}
	
        if (abs(d) < 0.01)
        {
                vec2 e = vec2(1.0,-1.0)*0.5773*0.0002;
                n  = normalize( e.xyy*map_Torus( pos + e.xyy, k ) + 
                                e.yyx*map_Torus( pos + e.yyx, k ) + 
                                e.yxy*map_Torus( pos + e.yxy, k ) + 
                                e.xxx*map_Torus( pos + e.xxx, k ) );
                return t;
        }
        return INFINITY;
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
	
	currentPixel.a = 0.0;
	
	if (colorDifference >= 1.0 || normalDifference >= 1.0 || objectDifference >= 1.0)
		pixelSharpness = 1.01;

	
	// Eventually, all edge-containing pixels' .a (alpha channel) values will converge to 1.01, which keeps them from getting blurred by the box-blur filter, thus retaining sharpness.
	if (pixelSharpness == 1.01)
		currentPixel.a = 1.01;
	if (pixelSharpness == -1.0)
		currentPixel.a = -1.0;

	if (previousPixel.a == 1.01)
		currentPixel.a = 1.01;

	if (previousPixel.a == -1.0)
		currentPixel.a = 0.0;
	
	glFragColor = vec4(previousPixel.rgb + currentPixel.rgb, currentPixel.a);
}

`;
