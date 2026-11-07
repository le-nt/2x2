// this uses EGL
#include "ContextGL.h"
#include "HeadersGL.h"
#include "rbx/Debug.h"
#include <EGL/egl.h>
#include <GL/gl.h>
#include <cstring>
#include <iostream>

namespace RBX
{
    namespace Graphics
    {
        class ContextGLHeadless : public ContextGL
        {
        public:
            ContextGLHeadless(unsigned int width, unsigned int height)
                : width(width), height(height), display(EGL_NO_DISPLAY), context(EGL_NO_CONTEXT), surface(EGL_NO_SURFACE)
            {
                constexpr EGLint configAttribs[] = {
                    EGL_SURFACE_TYPE, EGL_PBUFFER_BIT,
                    EGL_BLUE_SIZE, 8,
                    EGL_GREEN_SIZE, 8,
                    EGL_RED_SIZE, 8,
                    EGL_RENDERABLE_TYPE, EGL_OPENGL_BIT,
                    EGL_NONE
                };

                EGLint pbufferAttribs[] = {
                    EGL_WIDTH, static_cast<int>(width),
                    EGL_HEIGHT, static_cast<int>(height),
                    EGL_NONE,
                };

                display = eglGetDisplay(EGL_DEFAULT_DISPLAY);

                eglInitialize(display, nullptr, nullptr);

                EGLint numConfigs;
                EGLConfig eglConfig;
                eglChooseConfig(display, configAttribs, &eglConfig, 1, &numConfigs);

                surface = eglCreatePbufferSurface(display, eglConfig, pbufferAttribs);
                eglBindAPI(EGL_OPENGL_API);
                context = eglCreateContext(display, eglConfig, EGL_NO_CONTEXT, nullptr);
                eglMakeCurrent(display, surface, surface, context);

                glewExperimental = GL_TRUE;
                GLenum err = glewInit();
                if (err != GLEW_OK) {
                    std::cerr << "GLEW Init error: " << glewGetErrorString(err) << std::endl;
                    throw RBX::runtime_error("glewInit failed");
                }
            }

            ~ContextGLHeadless()
            {
                if (context != EGL_NO_CONTEXT)
                    eglDestroyContext(display, context);
                if (surface != EGL_NO_SURFACE)
                    eglDestroySurface(display, surface);
                if (display != EGL_NO_DISPLAY)
                    eglTerminate(display);
            }

            void setCurrent() override
            {
                if (!eglMakeCurrent(display, surface, surface, context))
                {
                    RBXASSERT(false);
                }
            }

            void swapBuffers() override
            {

            }

            unsigned int getMainFramebufferId() override
            {
                return 0;
            }

            bool isMainFramebufferRetina() override
            {
                return false;
            }

            std::pair<unsigned int, unsigned int> updateMainFramebuffer(unsigned int w, unsigned int h) override
            {
                if (w != width || h != height)
                {
                    width = w;
                    height = h;
                }
                return std::make_pair(width, height);
            }

        private:
            EGLDisplay display;
            EGLContext context;
            EGLSurface surface;
            unsigned int width;
            unsigned int height;
        };

        ContextGL* ContextGL::create(OSContext* context)
        {
            return new ContextGLHeadless(512, 512);
        }

    } // namespace Graphics
} // namespace RBX
