#include "FastLog.h"

FASTFLAG(GraphicsGL3)

#ifndef EMSCRIPTEN
    #define GLEW_STATIC
    #include <GL/glew.h>
#else
    #include <GLES3/gl3.h>
#endif

template <typename T, typename U> static void patchUnsafe(T& t, U& u)
{
    if (!t && u)
		t = reinterpret_cast<T>(u);
}

template <typename T> static void patch(T& t, T& u)
{
    if (!t && u)
		t = u;
}

void glewInitRBX()
{
    #ifndef EMSCRIPTEN
        glewExperimental = GL_TRUE;
        GLenum glewStatus = glewInit();
        if (glewStatus != GLEW_OK)
        {
            printf("GLEW init failed: %s\n", glewGetErrorString(glewStatus));
            return;
        }
    #endif

	GLenum err1 = glGetError();
	if (err1 != GL_NO_ERROR)
	{
		printf("init gl error: 0x%X\n", err1);
	}
	else
	{
		printf("no gl error\n");
	}
}