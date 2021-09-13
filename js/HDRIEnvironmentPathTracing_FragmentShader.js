BABYLON.Effect.ShadersStore["pathTracingFragmentShader"] = `
#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

// Demo-specific Uniforms
uniform sampler2D tAABBTexture;
uniform sampler2D tTriangleTexture;
uniform sampler2D tAlbedoTexture;
uniform sampler2D tBumpTexture;
uniform sampler2D tMetallicTexture;
uniform sampler2D tEmissiveTexture;
uniform sampler2D tHDRTexture;

uniform mat4 uLeftSphereInvMatrix;
uniform mat4 uRightSphereInvMatrix;
uniform mat4 uGLTF_Model_InvMatrix;
uniform vec3 uSunDirection;
uniform float uHDRExposure;
uniform float uSunPower;
uniform int uModelMaterialType;
uniform bool uModelUsesAlbedoTexture;
uniform bool uModelUsesBumpTexture;
uniform bool uModelUsesMetallicTexture;
uniform bool uModelUsesEmissiveTexture;


//#define INV_TEXTURE_WIDTH 0.000244140625 // (1 / 4096 texture width)
//#define INV_TEXTURE_WIDTH 0.00048828125  // (1 / 2048 texture width)
//#define INV_TEXTURE_WIDTH 0.0009765625   // (1 / 1024 texture width)

#define INV_TEXTURE_WIDTH 0.00048828125  // (1 / 2048 texture width)

// demo/scene-specific setup
#define N_QUADS 4 // ceiling quad and quad area light are removed for this demo
#define N_SPHERES 2

struct Ray { vec3 origin; vec3 direction; };
struct UnitSphere { vec3 color; int type; };
struct Quad { vec3 normal; vec3 v0; vec3 v1; vec3 v2; vec3 v3; vec3 color; int type; };
struct Intersection { float t; vec3 normal; vec3 color; vec2 uv; int type; float objectID; };

Quad quads[N_QUADS];
UnitSphere spheres[N_SPHERES];

// all required includes go here:

#include<pathtracing_defines_and_uniforms> // required on all scenes

#include<pathtracing_random> // required on all scenes

#include<pathtracing_calc_fresnel> // required on all scenes

#include<pathtracing_solve_quadratic> // required on scenes with any math-geometry shapes like sphere, cylinder, cone, etc.

#include<pathtracing_unit_sphere_intersect> // required on scenes with unit spheres that will be translated, rotated, and scaled by their matrix transform

#include<pathtracing_quad_intersect> // required on scenes with quads (actually internally they are made up of 2 triangles)

#include<pathtracing_boundingbox_intersect> // required on scenes containing a BVH for models in gltf/glb format

#include<pathtracing_bvhTriangle_intersect> // required on scenes containing triangular models in gltf/glb format

#include<pathtracing_bvhDoubleSidedTriangle_intersect> // required on scenes containing triangular models in gltf/glb format, and that need transparency effects



vec3 perturbNormal(vec3 nl, vec2 normalScale, vec2 uv)
{
	vec3 S = normalize( cross( abs(nl.y) < 0.9 ? vec3(0, 1, 0) : vec3(0, 0, 1), nl ) );
	vec3 T = cross(nl, S);
	vec3 N = normalize( nl );
	// invert S, T when the UV direction is backwards (from mirrored faces),
	// otherwise it will do the normal mapping backwards.
	vec3 NfromST = cross( S, T );
	if( dot( NfromST, N ) < 0.0 )
	{
		S *= -1.0;
		T *= -1.0;
	}
	mat3 tsn = mat3( S, T, N );

	vec3 mapN = texture(tBumpTexture, uv).xyz * 2.0 - 1.0;
	mapN = normalize(mapN);
	mapN.xy *= normalScale;
	
	return normalize( tsn * mapN );
}


vec2 stackLevels[28];

struct BoxNode
{
	vec4 data0; // corresponds to .x: idTriangle, .y: aabbMin.x, .z: aabbMin.y, .w: aabbMin.z
	vec4 data1; // corresponds to .x: idRightChild .y: aabbMax.x, .z: aabbMax.y, .w: aabbMax.z
};

BoxNode GetBoxNode(const in float i)
{
	// each bounding box's data is encoded in 2 rgba(or xyzw) texture slots 
	float iX2 = (i * 2.0);
	// (iX2 + 0.0) corresponds to .x: idTriangle, .y: aabbMin.x, .z: aabbMin.y, .w: aabbMin.z 
	// (iX2 + 1.0) corresponds to .x: idRightChild .y: aabbMax.x, .z: aabbMax.y, .w: aabbMax.z 

	ivec2 uv0 = ivec2( mod(iX2 + 0.0, 2048.0), (iX2 + 0.0) * INV_TEXTURE_WIDTH ); // data0
	ivec2 uv1 = ivec2( mod(iX2 + 1.0, 2048.0), (iX2 + 1.0) * INV_TEXTURE_WIDTH ); // data1
	
	return BoxNode( texelFetch(tAABBTexture, uv0, 0), texelFetch(tAABBTexture, uv1, 0) );
}


//-----------------------------------------------------------
void SceneIntersect( Ray r, out Intersection intersection )
//-----------------------------------------------------------
{
	BoxNode currentBoxNode, nodeA, nodeB, tmpNode;
	vec4 aabbNodeData;
	vec4 vd0, vd1, vd2, vd3, vd4, vd5, vd6, vd7;

	vec3 aabbMin, aabbMax;
	vec3 inverseDir = 1.0 / r.direction;
	vec3 hit, n;

	vec2 currentStackData, stackDataA, stackDataB, tmpStackData;
	ivec2 uv0, uv1, uv2, uv3, uv4, uv5, uv6, uv7;

	float d;
	float stackptr = 0.0;	
	float bc, bd;
	float id = 0.0;
	float tu, tv;
	float triangleID = 0.0;
	float triangleU = 0.0;
	float triangleV = 0.0;
	float triangleW = 0.0;

	int objectCount = 0;
	
	bool skip = false;
	bool triangleLookupNeeded = false;
	
	// initialize intersection fields
	intersection.t = INFINITY;
	intersection.type = -100;
	intersection.objectID = -INFINITY;
	Ray rObj;

	// transform ray into Left Sphere's object space
	rObj.origin = vec3( uLeftSphereInvMatrix * vec4(r.origin, 1.0) );
	rObj.direction = vec3( uLeftSphereInvMatrix * vec4(r.direction, 0.0) );

	d = UnitSphereIntersect( rObj.origin, rObj.direction, n );

	if (d < intersection.t)
	{
		intersection.t = d;
		intersection.normal = normalize(n);
		intersection.normal = normalize(transpose(mat3(uLeftSphereInvMatrix)) * intersection.normal);
		intersection.color = spheres[0].color;
		intersection.type = spheres[0].type;
		intersection.objectID = float(objectCount);
	}
	objectCount++;

	// transform ray into Right Sphere's object space
	rObj.origin = vec3( uRightSphereInvMatrix * vec4(r.origin, 1.0) );
	rObj.direction = vec3( uRightSphereInvMatrix * vec4(r.direction, 0.0) );

	d = UnitSphereIntersect( rObj.origin, rObj.direction, n );

	if (d < intersection.t)
	{
		intersection.t = d;
		intersection.normal = normalize(n);
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

	// transform ray into GLTF_Model's object space
	r.origin = vec3( uGLTF_Model_InvMatrix * vec4(r.origin, 1.0) );
	r.direction = vec3( uGLTF_Model_InvMatrix * vec4(r.direction, 0.0) );
	inverseDir = 1.0 / r.direction; // inverse direction must now be re-calculated

	currentBoxNode = GetBoxNode(stackptr);
	currentStackData = vec2(stackptr, BoundingBoxIntersect(currentBoxNode.data0.yzw, currentBoxNode.data1.yzw, r.origin, inverseDir));
	stackLevels[0] = currentStackData;
	skip = (currentStackData.y < intersection.t);

	while (true)
	{
		if (!skip) 
		{
			// decrease pointer by 1 (0.0 is root level, 27.0 is maximum depth)
			if (--stackptr < 0.0) // went past the root level, terminate loop
				break;

			currentStackData = stackLevels[int(stackptr)];
			
			if (currentStackData.y >= intersection.t)
				continue;
			
			currentBoxNode = GetBoxNode(currentStackData.x);
		}
		skip = false; // reset skip
		

		if (currentBoxNode.data0.x < 0.0) // < 0.0 signifies an inner node
		{
			nodeA = GetBoxNode(currentStackData.x + 1.0);
			nodeB = GetBoxNode(currentBoxNode.data1.x);
			stackDataA = vec2(currentStackData.x + 1.0, BoundingBoxIntersect(nodeA.data0.yzw, nodeA.data1.yzw, r.origin, inverseDir));
			stackDataB = vec2(currentBoxNode.data1.x, BoundingBoxIntersect(nodeB.data0.yzw, nodeB.data1.yzw, r.origin, inverseDir));
			
			// first sort the branch node data so that 'a' is the smallest
			if (stackDataB.y < stackDataA.y)
			{
				tmpStackData = stackDataB;
				stackDataB = stackDataA;
				stackDataA = tmpStackData;

				tmpNode = nodeB;
				nodeB = nodeA;
				nodeA = tmpNode;
			} // branch 'b' now has the larger rayT value of 'a' and 'b'

			if (stackDataB.y < intersection.t) // see if branch 'b' (the larger rayT) needs to be processed
			{
				currentStackData = stackDataB;
				currentBoxNode = nodeB;
				skip = true; // this will prevent the stackptr from decreasing by 1
			}
			if (stackDataA.y < intersection.t) // see if branch 'a' (the smaller rayT) needs to be processed 
			{
				if (skip) // if larger branch 'b' needed to be processed also,
					stackLevels[int(stackptr++)] = stackDataB; // cue larger branch 'b' for future round
							// also, increase pointer by 1
				
				currentStackData = stackDataA;
				currentBoxNode = nodeA;
				skip = true; // this will prevent the stackptr from decreasing by 1
			}

			continue;
		} // end if (currentBoxNode.data0.x < 0.0) // inner node


		// else this is a leaf

		// each triangle's data is encoded in 8 rgba(or xyzw) texture slots
		id = 8.0 * currentBoxNode.data0.x;

		uv0 = ivec2( mod(id + 0.0, 2048.0), (id + 0.0) * INV_TEXTURE_WIDTH );
		uv1 = ivec2( mod(id + 1.0, 2048.0), (id + 1.0) * INV_TEXTURE_WIDTH );
		uv2 = ivec2( mod(id + 2.0, 2048.0), (id + 2.0) * INV_TEXTURE_WIDTH );
		
		vd0 = texelFetch(tTriangleTexture, uv0, 0);
		vd1 = texelFetch(tTriangleTexture, uv1, 0);
		vd2 = texelFetch(tTriangleTexture, uv2, 0);

		if (!uModelUsesAlbedoTexture && uModelMaterialType == TRANSPARENT)
			d = BVH_DoubleSidedTriangleIntersect( vec3(vd0.xyz), vec3(vd0.w, vd1.xy), vec3(vd1.zw, vd2.x), r, tu, tv );
		else
			d = BVH_TriangleIntersect( vec3(vd0.xyz), vec3(vd0.w, vd1.xy), vec3(vd1.zw, vd2.x), r, tu, tv );

		if (d < intersection.t)
		{
			intersection.t = d;
			triangleID = id;
			triangleU = tu;
			triangleV = tv;
			triangleLookupNeeded = true;
		}
	      
	} // end while (true)



	if (triangleLookupNeeded)
	{
		uv0 = ivec2( mod(triangleID + 0.0, 2048.0), (triangleID + 0.0) * INV_TEXTURE_WIDTH );
		uv1 = ivec2( mod(triangleID + 1.0, 2048.0), (triangleID + 1.0) * INV_TEXTURE_WIDTH );
		uv2 = ivec2( mod(triangleID + 2.0, 2048.0), (triangleID + 2.0) * INV_TEXTURE_WIDTH );
		uv3 = ivec2( mod(triangleID + 3.0, 2048.0), (triangleID + 3.0) * INV_TEXTURE_WIDTH );
		uv4 = ivec2( mod(triangleID + 4.0, 2048.0), (triangleID + 4.0) * INV_TEXTURE_WIDTH );
		uv5 = ivec2( mod(triangleID + 5.0, 2048.0), (triangleID + 5.0) * INV_TEXTURE_WIDTH );
		uv6 = ivec2( mod(triangleID + 6.0, 2048.0), (triangleID + 6.0) * INV_TEXTURE_WIDTH );
		uv7 = ivec2( mod(triangleID + 7.0, 2048.0), (triangleID + 7.0) * INV_TEXTURE_WIDTH );
		
		// the complete vertex data for each individual triangle consumes 8 rgba texture slots on the GPU data texture
		// also, packing/padding the vertex data into 8 texels ensures 8-boundary alignments (power of 2) which is more memory-access friendly 
		vd0 = texelFetch(tTriangleTexture, uv0, 0); // rgb: vertex0 position xyz, a: vertex1 position x 
		vd1 = texelFetch(tTriangleTexture, uv1, 0); // rg: vertex1(cont.) position yz, ba: vertex2 position xy
		vd2 = texelFetch(tTriangleTexture, uv2, 0); // r: vertex2(cont.) position z, gba: vertex0 normal xyz
		vd3 = texelFetch(tTriangleTexture, uv3, 0); // rgb: vertex1 normal xyz, a: vertex2 normal x
		vd4 = texelFetch(tTriangleTexture, uv4, 0); // rg: vertex2(cont.) normal yz, ba: vertex0 uv
		vd5 = texelFetch(tTriangleTexture, uv5, 0); // rg: vertex1 uv, ba: vertex2 uv
		vd6 = texelFetch(tTriangleTexture, uv6, 0); // rgb: triangle material rgb color, a: triangle material type id (enum)
		vd7 = texelFetch(tTriangleTexture, uv7, 0); // rgba: (reserved for future PBR material extra properties)

		// face normal for flat-shaded polygon look
		//intersection.normal = normalize( cross(vec3(vd0.w, vd1.xy) - vec3(vd0.xyz), vec3(vd1.zw, vd2.x) - vec3(vd0.xyz)) );
		
		// interpolated normal using triangle intersection's uv's
		triangleW = 1.0 - triangleU - triangleV;
		n = normalize(triangleW * vec3(vd2.yzw) + triangleU * vec3(vd3.xyz) + triangleV * vec3(vd3.w, vd4.xy));
		intersection.uv = triangleW * vec2(vd4.zw) + triangleU * vec2(vd5.xy) + triangleV * vec2(vd5.zw);
		n = uModelUsesBumpTexture ? perturbNormal(n, vec2(1.0, 1.0), intersection.uv) : n;
		// transform normal back into world space
		intersection.normal = normalize(transpose(mat3(uGLTF_Model_InvMatrix)) * n);

		//intersection.type = int(vd6.x);
		intersection.type = uModelUsesAlbedoTexture ? PBR_MATERIAL : uModelMaterialType;

		intersection.color = vec3(1);//vd6.yzw;

		//intersection.albedoTextureID = int(vd7.x);
		//intersection.albedoTextureID = -1;
		
		intersection.objectID = float(objectCount);
	} // if (triangleLookupNeeded)

} // end void SceneIntersect( Ray r, out Intersection intersection )



vec3 Get_HDR_Color(Ray r)
{
	vec2 sampleUV;
	sampleUV.x = atan(r.direction.x, r.direction.z) * ONE_OVER_TWO_PI + 0.5;
  	sampleUV.y = acos(-r.direction.y) * ONE_OVER_PI;
	
	vec3 texColor = texture(tHDRTexture, sampleUV).rgb;

	return texColor * uHDRExposure;
}

//-----------------------------------------------------------------------------------------------------------------------------
vec3 CalculateRadiance( Ray r, out vec3 objectNormal, out vec3 objectColor, out float objectID, out float pixelSharpness )
//-----------------------------------------------------------------------------------------------------------------------------
{
	Intersection intersection; // this struct will hold a record of ray-surface intersection data

	vec3 accumCol = vec3(0);
	vec3 mask = vec3(1);
	vec3 dirToLight;
	vec3 tdir;
	vec3 x, n, nl;
	vec3 absorptionCoefficient;
	vec3 metallicRoughness = vec3(0);
	vec3 emission = vec3(0);

	float nc, nt, ratioIoR, Re, Tr;
	float P, RP, TP;
	float weight;
	float thickness = 0.05;
	float scatteringDistance;
	float maxEmission = 0.0;

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
		{
			vec3 environmentColor = Get_HDR_Color(r);

			if (bounces == 0) // ray hits sky first
			{
				pixelSharpness = 1.01;
				accumCol = environmentColor;
				break; // exit early	
			}
			else if (diffuseCount == 0 && bounceIsSpecular)
			{
				pixelSharpness = 1.01;
				accumCol = mask * environmentColor;
				break; // exit early	
			}
			else if (sampleLight)
			{
				accumCol = mask * environmentColor;
				break;
			}
			else if (diffuseCount == 1 && previousIntersecType == TRANSPARENT && bounceIsSpecular)
			{
				accumCol = mask * environmentColor;
				break;
			}
			else if (diffuseCount > 0)
			{
				weight = dot(r.direction, uSunDirection) < 0.99 ? 1.0 : 0.0;
				accumCol = mask * environmentColor * weight;
				break;
			}
		} // end if (intersection.t == INFINITY)


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


		// if we get here and sampleLight is still true, shadow ray failed to find a light source
		if (sampleLight)
			break;


		if (intersection.type == PBR_MATERIAL)
		{
			intersection.color = texture(tAlbedoTexture, intersection.uv).rgb;
			intersection.color = pow(intersection.color, vec3(2.2));
			
			emission = uModelUsesEmissiveTexture ? texture(tEmissiveTexture, intersection.uv).rgb : vec3(0);
			emission = pow(emission, vec3(2.2));
			maxEmission = max(emission.r, max(emission.g, emission.b));
			if (bounceIsSpecular && maxEmission > 0.01)
			{
				pixelSharpness = 1.01;
				accumCol = mask * emission;
				break;
			}

			intersection.type = DIFFUSE;
			
			metallicRoughness = uModelUsesMetallicTexture ? texture(tMetallicTexture, intersection.uv).rgb : vec3(0);
			metallicRoughness = pow(metallicRoughness, vec3(2.2));
			if (metallicRoughness.g > 0.01) // roughness
			{
				intersection.type = CLEARCOAT_DIFFUSE;
			}	
			if (metallicRoughness.b > 0.01) // metalness
			{
				intersection.type = METAL;
			}
				
		}

		if (intersection.type == DIFFUSE) // Ideal diffuse reflection
		{
			diffuseCount++;

			mask *= intersection.color;

			bounceIsSpecular = false;

			if (diffuseCount < 3 && blueNoise_rand() < 0.5)
			{
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			r = Ray( x, normalize(uSunDirection) );// create shadow ray pointed towards light
			r.direction = randomDirectionInSpecularLobe(r.direction, 0.03);
			r.origin += nl * uEPS_intersect;
			
			weight = max(0.0, dot(r.direction, nl)) * (uSunPower * uSunPower * 0.0000001); // down-weight directSunLight contribution
			mask *= weight;

			sampleLight = true;
			continue;

		} // end if (intersection.type == DIFFUSE)


		if (intersection.type == METAL)  // Ideal metal specular reflection
		{
			mask *= intersection.color;

			//r = Ray( x, reflect(r.direction, nl) );
			r = Ray( x, randomDirectionInSpecularLobe(reflect(r.direction, nl), metallicRoughness.g) );
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

			// TODO: turn on refractive caustics and 
			// handle fireflies in "if (intersection.t == INFINITY)" code above
			// if (diffuseCount == 1)
			// 	bounceIsSpecular = true; // turn on refracting caustics

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

			if (diffuseCount < 3 && blueNoise_rand() < 0.5)
			{
				// choose random Diffuse sample vector
				r = Ray( x, randomCosWeightedDirectionInHemisphere(nl) );
				r.origin += nl * uEPS_intersect;
				continue;
			}

			r = Ray( x, normalize(uSunDirection) );// create shadow ray pointed towards light
			r.direction = randomDirectionInSpecularLobe(r.direction, 0.03);
			r.origin += nl * uEPS_intersect;
			
			weight = max(0.0, dot(r.direction, nl)) * (uSunPower * uSunPower * 0.0000001); // down-weight directSunLight contribution
			mask *= weight;

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
	float wallRadius = 50.0;

	spheres[0] = UnitSphere( vec3(1.0, 1.0, 0.0), CLEARCOAT_DIFFUSE ); // clearCoat diffuse Sphere Left
	spheres[1] = UnitSphere( vec3(1.0, 1.0, 1.0), METAL ); // metal Sphere Right
 
	quads[0] = Quad( vec3( 0, 0, 1), vec3(-wallRadius, wallRadius, wallRadius), vec3( wallRadius, wallRadius, wallRadius), vec3( wallRadius,-wallRadius, wallRadius), vec3(-wallRadius,-wallRadius, wallRadius), vec3( 1.0,  1.0,  1.0), DIFFUSE);// Back Wall
	quads[1] = Quad( vec3( 1, 0, 0), vec3(-wallRadius,-wallRadius, wallRadius), vec3(-wallRadius,-wallRadius,-wallRadius), vec3(-wallRadius, wallRadius,-wallRadius), vec3(-wallRadius, wallRadius, wallRadius), vec3( 0.7, 0.05, 0.05), DIFFUSE);// Left Wall Red
	quads[2] = Quad( vec3(-1, 0, 0), vec3( wallRadius,-wallRadius,-wallRadius), vec3( wallRadius,-wallRadius, wallRadius), vec3( wallRadius, wallRadius, wallRadius), vec3( wallRadius, wallRadius,-wallRadius), vec3(0.05, 0.05,  0.7), DIFFUSE);// Right Wall Blue
	//quads[3] = Quad( vec3( 0,-1, 0), vec3(-wallRadius, wallRadius,-wallRadius), vec3( wallRadius, wallRadius,-wallRadius), vec3( wallRadius, wallRadius, wallRadius), vec3(-wallRadius, wallRadius, wallRadius), vec3( 1.0,  1.0,  1.0), DIFFUSE);// Ceiling
	quads[3] = Quad( vec3( 0, 1, 0), vec3(-wallRadius,-wallRadius, wallRadius), vec3( wallRadius,-wallRadius, wallRadius), vec3( wallRadius,-wallRadius,-wallRadius), vec3(-wallRadius,-wallRadius,-wallRadius), vec3( 1.0,  1.0,  1.0), DIFFUSE);// Floor

} // end void SetupScene(void)


// if your scene is static and doesn't have any special requirements, you can use the default main()
#include<pathtracing_default_main>

`;
