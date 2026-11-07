#include "ogrewidget.h"
#include "RobloxIDEDoc.h"
#include "RobloxDocManager.h"
#include <QCoreApplication>
#include <QMouseEvent>
#include <QKeyEvent>
#include <QResizeEvent>
#include <QExposeEvent>
#include "StudioUtilities.h"
#include "RobloxMainWindow.h"
#include "v8datamodel/InputObject.h"
#include <QDebug>

LOGGROUP(TaskSchedulerTiming)
LOGGROUP(RenderRequest)
FASTFLAG(GoogleAnalyticsTrackingEnabled)
DYNAMIC_FASTFLAGVARIABLE(BackTabInputInStudio, false)
FASTFLAGVARIABLE(DontSwallowInputForStudioShortcuts, false)
DYNAMIC_FASTFLAG(MaterialPropertiesEnabled)

static RBX::KeyCode keyCodeTOUIKeyCode(Qt::Key keyCode);
static RBX::ModCode modifiersToUIModCode(Qt::KeyboardModifiers modifier);

QOgreWidget::QOgreWidget(const QString& name)
    : QOpenGLWindow(QOpenGLWindow::NoPartialUpdate),
      m_pRobloxView(nullptr),
      m_bIgnoreEnterEvent(0),
      m_bIgnoreLeaveEvent(false),
      m_bUpdateInProgress(false),
      m_bMouseCommandInvoked(false),
      m_hasApplicationFocus(false),
      m_bRobloxViewInitialized(false),
      m_luaTextBoxHasFocus(false),
      m_name(name)
{
    QSurfaceFormat format;
    format.setDepthBufferSize(24);
    format.setStencilBufferSize(8);
    format.setSwapInterval(1);
   /* format.setVersion(3, 3);
    format.setColorSpace(QSurfaceFormat::sRGBColorSpace);
    format.setOption(QSurfaceFormat::ResetNotification);
    format.setSwapInterval(1);
    format.setProfile(QSurfaceFormat::CoreProfile);*/
    setFormat(format);
    connect(this, &QOpenGLWindow::frameSwapped, this, &QOgreWidget::onFrameSwapped);
}

QOgreWidget::~QOgreWidget()
{
    if (m_pRobloxView) 
        delete m_pRobloxView;
    m_pRobloxView = NULL;
}

bool QOgreWidget::eventFilter(QObject * watched, QEvent * evt)
{
    QEvent::Type eventType = evt->type();

    if (eventType == QEvent::ApplicationActivate)
        m_hasApplicationFocus = true;
    else if (eventType == QEvent::ApplicationDeactivate)
        m_hasApplicationFocus = false;
    return QOpenGLWindow::eventFilter(watched, evt);
}

void QOgreWidget::onFrameSwapped() {
    requestUpdate();
}

void QOgreWidget::closeEvent(QCloseEvent* evt)
{
    evt->accept();
}

bool QOgreWidget::event(QEvent * evt)
{
    if (m_pRobloxView)
    {
        if (evt->type() == QEvent::FocusOut)
        {
            setLuaTextBoxHasFocus(false);
            return true;
        }
        else if (evt->type() == QEvent::FocusIn)
        {
            return true;
        }
        else if (evt->type() == QEvent::Enter)
        {
            enterEvent(evt);
            return true;
        }
        else if (evt->type() == QEvent::Leave)
        {
            leaveEvent(evt);
            return true;
        }
    }

    if (m_luaTextBoxHasFocus)
    {
        if (evt->type() == QEvent::ShortcutOverride)
        {
            QKeyEvent* keyEvent = static_cast<QKeyEvent*>(evt);
            keyEvent->accept();
            return true;
        }
    }

    if (evt->type() == QEvent::KeyPress)
    {
        QKeyEvent* keyEvent = static_cast<QKeyEvent*>(evt);
        if (keyEvent->modifiers().testFlag(Qt::ControlModifier) && (keyEvent->key() == Qt::Key_Tab))
        {
            evt->accept();
            QCoreApplication::sendEvent(&UpdateUIManager::Instance().getMainWindow(), evt);
            return true;
        }
        keyPressEvent(keyEvent);
        return true;
    }
    else if(evt->type() == QEvent::KeyRelease)
    {
        QKeyEvent* keyEvent = static_cast<QKeyEvent*>(evt);
        keyReleaseEvent(keyEvent);
        return true;
    }

    return QOpenGLWindow::event(evt);
}

void QOgreWidget::enterEvent(QEvent *)
{  
    m_hasApplicationFocus = true;
    if(!m_pRobloxView)
        return;
    m_pRobloxView->handleFocus(true);

#ifdef Q_WS_MAC
    if ( QApplication::activeWindow() != &UpdateUIManager::Instance().getMainWindow() )
        return;
#endif

    //inform rbx view about the change
    m_pRobloxView->handleMouseInside(true);

    //enable mouse tracking
    setMouseGrabEnabled(true);
    requestActivate();
}

void QOgreWidget::leaveEvent(QEvent *)
{
    m_hasApplicationFocus = false;
#ifdef Q_WS_MAC
    if (m_bIgnoreLeaveEvent)
    {
        m_bIgnoreLeaveEvent = false;
        return;
    }
#endif

    if(!m_pRobloxView)
        return;
    m_pRobloxView->handleFocus(false);

    //inform rbx view about the change
    m_pRobloxView->handleMouseInside(false);

    //disable mouse tracking
    setMouseGrabEnabled(false);
    setCursor(Qt::BlankCursor);
}

void QOgreWidget::setRobloxView(RobloxView* rbxView)
{
    m_pRobloxView = rbxView;
}

void QOgreWidget::activate()
{
    m_hasApplicationFocus = true;
}

void QOgreWidget::deActivate()
{
    m_hasApplicationFocus = false;
}

void QOgreWidget::exposeEvent(QExposeEvent* evt)
{
}

void QOgreWidget::paintGL()
{
    if (!m_bRobloxViewInitialized)
        if (RobloxIDEDoc* playDoc = RobloxDocManager::Instance().getPlayDoc())
        {
            m_bRobloxViewInitialized = true;
            playDoc->initializeRobloxView();
        }

    m_pRobloxView->updateView();
}

void QOgreWidget::resizeEvent(QResizeEvent* evt)
{
    if (!m_pRobloxView) 
        return;
    m_pRobloxView->setBounds(evt->size().width(), evt->size().height());
}

void QOgreWidget::mousePressEvent(QMouseEvent* evt)
{
    if (!m_pRobloxView)
        return;

    RBX::InputObject::UserInputType mouseEventType = RBX::InputObject::TYPE_NONE;

    switch(evt->button())
    {
    case Qt::LeftButton:
        mouseEventType = RBX::InputObject::TYPE_MOUSEBUTTON1;
        break;
    case Qt::RightButton:
        mouseEventType = RBX::InputObject::TYPE_MOUSEBUTTON2;
        break;
    case Qt::MiddleButton:
        mouseEventType = RBX::InputObject::TYPE_MOUSEBUTTON3;
        break;
    }

    QPoint pos = evt->localPos().toPoint();
    m_pRobloxView->handleMouse(
        mouseEventType,
        RBX::InputObject::INPUT_STATE_BEGIN,
        pos.x(),
        pos.y(),
        modifiersToUIModCode(evt->modifiers())
    );

    evt->accept();
}

void QOgreWidget::mouseReleaseEvent(QMouseEvent* evt)
{
    if (!m_pRobloxView)
        return;

    RBX::InputObject::UserInputType mouseEventType = RBX::InputObject::TYPE_NONE;
    switch(evt->button())
    {
    case Qt::LeftButton:
        mouseEventType = RBX::InputObject::TYPE_MOUSEBUTTON1;
        break;
    case Qt::RightButton:
        mouseEventType = RBX::InputObject::TYPE_MOUSEBUTTON2;
        break;
    case Qt::MiddleButton:
        mouseEventType = RBX::InputObject::TYPE_MOUSEBUTTON3;
        break;
    default:
        break;
    }

    QPoint currentPos = evt->localPos().toPoint();
    m_pRobloxView->handleMouse(
        mouseEventType,
        RBX::InputObject::INPUT_STATE_END,
        currentPos.x(), 
        currentPos.y(), 
        modifiersToUIModCode(evt->modifiers()) );
    evt->accept();
}

void QOgreWidget::mouseMoveEvent(QMouseEvent* evt)
{
    QPoint pos = evt->localPos().toPoint();

    if (m_pRobloxView)
    {  
        lastMovePoint = pos;
        lastMoveModCode = modifiersToUIModCode(evt->modifiers());

        m_pRobloxView->handleMouse(RBX::InputObject::TYPE_MOUSEMOVEMENT, RBX::InputObject::INPUT_STATE_CHANGE, lastMovePoint.x(), lastMovePoint.y(), lastMoveModCode);
    }
    evt->accept();
}

void QOgreWidget::keyPressEvent(QKeyEvent* evt)
{
    handleKeyEvent(evt, RBX::InputObject::TYPE_KEYBOARD, RBX::InputObject::INPUT_STATE_BEGIN);
}

void QOgreWidget::keyReleaseEvent(QKeyEvent* evt)
{
    handleKeyEvent(evt, RBX::InputObject::TYPE_KEYBOARD, RBX::InputObject::INPUT_STATE_END);
}

bool QOgreWidget::focusNextPrevChild(bool next)
{
    Q_UNUSED(next);
    return false;
}

void QOgreWidget::wheelEvent(QWheelEvent *evt)
{
    if (!m_pRobloxView)
        return;

    QPoint currentPos = evt->position().toPoint();
    QPoint angleDelta = evt->angleDelta();

    int scrollAmount = angleDelta.y();
    if (scrollAmount != 0) {
        m_pRobloxView->handleScrollWheel(scrollAmount, currentPos.x(), currentPos.y());
        evt->accept();
    } else {
        evt->ignore();
    }
}

void QOgreWidget::initializeGL()
{
}

void QOgreWidget::handleKeyEvent(QKeyEvent * evt, RBX::InputObject::UserInputType eventType,
    RBX::InputObject::UserInputState eventState, bool processed)
{
    if (eventType == RBX::InputObject::TYPE_KEYBOARD && (!m_pRobloxView || evt->isAutoRepeat()))
    {
        return;
    }

    std::string textString = evt->text().toStdString();

    m_pRobloxView->handleKey(eventType, eventState,
        keyCodeTOUIKeyCode(static_cast<Qt::Key>(evt->key())), modifiersToUIModCode(evt->modifiers()),
        (textString.length() > 0) ? textString.c_str()[0] : NULL,
        processed);
}

static RBX::KeyCode keyCodeTOUIKeyCode(Qt::Key keyCode)
{
	/// Handle all albhabets
    if (keyCode >= Qt::Key_A && keyCode <= Qt::Key_Z)
        return RBX::KeyCode(keyCode - Qt::Key_A + 'a');

	// Handle Numbers
	if(keyCode >= Qt::Key_0 && keyCode <= Qt::Key_9)
		return RBX::KeyCode(keyCode);

	// Handle F1 to F15
	if(keyCode >= Qt::Key_F1 && keyCode <= Qt::Key_F15)
		return RBX::KeyCode(keyCode - 0xFFFF16);


	RBX::KeyCode rbxKey = RBX::SDLK_UNKNOWN;

	// Handle Special Unordered Keys Here
	switch(keyCode)
	{
	case Qt::Key_CapsLock:
		rbxKey = RBX::SDLK_CAPSLOCK;
		break;
	case Qt::Key_Backspace :
		rbxKey = RBX::SDLK_BACKSPACE;
		break;
	case Qt::Key_Up :
		rbxKey = RBX::SDLK_UP;
		break;
	case Qt::Key_Down :
		rbxKey = RBX::SDLK_DOWN;
		break;
	case Qt::Key_Left :
		rbxKey = RBX::SDLK_LEFT;
		break;
	case Qt::Key_Right :
		rbxKey = RBX::SDLK_RIGHT;
		break;
	case Qt::Key_Insert :
		rbxKey = RBX::SDLK_INSERT;
		break;
	case Qt::Key_Delete :
		rbxKey = RBX::SDLK_DELETE;
		break;
	case Qt::Key_Home :
		rbxKey = RBX::SDLK_HOME;
		break;
	case Qt::Key_End :
		rbxKey = RBX::SDLK_END;
		break;
	case Qt::Key_PageUp :
		rbxKey = RBX::SDLK_PAGEUP;
		break;
	case Qt::Key_PageDown :
		rbxKey = RBX::SDLK_PAGEDOWN;
		break;
	case Qt::Key_Space :
		rbxKey = RBX::SDLK_SPACE;
		break;
	case Qt::Key_Control:
		rbxKey = RBX::SDLK_LCTRL;	
		break;
	case Qt::Key_Alt:
		rbxKey = RBX::SDLK_LALT;		
		break;
	case Qt::Key_Shift:
		rbxKey = RBX::SDLK_LSHIFT;
		break;
	case Qt::Key_Escape:
		rbxKey = RBX::SDLK_ESCAPE;
		break;
	case Qt::Key_Minus:
		rbxKey = RBX::SDLK_MINUS;
		break;
	case Qt::Key_Equal:
		rbxKey = RBX::SDLK_EQUALS;
		break;
	case Qt::Key_Tab:
		rbxKey = RBX::SDLK_TAB;
		break;
	case Qt::Key_Backtab:
		{
			if (DFFlag::BackTabInputInStudio)
			{
				rbxKey = RBX::SDLK_TAB;
				break;
			}
		}
	case Qt::Key_BracketLeft:
		rbxKey = RBX::SDLK_LEFTBRACKET;
		break;
	case Qt::Key_BracketRight:
		rbxKey = RBX::SDLK_RIGHTBRACKET;
		break;
	case Qt::Key_Return:
	case Qt::Key_Enter:
		rbxKey = RBX::SDLK_RETURN;
		break;
	case Qt::Key_Semicolon:
		rbxKey = RBX::SDLK_SEMICOLON;
		break;
	case Qt::Key_QuoteLeft:
		rbxKey = RBX::SDLK_BACKQUOTE;
		break;
	case Qt::Key_Apostrophe:
		rbxKey = RBX::SDLK_QUOTE;
		break;
	case Qt::Key_QuoteDbl:
		rbxKey = RBX::SDLK_QUOTEDBL;
		break;
	case Qt::Key_Backslash:
		rbxKey = RBX::SDLK_BACKSLASH;
		break;
	case Qt::Key_Comma:
		rbxKey = RBX::SDLK_COMMA;
		break;
	case Qt::Key_Period:
		rbxKey = RBX::SDLK_PERIOD;
		break;
	case Qt::Key_Slash:
		rbxKey = RBX::SDLK_SLASH;
		break;
	case Qt::Key_multiply:
		rbxKey = RBX::SDLK_KP_MULTIPLY;
		break;
	case Qt::Key_NumLock:
		rbxKey = RBX::SDLK_NUMLOCK;
		break;
	case Qt::Key_ScrollLock:
		rbxKey = RBX::SDLK_SCROLLOCK;
		break;
	case Qt::Key_Asterisk:
		rbxKey = RBX::SDLK_ASTERISK;
		break;
	case Qt::Key_Plus:
		rbxKey = RBX::SDLK_PLUS;
		break;
	}

	return rbxKey;
}

static RBX::ModCode modifiersToUIModCode(Qt::KeyboardModifiers modifier)
{
    unsigned int modCode = 0;

    if (modifier & Qt::ShiftModifier)
        modCode |= RBX::KMOD_LSHIFT;
    if (modifier & Qt::ControlModifier)
        modCode |= RBX::KMOD_LCTRL;
    if (modifier & Qt::AltModifier)
        modCode |= RBX::KMOD_LALT;

    return static_cast<RBX::ModCode>(modCode);
}