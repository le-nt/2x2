#include "HeadersGL.h"
#include "ContextGL.h"
#include "rbx/Debug.h"
#include <QWindow>
#include <QOpenGLWindow>

namespace RBX
{
namespace Graphics
{

class ContextGLQt : public ContextGL
{
public:
    explicit ContextGLQt(QOpenGLWindow* window)
        : m_window(window)
    {
        if (!m_window)
            throw RBX::runtime_error("QWindow pointer is null");
        m_window->makeCurrent();
        glewInitRBX();
    }

    ~ContextGLQt() override
    {
    }

    void setCurrent() override
    {
        if (m_window)
            m_window->makeCurrent();
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
        return m_window && m_window->devicePixelRatio() > 1.0;
    }

    std::pair<unsigned int, unsigned int> updateMainFramebuffer(unsigned int width, unsigned int height) override
    {
        if (!m_window)
            return {0, 0};
        QSize size = m_window->size() * m_window->devicePixelRatio();
        return { static_cast<unsigned int>(size.width()), static_cast<unsigned int>(size.height()) };
    }

private:
    QOpenGLWindow* m_window;
};

ContextGL* ContextGL::create(OSContext* context)
{
    return new ContextGLQt(reinterpret_cast<QOpenGLWindow*>(context->hWnd));
}

}
}
