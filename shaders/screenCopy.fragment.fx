#version 300 es

precision highp float;
precision highp int;
precision highp sampler2D;

// Samplers
uniform sampler2D textureSampler;

// Final Pixel Color
out vec4 glFragColor;

void main(void) 
{
        glFragColor = texelFetch(textureSampler, ivec2(gl_FragCoord.xy), 0);
}