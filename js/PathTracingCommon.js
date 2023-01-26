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

uniform sampler2D accumulationBuffer;
uniform float uSampleCounter;
uniform float uOneOverSampleCounter;
uniform float uPixelEdgeSharpness;
uniform float uEdgeSharpenSpeed;
uniform float uFilterDecaySpeed;
uniform float uToneMappingExposure;
uniform bool uSceneIsDynamic;

out vec4 glFragColor;

// source: https://www.cs.utah.edu/~reinhard/cdrom/
vec3 ReinhardToneMapping(vec3 color) 
{
	color *= uToneMappingExposure;
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

	if (centerPixel.a == -1.0)
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

	} // end if (centerPixel.a == -1.0)


	if ( !uSceneIsDynamic ) // static scene
	{
		// fast progressive convergence from filtered (blurred) pixels to their original sharp center pixel colors  
		if (uSampleCounter > 1.0) // is camera still?
		{
			if (centerPixel.a == 1.01) // 1.01 means pixel is on an edge, must get sharper quickest
				filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, clamp(uSampleCounter * uEdgeSharpenSpeed, 0.0, 1.0));
			else if (centerPixel.a == -1.0) // -1.0 means glass / transparent surfaces, must get sharper fairly quickly
				filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, clamp(uSampleCounter * 0.01, 0.0, 1.0));
			else // else this is a diffuse surface, so we can take our time converging. That way, there will be minimal noise 
				filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, clamp(uSampleCounter * uFilterDecaySpeed, 0.0, 1.0));
		} // else camera is moving
		else if (centerPixel.a == 1.01) // 1.01 means pixel is on an edge, must remain sharper
		{
			filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, 0.5);
		}
	}
	else // scene is dynamic
	{
		if (centerPixel.a == 1.01) // 1.01 means pixel is on an edge, must remain sharper
		{
			filteredPixelColor = mix(filteredPixelColor, centerPixel.rgb, uPixelEdgeSharpness);
		}
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
#define TRUE 1
#define FALSE 0

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
uniform float uPreviousSampleCount;
uniform float uEPS_intersect;
uniform float uApertureSize;
uniform float uFocusDistance;
uniform bool uCameraIsMoving;
`;


BABYLON.Effect.IncludesShadersStore['pathtracing_physical_sky_defines'] = `

#define TURBIDITY 0.5
#define RAYLEIGH_COEFFICIENT 2.0
#define MIE_COEFFICIENT 0.03
#define MIE_DIRECTIONAL_G 0.76
// constants for atmospheric scattering
#define THREE_OVER_SIXTEENPI 0.05968310365946075
#define ONE_OVER_FOURPI 0.07957747154594767
// wavelength of used primaries, according to preetham
#define LAMBDA vec3( 680E-9, 550E-9, 450E-9 )
#define TOTAL_RAYLEIGH vec3( 5.804542996261093E-6, 1.3562911419845635E-5, 3.0265902468824876E-5 )
// mie stuff
// K coefficient for the primaries
#define K vec3(0.686, 0.678, 0.666)
#define MIE_V 4.0
#define MIE_CONST vec3( 1.8399918514433978E14, 2.7798023919660528E14, 4.0790479543861094E14 )
// optical length at zenith for molecules
#define RAYLEIGH_ZENITH_LENGTH 8400.0
#define MIE_ZENITH_LENGTH 1250.0
#define UP_VECTOR vec3(0.0, 1.0, 0.0)
#define SUN_POWER 100.0
// 66 arc seconds -> degrees, and the cosine of that
#define SUN_ANGULAR_DIAMETER_COS 0.9998 //0.9999566769
#define CUTOFF_ANGLE 1.6110731556870734
#define STEEPNESS 1.5

`;



BABYLON.Effect.IncludesShadersStore['pathtracing_physical_sky_functions'] = `

float RayleighPhase(float cosTheta)
{
	return THREE_OVER_SIXTEENPI * (1.0 + (cosTheta * cosTheta));
}

float hgPhase(float cosTheta, float g)
{
	float g2 = g * g;
	float inverse = 1.0 / pow(max(0.0, 1.0 - 2.0 * g * cosTheta + g2), 1.5);
	return ONE_OVER_FOURPI * ((1.0 - g2) * inverse);
}

vec3 totalMie()
{
	float c = (0.2 * TURBIDITY) * 10E-18;
	return 0.434 * c * MIE_CONST;
}

float SunIntensity(float zenithAngleCos)
{
	zenithAngleCos = clamp( zenithAngleCos, -1.0, 1.0 );
	return SUN_POWER * max( 0.0, 1.0 - pow( E, -( ( CUTOFF_ANGLE - acos( zenithAngleCos ) ) / STEEPNESS ) ) );
}

vec3 Get_Sky_Color(vec3 rayDir)
{
	vec3 viewDirection = normalize(rayDir);

	/* most of the following code is borrowed from the three.js shader file: SkyShader.js */
    	// Cosine angles
	float cosViewSunAngle = dot(viewDirection, uSunDirection);
    	float cosSunUpAngle = dot(UP_VECTOR, uSunDirection); // allowed to be negative: + is daytime, - is nighttime
    	float cosUpViewAngle = dot(UP_VECTOR, viewDirection);

	// Get sun intensity based on how high in the sky it is
    	float sunE = SunIntensity(cosSunUpAngle);

	// extinction (absorbtion + out scattering)
	// rayleigh coefficients
    	vec3 rayleighAtX = TOTAL_RAYLEIGH * RAYLEIGH_COEFFICIENT;

	// mie coefficients
	vec3 mieAtX = totalMie() * MIE_COEFFICIENT;

	// optical length
	float zenithAngle = acos( max( 0.0, dot( UP_VECTOR, viewDirection ) ) );
	float inverse = 1.0 / ( cos( zenithAngle ) + 0.15 * pow( 93.885 - ( ( zenithAngle * 180.0 ) / PI ), -1.253 ) );
	float rayleighOpticalLength = RAYLEIGH_ZENITH_LENGTH * inverse;
	float mieOpticalLength = MIE_ZENITH_LENGTH * inverse;
	// combined extinction factor
	vec3 Fex = exp(-(rayleighAtX * rayleighOpticalLength + mieAtX * mieOpticalLength));
	// in scattering
	vec3 betaRTheta = rayleighAtX * RayleighPhase(cosViewSunAngle * 0.5 + 0.5);
	vec3 betaMTheta = mieAtX * hgPhase(cosViewSunAngle, MIE_DIRECTIONAL_G);

	vec3 Lin = pow( sunE * ( ( betaRTheta + betaMTheta ) / ( rayleighAtX + mieAtX ) ) * ( 1.0 - Fex ), vec3( 1.5 ) );
	Lin *= mix( vec3( 1.0 ), pow( sunE * ( ( betaRTheta + betaMTheta ) / ( rayleighAtX + mieAtX ) ) * Fex, vec3( 1.0 / 2.0 ) ), clamp( pow( 1.0 - cosSunUpAngle, 5.0 ), 0.0, 1.0 ) );
	// nightsky
	float theta = acos( viewDirection.y ); // elevation --> y-axis, [-pi/2, pi/2]
	float phi = atan( viewDirection.z, viewDirection.x ); // azimuth --> x-axis [-pi/2, pi/2]
	vec2 uv = vec2( phi, theta ) / vec2( 2.0 * PI, PI ) + vec2( 0.5, 0.0 );
	vec3 L0 = vec3( 0.1 ) * Fex;
	// composition + solar disc
	float sundisk = smoothstep( SUN_ANGULAR_DIAMETER_COS, SUN_ANGULAR_DIAMETER_COS + 0.00002, cosViewSunAngle );
	L0 += ( sunE * 19000.0 * Fex ) * sundisk;
	vec3 texColor = ( Lin + L0 ) * 0.04 + vec3( 0.0, 0.0003, 0.00075 );
	float sunfade = 1.0 - clamp( 1.0 - exp( ( uSunDirection.y / 450000.0 ) ), 0.0, 1.0 );
	vec3 retColor = pow( texColor, vec3( 1.0 / ( 1.2 + ( 1.2 * sunfade ) ) ) );
	return retColor;
}

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

//the following alternative skips the creation of tangent and bi-tangent vectors T and B
vec3 randomCosWeightedDirectionInHemisphere(vec3 nl) // required for all diffuse and clearCoat surfaces
{
	float z = rng() * 2.0 - 1.0;
	float phi = rng() * TWO_PI;
	float r = sqrt(1.0 - z * z);
    	return normalize(nl + vec3(r * cos(phi), r * sin(phi), z));
}

vec3 randomDirectionInSpecularLobe(vec3 reflectionDir, float roughness) // for metal and dielectric specular surfaces with roughness
{
	float z = rng() * 2.0 - 1.0;
	float phi = rng() * TWO_PI;
	float r = sqrt(1.0 - z * z);
    	vec3 cosDiffuseDir = normalize(reflectionDir + vec3(r * cos(phi), r * sin(phi), z));
	return normalize( mix(reflectionDir, cosDiffuseDir, roughness * roughness) );
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
	float r0 = rng();
	float cos_alpha = 1.0 - r0 + r0 * cos_alpha_max;//mix( cos_alpha_max, 1.0, rng() );
	// * 0.75 below ensures shadow rays don't miss smaller sphere lights, due to shader float precision
	float sin_alpha = sqrt(max(0.0, 1.0 - cos_alpha * cos_alpha)) * 0.75; 
	float phi = rng() * TWO_PI;
	dirToLight = normalize(dirToLight);
	
	vec3 U = normalize( cross( abs(dirToLight.y) < 0.9 ? vec3(0, 1, 0) : vec3(0, 0, 1), dirToLight ) );
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

float SphereIntersect( float rad, vec3 pos, vec3 rayOrigin, vec3 rayDirection )
{
	float t0, t1;
	vec3 L = rayOrigin - pos;
	float a = dot(rayDirection, rayDirection );
	float b = 2.0 * dot(rayDirection, L);
	float c = dot(L, L) - (rad * rad);
	solveQuadratic(a, b, c, t0, t1);
	return t0 > 0.0 ? t0 : t1 > 0.0 ? t1 : INFINITY;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_bounding_sphere_intersect' ] = `

float UnitBoundingSphereIntersect( vec3 ro, vec3 rd, out int insideSphere )
{
	float t0, t1;
	float a = dot(rd, rd);
	float b = 2.0 * dot(rd, ro);
	float c = dot(ro, ro) - (1.01 * 1.01); // - (rad * rad) = - (1.0 * 1.0) = - 1.0 
	solveQuadratic(a, b, c, t0, t1);
	if (t0 > 0.0)
	{
		insideSphere = FALSE;
		return t0;
	}
	if (t1 > 0.0)
	{
		insideSphere = TRUE;
		return t1;
	}

	return INFINITY;
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


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_unit_flattened_ring_intersect' ] = `

float UnitFlattenedRingIntersect( vec3 ro, vec3 rd, float k, out vec3 n )
{
	k -= 0.01;
	vec3 hit;
	float t0, t1, c0, c1;

	// intersect unit outer-cylinder
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

	// intersect top unit radius disk (but if intersect point is in area of hole, it's a miss)
	float d0 = (ro.y - 1.0) / -rd.y;
	hit = ro + rd * d0;
	float x2z2 = hit.x * hit.x + hit.z * hit.z;
	if (rd.y < 0.0 && d0 > 0.0 && x2z2 <= 1.0 && x2z2 > k)
	{
		n = vec3(0, 1, 0);
		return d0;
	}
	// intersect bottom unit radius disk (but if intersect point is in area of hole, it's a miss)
	float d1 = (ro.y + 1.0) / -rd.y;
	hit = ro + rd * d1;
	x2z2 = hit.x * hit.x + hit.z * hit.z;
	if (rd.y > 0.0 && d1 > 0.0 && x2z2 <= 1.0 && x2z2 > k)
	{
		n = vec3(0, -1, 0);
		return d1;
	}

	// intersect k-sized radius inner-cylinder
	c = (ro.x * ro.x + ro.z * ro.z) - k;
	solveQuadratic(a, b, c, c0, c1);
	hit = ro + rd * c0;
	if (c0 > 0.0 && abs(hit.y) <= 1.0)
	{
		n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
		return c0;
	}
	// the rear of the k-sized radius inner cylinder
	hit = ro + rd * c1;
	if (c1 > 0.0 && abs(hit.y) <= 1.0)
	{
		n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
		return c1;
	}

	// the rear of the unit radius outer cylinder
	hit = ro + rd * t1;
	if (t1 > 0.0 && abs(hit.y) <= 1.0)
	{
		n = vec3(2.0 * hit.x, 0.0, 2.0 * hit.z);
		return t1;
	}
	// top disk (with hole cut out) from inside
	hit = ro + rd * d0;
	x2z2 = hit.x * hit.x + hit.z * hit.z;
	if (rd.y > 0.0 && d0 > 0.0 && x2z2 <= 1.0 && x2z2 > k)
	{
		n = vec3(0, 1, 0);
		return d0;
	}
	// bottom disk (with hole cut out) from inside
	hit = ro + rd * d1;
	x2z2 = hit.x * hit.x + hit.z * hit.z;
	if (rd.y < 0.0 && d1 > 0.0 && x2z2 <= 1.0 && x2z2 > k)
	{
		n = vec3(0, -1, 0);
		return d1;
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

// The following Torus quartic solver algo/code is from https://www.shadertoy.com/view/ssc3Dn by Shadertoy user 'mla'

float sgn(float x) 
{
	return x < 0.0 ? -1.0 : 1.0; // Return 1.0 for x == 0.0
}

float evalquadratic(float x, float A, float B, float C) 
{
  	return (A * x + B) * x + C;
}

float evalcubic(float x, float A, float B, float C, float D) 
{
  	return ((A * x + B) * x + C) * x + D;
}

// Quadratic solver from Kahan
int quadratic(float A, float B, float C, out vec2 res) 
{
  	float b = -0.5 * B, b2 = b * b;
  	float q = b2 - A * C;
  	if (q < 0.0) return 0;
  	float r = b + sgn(b) * sqrt(q);
  	if (r == 0.0) 
	{
  		res[0] = C / A;
    		res[1] = -res[0];
  	} 
	else 
	{
    		res[0] = C / r;
    		res[1] = r / A;
  	}

  	return 2;
}

// Numerical Recipes algorithm for solving cubic equation
int cubic(float a, float b, float c, float d, out vec3 res) 
{
  	if (a == 0.0) 
  	{
    		return quadratic(b, c, d, res.xy);
  	}
  	if (d == 0.0) 
  	{
    		res.x = 0.0;
    		return 1 + quadratic(a, b, c, res.yz);
  	}
  	float tmp = a; a = b / tmp; b = c / tmp; c = d / tmp;
  	// solve x^3 + ax^2 + bx + c = 0
  	float Q = (a * a - 3.0 * b) / 9.0;
  	float R = (2.0 * a * a * a - 9.0 * a * b + 27.0 * c) / 54.0;
  	float R2 = R * R, Q3 = Q * Q * Q;
  	if (R2 < Q3) 
  	{
    		float X = clamp(R / sqrt(Q3), -1.0, 1.0);
    		float theta = acos(X);
    		float S = sqrt(Q); // Q must be positive since 0 <= R2 < Q3
    		res[0] = -2.0 *S *cos(theta / 3.0) - a / 3.0;
    		res[1] = -2.0 *S *cos((theta + 2.0 * PI) / 3.0) - a / 3.0;
    		res[2] = -2.0 *S *cos((theta + 4.0 * PI) / 3.0) - a / 3.0;
    		return 3;
  	} 
  	else 
  	{
    		float alpha = -sgn(R) * pow(abs(R) + sqrt(R2 - Q3), 0.3333);
    		float beta = alpha == 0.0 ? 0.0 : Q / alpha;
    		res[0] = alpha + beta - a / 3.0;
    		return 1;
  	}
}

/* float qcubic(float B, float C, float D) {
  vec3 roots;
  int nroots = cubic(1.0,B,C,D,roots);
  // Sort into descending order
  if (nroots > 1 && roots.x < roots.y) roots.xy = roots.yx;
  if (nroots > 2) {
    if (roots.y < roots.z) roots.yz = roots.zy;
    if (roots.x < roots.y) roots.xy = roots.yx;
  }
  // And select the largest
  float psi = roots[0];
  psi = max(1e-6,psi);
  // and give a quick polish with Newton-Raphson
  for (int i = 0; i < 3; i++) {
    float delta = evalcubic(psi,1.0,B,C,D)/evalquadratic(psi,3.0,2.0*B,C);
    psi -= delta;
  }
  return psi;
} */

float qcubic(float B, float C, float D) 
{
  	vec3 roots;
  	int nroots = cubic(1.0, B, C, D, roots);
  	// Select the largest
  	float psi = roots[0];
  	if (nroots > 1) psi = max(psi, roots[1]);
  	if (nroots > 2) psi = max(psi, roots[2]);
  
  	// Give a quick polish with Newton-Raphson
  	float delta;
	delta = evalcubic(psi, 1.0, B, C, D) / evalquadratic(psi, 3.0, 2.0 * B, C);
	psi -= delta;
	delta = evalcubic(psi, 1.0, B, C, D) / evalquadratic(psi, 3.0, 2.0 * B, C);
    	psi -= delta;
  
  	return psi;
}

// The Lanczos quartic method
int lquartic(float c1, float c2, float c3, float c4, out vec4 res) 
{
  	float alpha = 0.5 * c1;
  	float A = c2 - alpha * alpha;
  	float B = c3 - alpha * A;
  	float a, b, beta, psi;
  	psi = qcubic(2.0 * A - alpha * alpha, A * A + 2.0 * B * alpha - 4.0 * c4, -B * B);
  	// There _should_ be a root >= 0, but sometimes the cubic
  	// solver misses it (probably a double root around zero).
  	psi = max(0.0, psi);
  	a = sqrt(psi);
  	beta = 0.5 * (A + psi);
  	if (psi <= 0.0) 
  	{
    		b = sqrt(max(beta * beta - c4, 0.0));
  	} 
  	else 
  	{
    		b = 0.5 * a * (alpha - B / psi);
  	}

  	int resn = quadratic(1.0, alpha + a, beta + b, res.xy);
  	vec2 tmp;
  	if (quadratic(1.0, alpha - a, beta - b, tmp) != 0) 
  	{ 
    		res.zw = res.xy;
    		res.xy = tmp;
    		resn += 2;
  	}

  	return resn;
}

// Note: the parameter below is renamed '_E', because Euler's number 'E' is already defined in 'pathtracing_defines_and_uniforms'
int quartic(float A, float B, float C, float D, float _E, out vec4 roots) 
{
    	int nroots = lquartic(B / A, C / A, D / A, _E / A, roots);
  
  	return nroots;
}


float UnitTorusIntersect(vec3 ro, vec3 rd, float k, out vec3 n) 
{
	// Note: the vec3 'rd' might not be normalized to unit length of 1, 
	//  in order to allow for inverse transform of intersecting rays into Torus' object space
	k = mix(0.5, 1.0, k);
	float torus_R = max(0.0, k); // outer extent of the entire torus/ring
	float torus_r = max(0.01, 1.0 - k); // thickness of circular 'tubing' part of torus/ring
	float torusR2 = torus_R * torus_R;
	float torusr2 = torus_r * torus_r;
	
	float U = dot(rd, rd);
	float V = 2.0 * dot(ro, rd);
	float W = dot(ro, ro) - (torusR2 + torusr2);
	// A*t^4 + B*t^3 + C*t^2 + D*t + _E = 0
	float A = U * U;
	float B = 2.0 * U * V;
	float C = V * V + 2.0 * U * W + 4.0 * torusR2 * rd.z * rd.z;
	float D = 2.0 * V * W + 8.0 * torusR2 * ro.z * rd.z;
// Note: the float below is renamed '_E', because Euler's number 'E' is already defined in 'pathtracing_defines_and_uniforms'
	float _E = W * W + 4.0 * torusR2 * (ro.z * ro.z - torusr2);
	

	vec4 res = vec4(0);
	int nr = quartic(A, B, C, D, _E, res);
	if (nr == 0) return INFINITY;
  	// Sort the roots.
  	if (res.x > res.y) res.xy = res.yx; 
  	if (nr > 2) 
	{
    		if (res.y > res.z) res.yz = res.zy; 
    		if (res.x > res.y) res.xy = res.yx;
  	}
	if (nr > 3) 
	{
		if (res.z > res.w) res.zw = res.wz; 
		if (res.y > res.z) res.yz = res.zy; 
		if (res.x > res.y) res.xy = res.yx; 
	}
  
	float t = INFINITY;
	
	t = (res.w > 0.0) ? res.w : t;	
	t = (res.z > 0.0) ? res.z : t;
	t = (res.y > 0.0) ? res.y : t;	
	t = (res.x > 0.0) ? res.x : t;
		
	vec3 pos = ro + t * rd;
	n = pos * (dot(pos, pos) - torusr2 - torusR2 * vec3(1, 1,-1));

	// float kn = sqrt(torusR2 / dot(pos.xy, pos.xy));
	// pos.xy -= kn * pos.xy;
	// n = pos;
	
  	return t;
}

`;


BABYLON.Effect.IncludesShadersStore[ 'pathtracing_quad_intersect' ] = `

float TriangleIntersect( vec3 v0, vec3 v1, vec3 v2, vec3 rayOrigin, vec3 rayDirection, int isDoubleSided )
{
	vec3 edge1 = v1 - v0;
	vec3 edge2 = v2 - v0;
	vec3 pvec = cross(rayDirection, edge2);
	float det = 1.0 / dot(edge1, pvec);
	if (isDoubleSided == FALSE && det < 0.0)
		return INFINITY;
	vec3 tvec = rayOrigin - v0;
	float u = dot(tvec, pvec) * det;
	vec3 qvec = cross(tvec, edge1);
	float v = dot(rayDirection, qvec) * det;
	float t = dot(edge2, qvec) * det;
	return (u < 0.0 || u > 1.0 || v < 0.0 || u + v > 1.0 || t <= 0.0) ? INFINITY : t;
}

float QuadIntersect( vec3 v0, vec3 v1, vec3 v2, vec3 v3, vec3 rayOrigin, vec3 rayDirection, int isDoubleSided )
{
	return min(TriangleIntersect(v0, v1, v2, rayOrigin, rayDirection, isDoubleSided), TriangleIntersect(v0, v2, v3, rayOrigin, rayDirection, isDoubleSided));
}

`;


BABYLON.Effect.IncludesShadersStore['pathtracing_boundingbox_intersect'] = `

float BoundingBoxIntersect( vec3 minCorner, vec3 maxCorner, vec3 rayOrigin, vec3 invDir )
{
	vec3 near = (minCorner - rayOrigin) * invDir;
	vec3 far  = (maxCorner - rayOrigin) * invDir;

	vec3 tmin = min(near, far);
	vec3 tmax = max(near, far);

	float t0 = max( max(tmin.x, tmin.y), tmin.z);
	float t1 = min( min(tmax.x, tmax.y), tmax.z);

	//return t1 >= max(t0, 0.0) ? t0 : INFINITY;
	return max(t0, 0.0) > t1 ? INFINITY : t0;
}

`;


BABYLON.Effect.IncludesShadersStore['pathtracing_bvhTriangle_intersect'] = `

float BVH_TriangleIntersect( vec3 v0, vec3 v1, vec3 v2, vec3 rayOrigin, vec3 rayDirection, out float u, out float v )
{
	vec3 edge1 = v1 - v0;
	vec3 edge2 = v2 - v0;
	vec3 pvec = cross(rayDirection, edge2);
	float det = 1.0 / dot(edge1, pvec);
	vec3 tvec = rayOrigin - v0;
	u = dot(tvec, pvec) * det;
	vec3 qvec = cross(tvec, edge1);
	v = dot(rayDirection, qvec) * det;
	float t = dot(edge2, qvec) * det;
	return (det < 0.0 || u < 0.0 || u > 1.0 || v < 0.0 || u + v > 1.0 || t <= 0.0) ? INFINITY : t;
}

`;


BABYLON.Effect.IncludesShadersStore['pathtracing_bvhDoubleSidedTriangle_intersect'] = `

float BVH_DoubleSidedTriangleIntersect( vec3 v0, vec3 v1, vec3 v2, vec3 rayOrigin, vec3 rayDirection, out float u, out float v )
{
	vec3 edge1 = v1 - v0;
	vec3 edge2 = v2 - v0;
	vec3 pvec = cross(rayDirection, edge2);
	float det = 1.0 / dot(edge1, pvec);
	vec3 tvec = rayOrigin - v0;
	u = dot(tvec, pvec) * det;
	vec3 qvec = cross(tvec, edge1);
	v = dot(rayDirection, qvec) * det;
	float t = dot(edge2, qvec) * det;
	return (u < 0.0 || u > 1.0 || v < 0.0 || u + v > 1.0 || t <= 0.0) ? INFINITY : t;
}

`;



BABYLON.Effect.IncludesShadersStore[ 'pathtracing_default_main' ] = `

// Final Pixel Color, required out vec4 by WebGL 2.0
out vec4 glFragColor;

void main(void) // if the scene is static and doesn't have any special requirements, this main() can be used
{

	vec3 camRight       = vec3( uCameraMatrix[0][0], uCameraMatrix[0][1], uCameraMatrix[0][2]);
	vec3 camUp          = vec3( uCameraMatrix[1][0], uCameraMatrix[1][1], uCameraMatrix[1][2]);
	vec3 camForward     = vec3( uCameraMatrix[2][0], uCameraMatrix[2][1], uCameraMatrix[2][2]);
	vec3 cameraPosition = vec3( uCameraMatrix[3][0], uCameraMatrix[3][1], uCameraMatrix[3][2]);

	// calculate unique seed for rng() function (a high-quality pseudo-random number generator for the GPU by 'iq' on ShaderToy)
	seed = uvec2(uFrameCounter, uFrameCounter + 1.0) * uvec2(gl_FragCoord);

	// initialize variables for my custom blueNoise_rand() function (alternative to the rng() function mentioned above), which instead samples from the provided RGBA blueNoiseTexture to generate pseudo-random numbers.
	// note: its main use is for diffuse/dielectric surface convergence speed and shadow noise reduction, but it is inferior to iq's rng() function for generating pure non-repeating random numbers between 0.0-1.0 : use at your discretion
	counter = -1.0; // will get incremented by 1 on each call to blueNoise_rand()
	channel = 0; // the final selected color channel to use for blueNoise_rand() calc (range: 0 to 3, corresponds to R,G,B, or A)
	randNumber = 0.0; // the final randomly-generated number (range: 0.0 to 1.0)
	randVec4 = vec4(0); // on each animation frame, it samples and holds the RGBA blueNoise texture value for this pixel 
	randVec4 = texelFetch(blueNoiseTexture, ivec2(mod(gl_FragCoord.xy + floor(uRandomVec2 * 256.0), 256.0)), 0);

	// blueNoise_rand() produces higher FPS and almost immediate convergence, but may have very slight jagged diagonal edges on higher frequency color patterns, i.e. checkerboards.
	// rng() has a little less FPS on mobile, and a little more noisy initially, but eventually converges on perfect anti-aliased edges - use this if 'beauty-render' is desired.
	vec2 pixelOffset = uFrameCounter < 150.0 ? vec2( tentFilter(blueNoise_rand()), tentFilter(blueNoise_rand()) ) :
					      	   vec2( tentFilter(rng()), tentFilter(rng()) );

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

	rayOrigin = cameraPosition + randomAperturePos;
	rayDirection = finalRayDir;

	SetupScene();

	// Edge Detection variables - don't want to blur edges where either surface normals change abruptly (i.e. room wall corners), objects overlap each other (i.e. edge of a foreground sphere in front of another sphere right behind it),
	// or an abrupt color variation on the same smooth surface, even if it has similar surface normals (i.e. checkerboard pattern). Want to keep all of these cases as sharp as possible - no blur filter will be applied.
	vec3 objectNormal = vec3(0);
	vec3 objectColor = vec3(0);
	float objectID = -INFINITY;
	float pixelSharpness = 0.0;

	// perform path tracing and get resulting pixel color
	vec4 currentPixel = vec4( vec3(CalculateRadiance(objectNormal, objectColor, objectID, pixelSharpness)), 0.0 );
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
		previousPixel.rgb *= (1.0 / uPreviousSampleCount) * 0.5; // essentially previousPixel *= 0.5, like below
		previousPixel.a = 0.0;
		currentPixel.rgb *= 0.5;
	}
	else if (uCameraIsMoving) // camera is currently moving
	{
		previousPixel.rgb *= 0.5; // motion-blur trail amount (old image)
		previousPixel.a = 0.0;
		currentPixel.rgb *= 0.5; // brightness of new image (noisy)
	}

	// if current raytraced pixel didn't return any color value, just use the previous frame's pixel color
	if (currentPixel.rgb == vec3(0.0))
	{
		currentPixel.rgb = previousPixel.rgb;
		previousPixel.rgb *= 0.5;
		currentPixel.rgb *= 0.5;
	}


	if (colorDifference >= 1.0 || normalDifference >= 1.0 || objectDifference >= 1.0)
		pixelSharpness = 1.01;


	currentPixel.a = pixelSharpness;

	// Eventually, all edge-containing pixels' .a (alpha channel) values will converge to 1.01, which keeps them from getting blurred by the box-blur filter, thus retaining sharpness.
	if (previousPixel.a == 1.01)
		currentPixel.a = 1.01;


	glFragColor = vec4(previousPixel.rgb + currentPixel.rgb, currentPixel.a);
}

`;
