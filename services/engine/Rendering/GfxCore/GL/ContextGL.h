#pragma once

#include <utility>
#include "GfxBase/ViewBase.h"

namespace RBX
{
namespace Graphics
{

class ContextGL
{
public:
	static ContextGL* create(OSContext* context);

    virtual ~ContextGL() {}

    virtual void setCurrent() = 0;
    virtual void swapBuffers() = 0;

    virtual unsigned int getMainFramebufferId() = 0;
    virtual bool isMainFramebufferRetina() = 0;

    virtual std::pair<unsigned int, unsigned int> updateMainFramebuffer(unsigned int width, unsigned int height) = 0;
};

}
}
